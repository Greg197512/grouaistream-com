// Darmowy tekst z AI (Pollinations) — bez kluczy, bez tokenów, bez kosztów.
// Wywoływane z przeglądarki użytkownika; nie obciąża naszego backendu.

function sanitize(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^["'“”„»«\s-]+|["'“”„»«\s]+$/g, "")
    .trim();
}

/**
 * Świeża ciekawostka o muzyce/kulturze danej epoki.
 * seed → inny wynik za każdym odświeżeniem. Zwraca null przy błędzie (fallback).
 */
export async function freshEraFact(
  eraLabel: string,
  vibe: string,
  seed?: number,
): Promise<string | null> {
  const s = seed ?? Math.floor(Math.random() * 1_000_000);
  const prompt =
    `Napisz jedną krótką (maksymalnie 200 znaków), PRAWDZIWĄ i powszechnie znaną ` +
    `ciekawostkę o muzyce lub kulturze epoki ${eraLabel} (klimat: ${vibe}). ` +
    `Po polsku. Zwróć wyłącznie samą ciekawostkę — bez wstępu, bez cudzysłowów, ` +
    `bez znaku nowej linii. Ma być ciekawa i konkretna.`;
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
