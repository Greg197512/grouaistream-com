// AI Vision Mood — wykrywa emocje z twarzy: oczy, wzrok, mikroekspresje.
// Analizuje SEKWENCJĘ klatek (mocniejsze niż jeden snapshot) w jednym zapytaniu.
// Darmowo: próbuje kolejno silników widzących z kluczem już obecnym w projekcie.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_EMOTIONS = [
  "happy", "sad", "angry", "surprised", "neutral", "fearful", "disgusted",
];

type VisionProvider = { name: string; key: string | undefined; url: string; model: string };

// Wyciąga pierwszy obiekt JSON z tekstu (modele czasem dodają otoczkę).
function extractJson(text: string): any | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Akceptuj sekwencję klatek (frames[]) lub pojedynczy obraz (kompatybilność wstecz).
    const rawFrames: string[] = Array.isArray(body.frames) && body.frames.length
      ? body.frames
      : body.imageBase64
        ? [body.imageBase64]
        : [];

    if (!rawFrames.length) {
      return new Response(
        JSON.stringify({ error: "frames[] or imageBase64 required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Maks. 5 klatek — wystarcza na mikroekspresje, trzyma koszt/latencję nisko.
    const frames = rawFrames.slice(0, 5).map((f) =>
      f.startsWith("data:") ? f : `data:image/jpeg;base64,${f}`
    );

    const providers: VisionProvider[] = [
      {
        name: "Lovable/Gemini",
        key: Deno.env.get("LOVABLE_API_KEY"),
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        model: "google/gemini-2.5-flash",
      },
      {
        name: "OpenRouter/Llama-Vision",
        key: Deno.env.get("OPENROUTER_API_KEY"),
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: "meta-llama/llama-3.2-11b-vision-instruct:free",
      },
      {
        name: "OpenRouter/Qwen-VL",
        key: Deno.env.get("OPENROUTER_API_KEY"),
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: "qwen/qwen2.5-vl-7b-instruct:free",
      },
    ];

    if (!providers.some((p) => p.key)) {
      return new Response(
        JSON.stringify({ error: "Brak klucza AI (LOVABLE_API_KEY lub OPENROUTER_API_KEY)." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt =
      `Jesteś ekspertem od odczytu emocji z twarzy (na bazie FACS — Facial Action Coding System). ` +
      `Dostajesz KILKA kolejnych klatek tej samej osoby (krótka sekwencja ~1-2 s). ` +
      `Analizuj mimikę, oczy (otwarte/przymknięte/zamknięte), kierunek wzroku, ruchy brwi/ust oraz zmiany między klatkami (mikroekspresje). ` +
      `Zwróć TYLKO obiekt JSON, bez komentarza, dokładnie w tym kształcie:
{
  "face_detected": boolean,
  "dominant_emotion": "happy|sad|angry|surprised|neutral|fearful|disgusted",
  "confidence": 0-100,
  "emotions": {"happy":0-1,"sad":0-1,"angry":0-1,"surprised":0-1,"neutral":0-1,"fearful":0-1,"disgusted":0-1},
  "eye_state": "open|half|closed",
  "gaze": "center|left|right|up|down|away",
  "micro_expressions": ["krótkie etykiety, np. brow_raise, lip_press, smile_onset"],
  "valence": -1..1,
  "arousal": 0..1,
  "engagement": 0..1
}
Jeśli na żadnej klatce nie ma twarzy: {"face_detected": false, "dominant_emotion":"neutral", "confidence":0, "emotions":{}}.`;

    const userContent: any[] = [
      { type: "text", text: `Przeanalizuj tę sekwencję ${frames.length} klatek i zwróć wyłącznie JSON.` },
      ...frames.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    let lastStatus = 500;
    let lastErr = "no_provider";

    for (const p of providers) {
      if (!p.key) continue;
      try {
        const aiRes = await fetch(p.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: p.model,
            temperature: 0.2,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
          }),
        });

        if (!aiRes.ok) {
          lastStatus = aiRes.status;
          lastErr = `${p.name}: HTTP ${aiRes.status}`;
          console.error("[ai-vision-mood]", lastErr, (await aiRes.text()).slice(0, 160));
          continue; // spróbuj kolejnego darmowego silnika
        }

        const json = await aiRes.json();
        const content: string = json?.choices?.[0]?.message?.content ?? "";
        const args = extractJson(content);
        if (!args) {
          lastErr = `${p.name}: no_json`;
          console.error("[ai-vision-mood]", lastErr, content.slice(0, 160));
          continue;
        }

        const emotion = VALID_EMOTIONS.includes(args.dominant_emotion)
          ? args.dominant_emotion
          : "neutral";

        return new Response(
          JSON.stringify({
            faceDetected: !!args.face_detected,
            dominantEmotion: emotion,
            confidence: Math.round(Math.max(0, Math.min(100, Number(args.confidence) || 0))),
            emotions: args.emotions ?? {},
            eyeState: args.eye_state ?? null,
            gaze: args.gaze ?? null,
            microExpressions: Array.isArray(args.micro_expressions) ? args.micro_expressions.slice(0, 8) : [],
            valence: typeof args.valence === "number" ? Math.max(-1, Math.min(1, args.valence)) : null,
            arousal: args.arousal != null ? clamp01(args.arousal) : null,
            engagement: args.engagement != null ? clamp01(args.engagement) : null,
            framesCount: frames.length,
            model: p.model,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (e) {
        lastErr = `${p.name}: ${e instanceof Error ? e.message : "net"}`;
        console.error("[ai-vision-mood]", lastErr);
      }
    }

    const status = lastStatus === 429 ? 429 : lastStatus === 402 ? 402 : 502;
    const msg = status === 429
      ? "Limit zapytań AI. Spróbuj za chwilę."
      : status === 402
        ? "Wyczerpane darmowe kredyty AI."
        : "Silnik wizji chwilowo niedostępny.";
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ai-vision-mood] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
