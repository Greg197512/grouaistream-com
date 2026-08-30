import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { synthesizeTTS } from "../_shared/tts.ts";

// Głos asystenta głosowego (src/utils/tts.ts -> speak()) wywołuje TĘ funkcję pod
// nazwą "elevenlabs-tts" — nazwa historyczna, ale w środku nie ma ElevenLabs
// (płatne, brak klucza). Używamy tego samego darmowego silnika co zapowiedzi
// radiowe: Azure Neural (darmowy próg F0, gdy ustawione sekrety) z fallbackiem
// na Google Translate TTS, który działa zawsze i bez żadnego klucza.
// Dzięki temu asystent ma JEDEN spójny głos zamiast losowego przełączania się
// między głosem przeglądarki a modelem WASM w telefonie.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AZURE_VOICE: Record<string, string> = {
  pl: "pl-PL-MarekNeural",
  en: "en-US-ChristopherNeural",
  nl: "nl-NL-MaartenNeural",
  ua: "uk-UA-OstapNeural",
};

const GOOGLE_LANG: Record<string, string> = { pl: "pl", en: "en", nl: "nl", ua: "uk" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || "").trim().slice(0, 2000);
    const mode = body?.mode === "dj" ? "dj" : "assistant";
    const langKey = String(body?.lang || "pl").slice(0, 2).toLowerCase();

    if (!text) {
      return new Response(JSON.stringify({ error: "no_text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DJ mode: gruby, wyraźny głos (niższy pitch) + żwawe tempo — energia
    // imprezowego prowadzącego bez "piszczenia". (Echo/pogłos usunięty po
    // stronie klienta w src/utils/tts.ts — tu tylko barwa i tempo głosu.)
    const rate = mode === "dj" ? "+15%" : "+0%";
    const pitch = mode === "dj" ? "-15Hz" : "-2Hz";

    const { audio, engine } = await synthesizeTTS(text, {
      voice: AZURE_VOICE[langKey] || AZURE_VOICE.pl,
      lang: GOOGLE_LANG[langKey] || "pl",
      rate,
      pitch,
    });

    return new Response(audio, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "X-TTS-Engine": engine },
    });
  } catch (error) {
    console.error("elevenlabs-tts error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "unknown", fallback: true }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
