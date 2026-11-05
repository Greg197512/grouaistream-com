// Głos prezenterki Novy — bez żadnych kluczy:
//  1. Piper (neuronowy, liczony w przeglądarce słuchacza, darmowy, MIT): kobiece głosy
//     Gosia (PL), Amy (EN), Nathalie (NL), Lada (UA). Model pobiera się raz w tle i zostaje w pamięci przeglądarki.
//  2. Plik z /api/voice (Google TTS; Azure/ElevenLabs, jeśli kiedyś dojdą klucze) — gdy Piper jeszcze się ładuje,
//     a na telefonie bez Wi-Fi (żeby nie zjadać pakietu danych pobieraniem modelu).
//  3. Kobiecy głos systemu (speechSynthesis).
// Jeden głos naraz.
import { neuralSynth } from "./neuralTts";

const PIPER_FEMALE: Record<string, string> = {
  pl: "pl_PL-gosia-medium",
  en: "en_US-amy-medium",
  nl: "nl_BE-nathalie-medium",
  ua: "uk_UA-lada-x_low",
};
const piperReady: Record<string, boolean> = {};
const piperLoading: Record<string, boolean> = {};

/** Czy wolno pobrać model Pipera (kilkadziesiąt MB): komputer albo telefon na Wi-Fi, bez trybu oszczędzania danych. */
export function piperAllowed(): boolean {
  if (typeof window === "undefined" || typeof WebAssembly === "undefined") return false;
  if (document.documentElement.getAttribute("data-lowpower") === "on") return false;
  const c = (navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }).connection;
  if (c?.saveData) return false;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return !mobile || c?.type === "wifi";
}

/** Pobierz w tle model głosu Novy dla języka (raz). */
export function prefetchNova(lang: string) {
  const voiceId = PIPER_FEMALE[lang] ?? PIPER_FEMALE.pl;
  if (piperReady[lang] || piperLoading[lang] || !piperAllowed()) return;
  piperLoading[lang] = true;
  neuralSynth("Hej.", lang, { voiceId })
    .then((b) => { piperReady[lang] = !!b; })
    .catch(() => { /* zostaje serwer */ })
    .finally(() => { piperLoading[lang] = false; });
}

function playUrl(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const a = new Audio(url);
    current = a;
    a.volume = 1;
    let done = false;
    const end = (v: boolean) => { if (done) return; done = true; clearTimeout(timer); if (current === a) current = null; resolve(v); };
    const timer = window.setTimeout(() => { try { a.pause(); } catch { /* */ } end(a.currentTime > 0.5); }, timeoutMs);
    a.onended = () => end(true);
    a.onerror = () => end(false);
    a.play().catch(() => end(false));
  });
}

let current: HTMLAudioElement | null = null;

const FEMALE = /female|zofia|paulina|ewa|agnieszka|jenny|aria|ava|samantha|zira|fenna|colette|polina|lesya|google (polski|nederlands|українська)|google us english/i;

function browserVoice(text: string, lang: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve(false);
    const code = lang === "ua" ? "uk" : lang;
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(code));
    u.voice = voices.find((v) => FEMALE.test(v.name)) ?? voices[0] ?? null;
    u.lang = u.voice?.lang ?? code;
    u.rate = 1.05;
    u.pitch = 1.08;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.speak(u);
  });
}

export function stopNova() {
  if (current) { try { current.pause(); current.src = ""; } catch { /* */ } current = null; }
  try { window.speechSynthesis?.cancel(); } catch { /* */ }
}

/** Czyta kwestię Novy. Zwraca, czym mówiła: "piper", "server", "browser" albo "none". */
export async function speakNova(text: string, lang: string, timeoutMs = 20000): Promise<"piper" | "server" | "browser" | "none"> {
  stopNova();
  if (piperReady[lang]) {
    const wav = await Promise.race([neuralSynth(text, lang, { voiceId: PIPER_FEMALE[lang] ?? PIPER_FEMALE.pl }), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
    if (wav) {
      const url = URL.createObjectURL(wav);
      const ok = await playUrl(url, timeoutMs);
      URL.revokeObjectURL(url);
      if (ok) return "piper";
    }
  } else prefetchNova(lang); // następnym razem już neuronowo
  if (await playUrl(`/api/voice?l=${encodeURIComponent(lang)}&t=${encodeURIComponent(text)}`, timeoutMs)) return "server";
  return (await browserVoice(text, lang)) ? "browser" : "none";
}
