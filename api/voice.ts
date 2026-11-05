/**
 * Głos prezenterki Novy (GrouaRadio) — jeden spójny, kobiecy głos w 4 językach.
 *
 *   GET /api/voice?l=pl&t=<tekst>  → audio/mpeg (cache CDN 30 dni: te same zapowiedzi nie są generowane drugi raz)
 *
 * Silniki po kolei (pierwszy dostępny):
 *  1. ElevenLabs — gdy w Vercel jest `ELEVENLABS_API_KEY` (opcjonalnie `NOVA_ELEVEN_VOICE_ID`), model wielojęzyczny.
 *  2. Azure Neural — gdy są `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (darmowy próg F0): Zofia / Ava / Fenna / Polina.
 *  3. Google TTS — zawsze, bez klucza (głos kobiecy, prostszy).
 * Bezpieczeństwo: tylko krótkie teksty (≤ 400 znaków) przechodzące filtr treści prezenterki.
 */
import { safeForAir } from "../src/lib/radioHost";

export const config = { runtime: "edge" };

const env = (k: string): string | undefined => {
  const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[k];
  return v && v.trim() ? v.trim() : undefined;
};

type Lang = "pl" | "en" | "nl" | "ua";
const AZURE_VOICE: Record<Lang, string> = { pl: "pl-PL-ZofiaNeural", en: "en-US-AvaMultilingualNeural", nl: "nl-NL-FennaNeural", ua: "uk-UA-PolinaNeural" };
const GOOGLE_LANG: Record<Lang, string> = { pl: "pl", en: "en", nl: "nl", ua: "uk" };
// Rachel (ElevenLabs, ciepły kobiecy głos) — można podmienić w Vercel: NOVA_ELEVEN_VOICE_ID.
const ELEVEN_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

async function eleven(text: string): Promise<Uint8Array> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("no-key");
  const voice = env("NOVA_ELEVEN_VOICE_ID") ?? ELEVEN_DEFAULT_VOICE;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`eleven ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function azure(text: string, lang: Lang): Promise<Uint8Array> {
  const key = env("AZURE_SPEECH_KEY"), region = env("AZURE_SPEECH_REGION");
  if (!key || !region) throw new Error("no-key");
  const voice = AZURE_VOICE[lang];
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voice.slice(0, 5)}'>` +
    `<voice name='${voice}'><prosody rate='+6%' pitch='+2%'>${xml(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "grouai-nova" },
    body: ssml,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`azure ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function chunks(text: string, max = 190): string[] {
  const out: string[] = [];
  let cur = "";
  for (const s of text.split(/(?<=[.!?…])\s+/)) {
    if ((cur + " " + s).trim().length <= max) { cur = (cur + " " + s).trim(); continue; }
    if (cur) out.push(cur);
    cur = s.length <= max ? s : s.slice(0, max);
  }
  if (cur) out.push(cur);
  return out;
}

async function google(text: string, lang: Lang): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for (const c of chunks(text)) {
    const r = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&tl=${GOOGLE_LANG[lang]}&client=tw-ob&q=${encodeURIComponent(c)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`google ${r.status}`);
    parts.push(new Uint8Array(await r.arrayBuffer()));
  }
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let o = 0;
  for (const b of parts) { out.set(b, o); o += b.length; }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const text = (u.searchParams.get("t") ?? "").replace(/\s+/g, " ").trim();
  const l = u.searchParams.get("l");
  const lang: Lang = l === "en" || l === "nl" || l === "ua" ? l : "pl";
  if (!text || text.length > 400 || !safeForAir(text)) return new Response("bad_text", { status: 400 });

  const engines: [string, () => Promise<Uint8Array>][] = [
    ["elevenlabs", () => eleven(text)],
    ["azure", () => azure(text, lang)],
    ["google", () => google(text, lang)],
  ];
  for (const [name, run] of engines) {
    try {
      const audio = await run();
      if (audio.length < 500) continue;
      return new Response(audio, {
        headers: {
          "content-type": "audio/mpeg",
          "x-tts-engine": name,
          "cache-control": "public, max-age=86400, s-maxage=2592000, immutable",
        },
      });
    } catch { /* następny silnik */ }
  }
  return new Response("tts_unavailable", { status: 503, headers: { "cache-control": "no-store" } });
}
