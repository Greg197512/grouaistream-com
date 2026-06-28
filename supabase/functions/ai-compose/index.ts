import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a music composition AI. Given a description of a song, output a JSON musical score that a browser synthesizer can render.

OUTPUT FORMAT (JSON only, no markdown):
{
  "bpm": number (60-180),
  "key": string ("C","D","E","F","G","A","B"),
  "scale": "major" | "minor" | "pentatonic" | "blues",
  "duration": number (seconds),
  "swing": number (0-0.3, shuffle feel),
  "sections": [
    {
      "name": "intro" | "verse" | "chorus" | "bridge" | "outro",
      "startBeat": number,
      "lengthBeats": number,
      "energy": number (0-1)
    }
  ],
  "melody": [
    { "note": "C4", "beat": 0, "dur": 0.5, "vel": 0.8 }
  ],
  "chords": [
    { "notes": ["C3","Eb3","G3"], "beat": 0, "dur": 4 }
  ],
  "bass": [
    { "note": "C2", "beat": 0, "dur": 1, "vel": 0.9 }
  ],
  "drums": {
    "kick": [0, 4, 8, 12],
    "snare": [2, 6, 10, 14],
    "hihat": [0, 1, 2, 3, 4, 5, 6, 7],
    "clap": []
  },
  "synth": {
    "melody": "sawtooth" | "square" | "sine" | "triangle",
    "pad": "sine" | "triangle",
    "bass": "sawtooth" | "sine",
    "filterCutoff": number (200-8000),
    "reverbMix": number (0-0.6)
  }
}

RULES:
- All beat numbers are in quarter notes (beat 0 = start, beat 4 = second bar in 4/4)
- Generate at least 8 bars (32 beats in 4/4)
- Melody notes should follow the scale and create a catchy motif that repeats with variations
- Chords should follow common progressions (i-iv-v, I-IV-V-I, ii-V-I, etc.)
- Bass follows root notes of chords with occasional walks
- Drums match the genre (4-on-floor for house/disco, boom-bap for hip-hop, sparse for ambient)
- Energy should build through sections
- For lo-fi: slow, jazzy chords, sparse drums, warm sine melody
- For electronic/house: 4-on-floor kick, offbeat hihat, filtered saw lead
- For rock: power chords, driving bass, heavy kick+snare
- For ambient: long pad chords, no drums, slow sine melody
- Keep it musical! Real progressions, not random notes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { prompt, duration, genre, mood, tempo, intensity } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "No prompt" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const userMsg = `Create a ${duration || 30} second ${genre || "electronic"} track.
Style: ${mood || "energetic"}, ${intensity || "balanced"} production, ${tempo || "medium"} tempo.
Description: ${prompt}
Return ONLY valid JSON, no explanation.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        max_tokens: 4000,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ai-compose] AI error:", res.status, err);
      throw new Error(`AI gateway: ${res.status}`);
    }

    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from potential markdown wrapper
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1];
    raw = raw.trim();

    let score: any;
    try {
      score = JSON.parse(raw);
    } catch {
      console.error("[ai-compose] Failed to parse:", raw.substring(0, 200));
      throw new Error("AI returned invalid JSON");
    }

    // Sanitize & validate
    score.bpm = Math.max(60, Math.min(180, score.bpm || 120));
    score.duration = Math.max(8, Math.min(120, score.duration || duration || 30));
    if (!score.melody) score.melody = [];
    if (!score.chords) score.chords = [];
    if (!score.bass) score.bass = [];
    if (!score.drums) score.drums = { kick: [], snare: [], hihat: [], clap: [] };
    if (!score.synth) score.synth = { melody: "sawtooth", pad: "triangle", bass: "sine", filterCutoff: 2000, reverbMix: 0.3 };

    return new Response(JSON.stringify({ ok: true, score }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[ai-compose] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
