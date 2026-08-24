// GrouAI Radio Talk — dwie osoby rozmawiające na antenie (news + opowiadania).
// Skrypt: darmowy model (Pollinations). Głos: dwa różne głosy neuronowe (Piper/VITS).
// Wszystko po stronie przeglądarki — bez tokenów, bez kosztów.

import { freeChat } from "@/lib/freeChat";
import { neuralSynth, neuralVoiceFor, NEURAL_VOICE_ALT } from "@/lib/neuralTts";

export type TalkKind = "news" | "story";
export interface TalkLine { speaker: "A" | "B"; text: string }

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
      ? `Napisz żywą, naturalną rozmowę dwojga prowadzących radia GrouAI — ${hosts.a} i ${hosts.b} — o TYM, CO CIEKAWEGO W MUZYCE I KULTURZE (gatunki, trendy, ciekawostki, klimat na dziś). Ma być energicznie, z humorem i lekko, jak prawdziwa audycja. NIE wymyślaj konkretnych nieprawdziwych faktów, dat ani nazwisk — mów ogólnie i barwnie.`
      : `Write a lively, natural conversation between two GrouAI radio hosts — ${hosts.a} and ${hosts.b} — about WHAT'S INTERESTING IN MUSIC AND CULTURE (genres, trends, fun facts, today's vibe). Energetic, warm, with humor, like a real show. Do NOT invent specific false facts, dates or names — keep it general and colorful.`;
  }
  return pl
    ? `Napisz krótkie, wciągające OPOWIADANIE w formie rozmowy dwojga prowadzących GrouAI — ${hosts.a} i ${hosts.b} — którzy snują wspólnie nastrojową historię na antenie (np. nocna podróż, tajemnica, wspomnienie). Ma wciągać, mieć klimat i puentę.`
    : `Write a short, gripping STORY as a conversation between two GrouAI hosts — ${hosts.a} and ${hosts.b} — weaving an atmospheric tale on air (e.g. a night journey, a mystery, a memory). Make it immersive with a payoff.`;
}

/** Wygeneruj skrypt rozmowy (6–12 wymian) w formacie A:/B:. */
export async function generateTalkScript(kind: TalkKind, lang = "pl"): Promise<TalkLine[]> {
  const hosts = HOSTS[lang.slice(0, 2)] || HOSTS.pl;
  const brief = briefFor(kind, lang, hosts);
  const prompt =
    `${brief}\n\nFORMAT: każda linia zaczyna się od "A:" (${hosts.a}) albo "B:" (${hosts.b}). ` +
    `8–12 krótkich wymian, bez didaskaliów, bez opisów, tylko wypowiedzi. Bez cudzysłowów.`;
  const raw = await freeChat(prompt, [], lang);
  if (!raw) return [];
  const lines: TalkLine[] = [];
  for (const l of raw.split("\n")) {
    const m = l.trim().match(/^([AB])\s*[:\-–)]\s*(.+)$/i);
    if (m) lines.push({ speaker: m[1].toUpperCase() as "A" | "B", text: m[2].trim() });
  }
  // Fallback: gdy model nie użył A:/B:, rozdziel zdania naprzemiennie.
  if (lines.length < 2) {
    const parts = raw.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 2).slice(0, 10);
    parts.forEach((p, i) => lines.push({ speaker: i % 2 === 0 ? "A" : "B", text: p.trim() }));
  }
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
    if (!wav) continue;
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
    await new Promise((r) => setTimeout(r, 260)); // naturalna pauza między wypowiedziami
  }
  opts?.onLine?.(null);
}
