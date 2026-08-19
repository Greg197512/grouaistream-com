// Darmowe generowanie grafiki (AI) — bez tokenów, bez kluczy, bez kosztów.
// Używamy Pollinations (model Flux) jako publicznego, bezpłatnego endpointu obrazów.
// Zwraca URL, który wstawiamy bezpośrednio jako <img src>. Renderowanie odbywa się
// po stronie przeglądarki użytkownika — nie obciąża naszego backendu ani budżetu.

/* Deterministyczny hash → stały seed = ten sam obraz przy każdym renderze (bez migotania). */
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h) % 1_000_000;
}

function clean(s: string | null | undefined): string {
  return (s || "")
    .replace(/[\n\r]+/g, " ")
    .replace(/[<>{}[\]|\\^~`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

interface AiCoverOpts {
  genre?: string | null;
  artist?: string | null;
  size?: number;
}

/**
 * Darmowa okładka AI dla utworu/karty/bloga.
 * Buduje opisowy prompt z tytułu + gatunku + artysty i zwraca gotowy URL obrazu.
 */
export function aiCoverUrl(title: string, opts: AiCoverOpts = {}): string {
  const { genre, artist, size = 600 } = opts;
  const t = clean(title) || "music";
  const g = clean(genre);
  const a = clean(artist);

  const parts = [
    `album cover art for "${t}"`,
    a ? `by ${a}` : "",
    g ? `${g} music` : "music",
    "cinematic, atmospheric, vibrant colors, high detail, professional artwork, no text, no watermark, no letters",
  ].filter(Boolean);

  const prompt = parts.join(", ");
  const seed = seedFrom(`${t}|${a}|${g}`);
  const enc = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${enc}?width=${size}&height=${size}&nologo=true&model=flux&seed=${seed}`;
}

/**
 * Darmowy obraz AI z dowolnego opisu (dla studia, bloga, banerów itd.).
 * width/height dowolne (np. 1200x630 pod cover bloga).
 */
export function aiImageUrl(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {}
): string {
  const { width = 1024, height = 1024, seed } = opts;
  const p = clean(prompt) || "abstract art";
  const s = seed ?? seedFrom(p);
  const enc = encodeURIComponent(`${p}, high detail, professional, no text, no watermark`);
  return `https://image.pollinations.ai/prompt/${enc}?width=${width}&height=${height}&nologo=true&model=flux&seed=${s}`;
}
