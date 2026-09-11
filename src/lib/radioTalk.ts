// GrouAI Radio Talk — dwie osoby rozmawiające na antenie (news + opowiadania).
// Skrypt: darmowy model (Pollinations). Głos: dwa różne głosy neuronowe (Piper/VITS).
// Wszystko po stronie przeglądarki — bez tokenów, bez kosztów.

import { freeChat } from "@/lib/freeChat";
import { neuralSynth, neuralVoiceFor, NEURAL_VOICE_ALT } from "@/lib/neuralTts";
import { supabase } from "@/integrations/supabase/client";

export type TalkKind = "news" | "story";
export interface TalkLine { speaker: "A" | "B"; text: string }

// Zapasowa mowa: wbudowany silnik przeglądarki (Web Speech API). Zero pobierania,
// zero CSP — gwarantuje, że „opowiadania idą" nawet gdy model neuronowy nie wstanie.
function langCode(lang: string): string {
  const l = lang.slice(0, 2);
  return l === "en" ? "en-US" : l === "nl" ? "nl-NL" : l === "ua" ? "uk-UA" : "pl-PL";
}
function speakWebSpeech(text: string, lang: string, female: boolean): Promise<void> {
  return new Promise((resolve) => {
    try {
      const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
      if (!synth || typeof SpeechSynthesisUtterance === "undefined") return resolve();
      const u = new SpeechSynthesisUtterance(text);
      const code = langCode(lang);
      u.lang = code;
      const voices = synth.getVoices().filter((v) => v.lang?.toLowerCase().startsWith(code.slice(0, 2)));
      if (voices.length) u.voice = female && voices[1] ? voices[1] : voices[0];
      u.pitch = female ? 1.25 : 0.9;  // różnicuj dwoje prowadzących
      u.rate = 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    } catch { resolve(); }
  });
}
/** Zatrzymaj wszelką mowę przeglądarki (przy przerwaniu rozmowy). */
export function stopSpeaking(): void { try { (window as any).speechSynthesis?.cancel(); } catch { /* */ } }

// Zapasowy skrypt, gdy darmowy model tekstu nie odpowie — rozmowa i tak ruszy.
function fallbackScript(kind: TalkKind, lang: string, hosts: { a: string; b: string }): TalkLine[] {
  const pl = lang.slice(0, 2) === "pl";
  if (kind === "news") {
    return pl ? [
      { speaker: "A", text: `Witajcie w serwisie GrouAI, z tej strony ${hosts.a}.` },
      { speaker: "B", text: `I ${hosts.b}. Świat pędzi — technologia, muzyka i sztuczna inteligencja zmieniają wszystko wokół nas.` },
      { speaker: "A", text: `Coraz więcej twórców korzysta z AI, żeby tworzyć muzykę bez granic.` },
      { speaker: "B", text: `A słuchacze? Wybierają to, co naprawdę porusza — i to buduje naszą społeczność.` },
      { speaker: "A", text: `Zostańcie z nami, wracamy do muzyki.` },
    ] : [
      { speaker: "A", text: `Welcome to GrouAI news, this is ${hosts.a}.` },
      { speaker: "B", text: `And ${hosts.b}. The world is moving fast — tech, music and AI are reshaping everything.` },
      { speaker: "A", text: `More creators use AI to make music without limits.` },
      { speaker: "B", text: `And listeners pick what truly moves them — that's our community.` },
      { speaker: "A", text: `Stay with us, back to the music.` },
    ];
  }
  return pl ? [
    { speaker: "A", text: `Była taka noc, ${hosts.b}, kiedy miasto zasnęło, a muzyka dopiero się budziła.` },
    { speaker: "B", text: `Pamiętam. Neony odbijały się w mokrym asfalcie, a z głośników sączył się dźwięk, którego nikt wcześniej nie słyszał.` },
    { speaker: "A", text: `To był utwór stworzony przez AI — ale czułeś w nim człowieka.` },
    { speaker: "B", text: `Bo za każdym wyborem stał ktoś prawdziwy. I może właśnie o to chodzi.` },
    { speaker: "A", text: `Zostańcie z nami — ta historia gra dalej.` },
  ] : [
    { speaker: "A", text: `There was a night, ${hosts.b}, when the city fell asleep and the music woke up.` },
    { speaker: "B", text: `I remember. Neon in the wet asphalt, and a sound no one had heard before.` },
    { speaker: "A", text: `A track made by AI — yet you could feel a human in it.` },
    { speaker: "B", text: `Because a real person stood behind every choice. Maybe that's the point.` },
    { speaker: "A", text: `Stay with us — the story plays on.` },
  ];
}

// ── Opowiadania z NASZEGO bloga ──────────────────────────────────────────────
// Co 3 h antena bierze świeży wpis (rotacja po „koszyku 3-godzinnym", więc u
// wszystkich słuchaczy leci ten sam — radio jest zsynchronizowane). Tekst wpisu
// jest oczyszczany z HTML/Markdown i czytany przez dwoje prowadzących.
const STORY_BUCKET_MS = 3 * 60 * 60 * 1000;

function stripToText(raw: string): string {
  return (raw || "")
    .replace(/```[\s\S]*?```/g, " ")           // bloki kodu
    .replace(/<[^>]+>/g, " ")                    // HTML
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")       // obrazki md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")     // linki md → tekst
    .replace(/[#>*_`~|]+/g, " ")                  // znaczniki md
    .replace(/&[a-z]+;/gi, " ")                   // encje
    .replace(/\s+/g, " ")
    .trim();
}

function sentencesOf(text: string, max: number): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 320)
    .slice(0, max);
}

/** Pobierz opowiadanie = świeży wpis z bloga (seo_blog_posts), rotacja co 3 h. */
export async function fetchBlogStory(lang = "pl"): Promise<TalkLine[]> {
  const hosts = HOSTS[lang.slice(0, 2)] || HOSTS.pl;
  const pl = lang.slice(0, 2) === "pl";
  try {
    const { data } = await supabase
      .from("seo_blog_posts")
      .select("title, content")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(40);
    const rows = (Array.isArray(data) ? data : []).filter((r: any) => stripToText(r?.content).length > 200);
    if (!rows.length) return [];
    const idx = Math.floor(Date.now() / STORY_BUCKET_MS) % rows.length; // zsynchronizowany wybór
    const post: any = rows[idx];
    const body = sentencesOf(stripToText(post.content), 12);
    if (body.length < 2) return [];
    const lines: TalkLine[] = [];
    lines.push({ speaker: "A", text: pl
      ? `A teraz opowiadanie z bloga GrouAI: „${post.title}". Z tej strony ${hosts.a} i ${hosts.b}.`
      : `And now a feature from the GrouAI blog: "${post.title}". This is ${hosts.a} and ${hosts.b}.` });
    body.forEach((s, i) => lines.push({ speaker: i % 2 === 0 ? "B" : "A", text: s }));
    lines.push({ speaker: "B", text: pl
      ? `Cały wpis przeczytacie na blogu GrouAI. Wracamy do muzyki.`
      : `Read the full post on the GrouAI blog. Back to the music.` });
    return lines.slice(0, 16);
  } catch { return []; }
}

// ── News o świecie z YouTube ─────────────────────────────────────────────────
export interface NewsVideo { videoId: string; title: string; author: string }

/** Świeży (dzienny) filmik z wiadomościami ze świata z YouTube — do odtworzenia w radiu. */
export async function fetchWorldNews(lang = "pl"): Promise<NewsVideo | null> {
  const day = new Date().toISOString().slice(0, 10); // dzienna rotacja
  const q = lang.slice(0, 2) === "pl"
    ? `wiadomości ze świata dziś ${day}`
    : lang.slice(0, 2) === "ua" ? `новини світу сьогодні ${day}`
    : lang.slice(0, 2) === "nl" ? `wereldnieuws vandaag ${day}`
    : `world news today ${day}`;
  try {
    const r = await fetch(`/api/youtube-search?cat=25&order=date&days=3&q=${encodeURIComponent(q)}`);
    if (!r.ok) return null;
    const data = await r.json();
    const items = (data?.items || []) as NewsVideo[];
    const hit = items.find((x) => x.videoId);
    return hit || null;
  } catch { return null; }
}

const HOSTS: Record<string, { a: string; b: string }> = {
  pl: { a: "Marek", b: "Ola" },
  en: { a: "Mark", b: "Olivia" },
  nl: { a: "Mark", b: "Sophie" },
  ua: { a: "Марко", b: "Оля" },
};

function briefFor(kind: TalkKind, lang: string, hosts: { a: string; b: string }): string {
  const pl = lang.startsWith("pl");
  if (kind === "news") {
    return pl
      ? `Poprowadź krótki SERWIS INFORMACYJNY radia GrouAI — ${hosts.a} i ${hosts.b} — o TYM, CO DZIEJE SIĘ NA ŚWIECIE (świat, technologia, nauka, kultura, sport, ciekawostki, nastrój dnia). Ton jak w prawdziwym radiowym serwisie: rzeczowo, żywo, z krótkim komentarzem prowadzących. WAŻNE: nie zmyślaj konkretnych „breaking news", dat, liczb ani nazwisk, których nie jesteś pewien — mów o tematach i zjawiskach ogólnie, tak by brzmiało wiarygodnie i aktualnie, bez wprowadzania w błąd.`
      : `Host a short GrouAI NEWS BULLETIN — ${hosts.a} and ${hosts.b} — about WHAT'S HAPPENING IN THE WORLD (world, technology, science, culture, sport, curiosities, today's mood). Tone like a real radio news segment: factual, lively, with brief host commentary. IMPORTANT: do NOT invent specific breaking news, dates, numbers or names you're unsure of — speak about topics and phenomena in general so it sounds credible and current without misleading.`;
  }
  return pl
    ? `Napisz krótkie, wciągające OPOWIADANIE w formie rozmowy dwojga prowadzących GrouAI — ${hosts.a} i ${hosts.b} — którzy snują wspólnie nastrojową historię na antenie (np. nocna podróż, tajemnica, wspomnienie). Ma wciągać, mieć klimat i puentę.`
    : `Write a short, gripping STORY as a conversation between two GrouAI hosts — ${hosts.a} and ${hosts.b} — weaving an atmospheric tale on air (e.g. a night journey, a mystery, a memory). Make it immersive with a payoff.`;
}

/** Wygeneruj skrypt rozmowy (6–12 wymian) w formacie A:/B:. */
export async function generateTalkScript(kind: TalkKind, lang = "pl"): Promise<TalkLine[]> {
  const hosts = HOSTS[lang.slice(0, 2)] || HOSTS.pl;
  // Opowiadanie = świeży wpis z NASZEGO bloga (rotacja co 3 h). Gdy bloga nie
  // ma / nie wstał — spadamy do generatora AI, a dalej do wbudowanego skryptu.
  if (kind === "story") {
    const fromBlog = await fetchBlogStory(lang);
    if (fromBlog.length >= 2) return fromBlog;
  }
  const brief = briefFor(kind, lang, hosts);
  const prompt =
    `${brief}\n\nFORMAT: każda linia zaczyna się od "A:" (${hosts.a}) albo "B:" (${hosts.b}). ` +
    `8–12 krótkich wymian, bez didaskaliów, bez opisów, tylko wypowiedzi. Bez cudzysłowów.`;
  const raw = await freeChat(prompt, [], lang);
  const lines: TalkLine[] = [];
  if (raw) {
    for (const l of raw.split("\n")) {
      const m = l.trim().match(/^([AB])\s*[:\-–)]\s*(.+)$/i);
      if (m) lines.push({ speaker: m[1].toUpperCase() as "A" | "B", text: m[2].trim() });
    }
    // Fallback: gdy model nie użył A:/B:, rozdziel zdania naprzemiennie.
    if (lines.length < 2) {
      const parts = raw.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 2).slice(0, 10);
      parts.forEach((p, i) => lines.push({ speaker: i % 2 === 0 ? "A" : "B", text: p.trim() }));
    }
  }
  // Ostateczny fallback: model tekstu milczy → wbudowany skrypt, rozmowa i tak ruszy.
  if (lines.length < 2) return fallbackScript(kind, lang, hosts);
  return lines.slice(0, 14);
}

/** Odtwórz rozmowę dwoma głosami. onLine → do napisów; przerywalne przez shouldStop(). */
export async function speakTalk(
  lines: TalkLine[],
  lang = "pl",
  opts?: { onLine?: (l: TalkLine | null) => void; shouldStop?: () => boolean },
): Promise<void> {
  const l2 = lang.slice(0, 2);
  const voiceA = neuralVoiceFor(l2);                          // głos męski (host A)
  const voiceB = NEURAL_VOICE_ALT[l2] || neuralVoiceFor(l2);  // głos żeński (host B) / fallback
  for (const line of lines) {
    if (opts?.shouldStop?.()) break;
    opts?.onLine?.(line);
    const wav = await neuralSynth(line.text, lang, { voiceId: line.speaker === "A" ? voiceA : voiceB });
    if (wav) {
      const url = URL.createObjectURL(wav);
      try {
        await new Promise<void>((resolve) => {
          const a = new Audio(url);
          a.onended = () => resolve();
          a.onerror = () => resolve();
          a.play().catch(() => resolve());
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      // Głos neuronowy niedostępny (model/WASM nie wstał) → wbudowany głos przeglądarki.
      await speakWebSpeech(line.text, lang, line.speaker === "B");
    }
    await new Promise((r) => setTimeout(r, 260)); // naturalna pauza między wypowiedziami
  }
  opts?.onLine?.(null);
}
