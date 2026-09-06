// Odtwarzanie mediów: gramy BEZPOŚREDNIO z hosta (R2 itd.).
//
// Sprawdzone: pliki na R2 (pub-…r2.dev) serwują się z poprawnym typem
// (206 audio/mpeg) i grają w <audio> wprost — dodatkowe proxowanie przez
// /api/media dokładało tylko drugi „przeskok" (Vercel→R2→Vercel→telefon),
// przez co na telefonie audio potrafiło „ładować się bez końca". Dlatego
// proxiedMediaUrl zwraca teraz URL BEZ ZMIAN (gramy z oryginalnego źródła).
//
// Endpoint /api/media zostaje dostępny (np. do diagnostyki / hostów bez CORS),
// ale nie wpinamy go w ścieżkę odtwarzania.
export function proxiedMediaUrl(url: string | null | undefined): string | null {
  return url ?? null;
}
