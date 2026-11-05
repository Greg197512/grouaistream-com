// Głos prezenterki Novy: plik z /api/voice (ElevenLabs → Azure → Google, cache CDN),
// a gdy serwer nie odpowie — kobiecy głos przeglądarki. Jeden głos naraz.

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

/** Czyta kwestię Novy. Zwraca, czym mówiła: "server" (plik), "browser" albo "none". */
export async function speakNova(text: string, lang: string, timeoutMs = 20000): Promise<"server" | "browser" | "none"> {
  stopNova();
  const url = `/api/voice?l=${encodeURIComponent(lang)}&t=${encodeURIComponent(text)}`;
  const ok = await new Promise<boolean>((resolve) => {
    const a = new Audio(url);
    current = a;
    a.volume = 1;
    let done = false;
    const end = (v: boolean) => { if (done) return; done = true; clearTimeout(timer); resolve(v); };
    const timer = window.setTimeout(() => { try { a.pause(); } catch { /* */ } end(a.currentTime > 0.5); }, timeoutMs);
    a.onended = () => end(true);
    a.onerror = () => end(false);
    a.play().catch(() => end(false));
  });
  if (current && !ok) current = null;
  if (ok) { current = null; return "server"; }
  return (await browserVoice(text, lang)) ? "browser" : "none";
}
