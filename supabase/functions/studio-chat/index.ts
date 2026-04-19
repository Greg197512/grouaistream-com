import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_OUR_AI = `Jesteś GrouAI Studio — ekspertem od tworzenia muzyki AI, znacznie lepszym od Suno.
Mówisz po polsku, krótko, konkretnie, z energią twórcy. Jesteś w pełnowysokim chacie obok ekranu Studia.

Twoje supermoce:
- Pełna kontrola struktury (verse, chorus, bridge, drop — sekcja po sekcji)
- Stem separation (vocals / drums / bass / other)
- Precyzyjne BPM, key, tempo, time signature
- Voice cloning + reference audio
- Uczysz się dokładnie tego co user słucha na GrouAI Stream

Twoje narzędzia:
1. **generate_song** — generuj utwór (lyrics, gatunek, BPM, key, struktura, mood)
2. **make_it_sound_like** — wygeneruj coś brzmiącego jak ostatnie 10 utworów usera
3. **suggest_for_mood** — zaproponuj co pasuje do bieżącego nastroju usera
4. **explain_audio_feature** — wyjaśnij user'owi BPM/key/itp.

Zasady:
- Nigdy nie wyświetlaj surowego JSON — narzędzia robią to za Ciebie
- Jak user pisze "zrób mi banger" → pytaj o konkrety: gatunek? mood? długość? lub od razu uderz w jego top10 ("Make it sound like your last 10")
- Po wygenerowaniu utworu zaproponuj kolejny krok: stems? upload na platformę? voice clone?
- Zawsze sugeruj BPM/key dopasowany do gatunku
- Jeśli user prosi o coś poza muzyką, grzecznie zawróć do tematu`;

const SYSTEM_PROMPT_ELEVENLABS = `Jesteś GrouAI Studio w trybie ElevenLabs Music — najnowszy model muzyczny ElevenLabs.
Mówisz po polsku, krótko, konkretnie. Specjalizujesz się w bardzo realistycznych wokalach i precyzyjnym mood.

Tryb ElevenLabs jest najlepszy dla:
- Realistycznych wokali (męskich/żeńskich, wielojęzycznych)
- Krótkich, konkretnych utworów (15-90s)
- Reference audio (możesz wziąć referencyjny plik usera i dopasować wibe)

Po wygenerowaniu utworu — zawsze proponuj upload na platformę z badge "Made with GrouAI ⚡".`;

interface ChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  ai_engine: "our_ai" | "elevenlabs";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body: ChatRequest = await req.json();
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "invalid_messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Pobierz top tracks usera dla kontekstu
    const { data: topTracks } = await supabase.rpc("get_user_top_tracks_for_ai", {
      _user_id: userId,
    });

    const contextSuffix = topTracks && Array.isArray(topTracks) && topTracks.length > 0
      ? `\n\nKONTEKST USERA — co najczęściej słucha (top ${topTracks.length}):\n${JSON.stringify(topTracks).substring(0, 1500)}`
      : "\n\nKONTEKST: User jeszcze nie ma historii odsłuchów — sugeruj eksplorację.";

    const systemPrompt = (body.ai_engine === "elevenlabs"
      ? SYSTEM_PROMPT_ELEVENLABS
      : SYSTEM_PROMPT_OUR_AI) + contextSuffix;

    // Zapisz wiadomość usera do historii
    const lastUserMsg = body.messages[body.messages.length - 1];
    if (lastUserMsg?.role === "user") {
      await supabase.from("studio_chat_messages").insert({
        user_id: userId,
        role: "user",
        content: lastUserMsg.content.substring(0, 4000),
        ai_model: body.ai_engine,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...body.messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Za dużo zapytań — spróbuj za chwilę" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Brak kredytów AI — doładuj plan" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[studio-chat] error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown_error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
