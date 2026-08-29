// GROUAI — darmowe TTS bez kosztów.
// Najlepsza jakość (neuronowa, głosy Marek/Christopher itd.): Azure Speech w
//   DARMOWYM progu F0 (500 tys. znaków/mies. gratis) — aktywne, gdy w projekcie
//   ustawisz sekrety AZURE_SPEECH_KEY + AZURE_SPEECH_REGION.
// Zawsze-działający fallback bez klucza: Google Translate TTS (wyraźne, robotyczne).
// Zwraca bajty mp3 + nazwę użytego silnika.

export interface TTSOptions {
  /** Głos neuronowy Azure, np. "pl-PL-MarekNeural", "en-US-ChristopherNeural". */
  voice: string;
  /** Kod języka dla Google (fallback), np. "pl", "en". */
  lang: string;
  /** Tempo dla Azure SSML, np. "-8%", "+3%". Domyślnie "+0%". */
  rate?: string;
  /** Wysokość dla Azure SSML, np. "-2Hz". Domyślnie "+0Hz". */
  pitch?: string;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// ── Azure Speech (neuronowe, darmowy próg F0) ────────────────────────────────
async function azureTTS(text: string, opts: TTSOptions): Promise<Uint8Array> {
  const key = Deno.env.get("AZURE_SPEECH_KEY");
  const region = Deno.env.get("AZURE_SPEECH_REGION");
  if (!key || !region) throw new Error("no-azure-key");

  const lang = opts.voice.slice(0, 5);
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${opts.voice}'><prosody rate='${opts.rate || "+0%"}' pitch='${opts.pitch || "+0Hz"}'>` +
    `${xmlEscape(text)}</prosody></voice></speak>`;

  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "grouai-tts",
    },
    body: ssml,
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`azure tts ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const b = new Uint8Array(await r.arrayBuffer());
  if (b.length < 500) throw new Error("azure empty");
  return b;
}

// ── Google Translate TTS (fallback, bez klucza, ≤200 znaków/żądanie) ──────────
function splitForGoogle(text: string, max = 200): string[] {
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?…])\s+/);
  let cur = "";
  const push = (s: string) => { const t = s.trim(); if (t) out.push(t); };
  for (const s of sentences) {
    if ((cur + " " + s).trim().length <= max) { cur = (cur + " " + s).trim(); continue; }
    push(cur); cur = "";
    if (s.length <= max) { cur = s; continue; }
    let w = "";
    for (const word of s.split(/\s+/)) {
      if ((w + " " + word).trim().length > max) { push(w); w = word; }
      else w = (w + " " + word).trim();
    }
    cur = w;
  }
  push(cur);
  return out;
}

async function googleTTS(text: string, lang: string): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for (const c of splitForGoogle(text)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(c.slice(0, 200))}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`google tts ${r.status}`);
    parts.push(new Uint8Array(await r.arrayBuffer()));
    await new Promise((res) => setTimeout(res, 150));
  }
  const total = parts.reduce((n, b) => n + b.length, 0);
  if (total < 500) throw new Error("google empty");
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of parts) { out.set(b, off); off += b.length; }
  return out;
}

/**
 * Syntezuje mowę: najpierw neuronowy Azure (gdy jest darmowy klucz), a gdy go
 * brak lub padnie — zawsze-działający Google TTS. Zwraca bajty mp3 + engine.
 */
export async function synthesizeTTS(text: string, opts: TTSOptions): Promise<{ audio: Uint8Array; engine: string }> {
  try {
    const audio = await azureTTS(text, opts);
    return { audio, engine: `azure:${opts.voice}` };
  } catch (_) { /* brak klucza / błąd → Google */ }
  const audio = await googleTTS(text, opts.lang);
  return { audio, engine: "google" };
}
