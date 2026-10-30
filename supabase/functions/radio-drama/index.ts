import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { synthesizeTTS } from "../_shared/tts.ts";
import { putToR2 } from "../_shared/r2.ts";
import { chatGateway } from "../_shared/chatGateway.ts";

// GROUAI — radio-drama: SŁUCHOWISKO co 3 godziny, w czterech językach (PL, EN, NL, UA).
// Każde uruchomienie (cron co 3 h) bierze temat z rotacji, pisze scenariusz w każdym
// języku (bramka: OmniRoute → Gemini → OpenRouter), czyta jednym narratorem na język
// (darmowy neuronowy Edge TTS) i wstawia odcinki na początek radio_schedule.
//
// BEZPIECZEŃSTWO KOSZTÓW:
// - bez RADIO_DRAMA_ENABLED=1 funkcja nic nie robi (nie wydaje ani grosza),
// - wymaga nagłówka x-cron-secret = RADIO_DRAMA_SECRET (nikt z zewnątrz jej nie odpali),
// - odcinki w bazie nie są kasowane poza poprzednim odcinkiem tego samego języka.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const LANGS = ["pl", "en", "nl", "ua"] as const;
type Lang = (typeof LANGS)[number];

// Głos narratora na język (jeden głos na język — bez zamiany w trakcie odcinka).
const VOICE: Record<Lang, { voice: string; lang: string; label: string }> = {
  pl: { voice: "pl-PL-MarekNeural", lang: "pl", label: "Słuchowisko" },
  en: { voice: "en-US-AndrewNeural", lang: "en", label: "Radio drama" },
  nl: { voice: "nl-NL-MaartenNeural", lang: "nl", label: "Hoorspel" },
  ua: { voice: "uk-UA-OstapNeural", lang: "uk", label: "Радіоспектакль" },
};

// Rotacja tematów — każdy wpis to krótki opis fabuły (język scenariusza wybiera funkcja).
const TOPICS = [
  "Stara latarnia morska, ostatni dyżurny i list wrzucony w butelce, który przypłynął po czterdziestu latach.",
  "Nocna taksówka w deszczowym mieście i pasażer, który prosi o zawiezienie do miejsca, którego już nie ma.",
  "Muzyk, który odzyskuje słuch tylko na jeden wieczór i odkrywa, że dźwięki mają kolory.",
  "Dwie siostry, które po latach znajdują w strychu magnetofon z nagraniem ich dzieciństwa.",
  "Mała radiostacja na szczycie góry, której jedyną słuchaczką jest starsza kobieta z kotem.",
  "Detektyw od zaginionych piosenek, który szuka utworu, o którym nikt nie pamięta poza jednym słuchaczem.",
  "Podróż pociągiem nocnym, w którym każdy wagon to inna epoka muzyki, a konduktor zna wszystkie tytuły.",
  "Robot-DJ, który uczy się czuć rytm po tym, jak ktoś zapomniał go wyłączyć na pustej plaży.",
];

const WORDS_PER_SCRIPT = 520; // ok. 3,5 minuty mowy

function systemPrompt(lang: Lang): string {
  const names: Record<Lang, string> = { pl: "polskim", en: "angielskim", nl: "niderlandzkim", ua: "ukraińskim" };
  return (
    `Piszesz słuchowisko radiowe w języku ${names[lang]} dla stacji GrouAI Stream. ` +
    `Jeden narrator prowadzi całą opowieść (bez wielu głosów, bez didaskaliów). ` +
    `Styl: ciepły, obrazowy, z naturalnymi pauzami przecinkami i kropkami. ` +
    `Długość około ${WORDS_PER_SCRIPT} słów. Pierwsza linia: „TYTUŁ: …”, potem sam tekst do czytania na głos. ` +
    `Bez markdown, bez wypunktowań, bez nawiasów, bez linków, bez emoji. Nic nie zmyślaj o prawdziwych osobach.`
  );
}

function splitTitle(raw: string): { title: string; script: string } {
  const text = (raw || "").trim();
  const m = text.match(/^\s*(?:TYTUŁ|TITLE|TITEL|НАЗВА)\s*:\s*(.+)$/im);
  if (!m) return { title: "", script: text };
  const title = m[1].trim();
  const script = text.replace(m[0], "").trim();
  return { title, script };
}

async function writeScript(lang: Lang, topic: string): Promise<{ title: string; script: string } | null> {
  const gw = chatGateway();
  if (!gw) return null;
  const resp = await fetch(gw.url, {
    method: "POST",
    headers: { ...gw.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: gw.model,
      temperature: 0.8,
      max_tokens: 1800,
      messages: [
        { role: "system", content: systemPrompt(lang) },
        { role: "user", content: `Temat: ${topic}` },
      ],
    }),
  });
  if (!resp.ok) {
    console.warn(`[radio-drama] ${lang}: bramka ${resp.status}`);
    return null;
  }
  const json = await resp.json();
  const raw = String(json.choices?.[0]?.message?.content || "");
  const { title, script } = splitTitle(raw);
  if (script.length < 400) return null;
  return { title: title || topic.slice(0, 60), script };
}

// Tnie tekst na kawałki pod limit TTS i skleja bajty MP3.
function chunkText(text: string, max = 2400): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).length > max && cur) { out.push(cur.trim()); cur = s; }
    else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (Deno.env.get("RADIO_DRAMA_ENABLED") !== "1") return json({ skipped: true, reason: "disabled" });
  const secret = Deno.env.get("RADIO_DRAMA_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorized" }, 401);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const slot = Math.floor(Date.now() / (3 * 60 * 60 * 1000));
    const topic = TOPICS[slot % TOPICS.length];
    const slotIso = new Date(slot * 3 * 60 * 60 * 1000).toISOString().slice(0, 13).replace(/[:T]/g, "-");
    const results: Record<string, unknown> = {};

    for (const lang of LANGS) {
      const cfg = VOICE[lang];
      const written = await writeScript(lang, topic);
      if (!written) { results[lang] = { ok: false, reason: "script" }; continue; }

      const parts = chunkText(written.script);
      const pieces: Uint8Array[] = [];
      let engine = "";
      for (const part of parts) {
        const { audio, engine: e } = await synthesizeTTS(part, { voice: cfg.voice, lang: cfg.lang });
        pieces.push(audio);
        engine = e;
      }
      const total = pieces.reduce((n, p) => n + p.length, 0);
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const p of pieces) { bytes.set(p, off); off += p.length; }

      const audioUrl = await putToR2({
        body: bytes,
        folder: "radio-audio/dramas",
        fileName: `${slotIso}-${lang}.mp3`,
        contentType: "audio/mpeg",
      });
      if (!audioUrl) { results[lang] = { ok: false, reason: "upload" }; continue; }

      const title = `🎭 ${cfg.label}: ${written.title}`;
      await supabase.from("radio_schedule").delete()
        .eq("item_type", "announcement").eq("lang", lang).ilike("custom_title", "🎭 %");
      const { data: minRow } = await supabase.from("radio_schedule")
        .select("position").order("position", { ascending: true }).limit(1).maybeSingle();
      const minPos = (minRow?.position as number | undefined) ?? 0;
      const durationSec = Math.min(900, Math.max(60, Math.round(written.script.length / 14)));
      await supabase.from("radio_schedule").insert({
        item_type: "announcement", custom_title: title, custom_audio_url: audioUrl,
        custom_duration: durationSec, position: minPos - 1, lang,
      });

      results[lang] = { ok: true, title: written.title, audio_url: audioUrl, engine, chunks: parts.length };
    }

    return json({ success: true, topic, slot: slotIso, results });
  } catch (error) {
    console.error("radio-drama error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown" }, 500);
  }
});
