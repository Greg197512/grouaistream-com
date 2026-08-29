// Darmowy tekst z AI (Pollinations) — bez kluczy, bez tokenów, bez kosztów.
// Wywoływane z przeglądarki użytkownika; nie obciąża naszego backendu.

function sanitize(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^["'“”„»«\s-]+|["'“”„»«\s]+$/g, "")
    .trim();
}

type FactLang = "pl" | "en" | "nl" | "ua";

const FACT_PROMPT: Record<FactLang, (subject: string, vibe: string) => string> = {
  pl: (subject, vibe) =>
    `Napisz jedną krótką (maksymalnie 200 znaków), PRAWDZIWĄ i powszechnie znaną ciekawostkę o muzyce lub kulturze ${subject} (klimat: ${vibe}). Po polsku. Zwróć wyłącznie samą ciekawostkę — bez wstępu, bez cudzysłowów, bez znaku nowej linii.`,
  en: (subject, vibe) =>
    `Write one short (max 200 characters), TRUE and well-known fact about the music or culture of ${subject} (vibe: ${vibe}). In English. Return only the fact itself — no intro, no quotes, no line breaks.`,
  nl: (subject, vibe) =>
    `Schrijf één kort (max 200 tekens), WAAR en algemeen bekend weetje over de muziek of cultuur van ${subject} (sfeer: ${vibe}). In het Nederlands. Geef alleen het weetje zelf — geen intro, geen aanhalingstekens, geen nieuwe regel.`,
  ua: (subject, vibe) =>
    `Напиши один короткий (максимум 200 символів), ПРАВДИВИЙ і загальновідомий факт про музику чи культуру ${subject} (атмосфера: ${vibe}). Українською. Поверни лише сам факт — без вступу, без лапок, без нового рядка.`,
};

const SUBJECT_BY_LANG: Record<FactLang, (era: string, year?: number) => string> = {
  pl: (era, year) => (year ? `roku ${year}` : `epoki ${era}`),
  en: (era, year) => (year ? `the year ${year}` : `the ${era} era`),
  nl: (era, year) => (year ? `het jaar ${year}` : `het tijdperk ${era}`),
  ua: (era, year) => (year ? `${year} року` : `епохи ${era}`),
};

/**
 * Świeża ciekawostka o muzyce/kulturze danej epoki lub roku — w wybranym języku.
 * seed → inny wynik za każdym odświeżeniem. Zwraca null przy błędzie (fallback).
 */
export async function freshEraFact(
  eraLabel: string,
  vibe: string,
  seed?: number,
  lang: FactLang = "pl",
  year?: number,
): Promise<string | null> {
  const s = seed ?? Math.floor(Math.random() * 1_000_000);
  const subject = (SUBJECT_BY_LANG[lang] || SUBJECT_BY_LANG.pl)(eraLabel, year);
  const prompt = (FACT_PROMPT[lang] || FACT_PROMPT.pl)(subject, vibe);
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
