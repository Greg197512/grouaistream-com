// Darmowy tekst z AI (Pollinations) — bez kluczy, bez tokenów, bez kosztów.
// Wywoływane z przeglądarki użytkownika; nie obciąża naszego backendu.

function sanitize(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^["'“”„»«\s-]+|["'“”„»«\s]+$/g, "")
    .trim();
}

type FactLang = "pl" | "en" | "nl" | "ua";

const FACT_PROMPT: Record<FactLang, (era: string, vibe: string) => string> = {
  pl: (era, vibe) =>
    `Napisz jedną krótką (maksymalnie 200 znaków), PRAWDZIWĄ i powszechnie znaną ciekawostkę o muzyce lub kulturze epoki ${era} (klimat: ${vibe}). Po polsku. Zwróć wyłącznie samą ciekawostkę — bez wstępu, bez cudzysłowów, bez znaku nowej linii.`,
  en: (era, vibe) =>
    `Write one short (max 200 characters), TRUE and well-known fact about the music or culture of the ${era} era (vibe: ${vibe}). In English. Return only the fact itself — no intro, no quotes, no line breaks.`,
  nl: (era, vibe) =>
    `Schrijf één kort (max 200 tekens), WAAR en algemeen bekend weetje over de muziek of cultuur van het tijdperk ${era} (sfeer: ${vibe}). In het Nederlands. Geef alleen het weetje zelf — geen intro, geen aanhalingstekens, geen nieuwe regel.`,
  ua: (era, vibe) =>
    `Напиши один короткий (максимум 200 символів), ПРАВДИВИЙ і загальновідомий факт про музику чи культуру епохи ${era} (атмосфера: ${vibe}). Українською. Поверни лише сам факт — без вступу, без лапок, без нового рядка.`,
};

/**
 * Świeża ciekawostka o muzyce/kulturze danej epoki — w wybranym języku.
 * seed → inny wynik za każdym odświeżeniem. Zwraca null przy błędzie (fallback).
 */
export async function freshEraFact(
  eraLabel: string,
  vibe: string,
  seed?: number,
  lang: FactLang = "pl",
): Promise<string | null> {
  const s = seed ?? Math.floor(Math.random() * 1_000_000);
  const prompt = (FACT_PROMPT[lang] || FACT_PROMPT.pl)(eraLabel, vibe);
  // Domyślny model Pollinations (bez wymuszania konkretnego — najszersza dostępność).
  const url =
    `https://text.pollinations.ai/${encodeURIComponent(prompt)}?seed=${s}`;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return null;
    let txt = sanitize(await res.text());
    // Odetnij ewentualne przedłużenia i za długie odpowiedzi.
    txt = txt.split("\n")[0].slice(0, 300).trim();
    if (txt.length < 15 || /error|<html|not found/i.test(txt)) return null;
    return txt;
  } catch {
    return null;
  }
}
