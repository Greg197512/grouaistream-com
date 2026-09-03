// Puszcza media z publicznego R2 (*.r2.dev) przez nasze /api/media, żeby audio
// zawsze grało (poprawny Content-Type, zakresy, same-origin = działa też
// crossfade). Wszystko inne (blob:, data:, Suno, YouTube, inne hosty) zwraca
// bez zmian. Idempotentne — nie owija dwa razy.
const R2_HOSTS = ["pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev"];

export function proxiedMediaUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  // Lokalne źródła i już zproxowane — bez zmian.
  if (/^(blob:|data:)/i.test(url)) return url;
  if (url.startsWith("/api/media")) return url;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : "https://grouaistream.com");
    if (R2_HOSTS.includes(u.host)) {
      return `/api/media?u=${encodeURIComponent(u.toString())}`;
    }
  } catch {
    return url;
  }
  return url;
}
