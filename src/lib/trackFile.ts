// Pliki utworów z menu „…”: pobieranie, offline i linki do udostępniania.
// R2 nie wysyła nagłówka CORS, więc fetch() z przeglądarki i atrybut `download` nie działają wprost —
// idziemy przez własne /api/media (ta sama domena), które przy ?dl=1 każe przeglądarce zapisać plik.

const PROXY_HOSTS = new Set([
  "pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev",
  "cdn1.suno.ai", "cdn2.suno.ai", "cdn.suno.ai", "audiopipe.suno.ai",
  "replicate.delivery", "pbxt.replicate.delivery",
  "tempfile.aiquickdraw.com", "audiostream.api.box",
]);

export const SITE = "https://grouaistream.com";

function hostOf(url: string): string | null {
  try { return new URL(url).host; } catch { return null; }
}

/** Adres z tej samej domeny (przez /api/media), gdy host nie daje CORS; inaczej bez zmian. */
export function sameOriginMediaUrl(url: string, opts?: { download?: boolean; name?: string }): string {
  const h = hostOf(url);
  if (!h || !PROXY_HOSTS.has(h)) return url;
  const q = new URLSearchParams({ u: url });
  if (opts?.download) { q.set("dl", "1"); if (opts.name) q.set("name", opts.name); }
  return `/api/media?${q.toString()}`;
}

/** Ładny link do utworu (z podglądem w komunikatorach) zamiast surowego pliku. */
export const trackShareUrl = (trackId: string) => `${SITE}/?play=${encodeURIComponent(trackId)}`;
export const trackGiftUrl = (trackId: string) => `${SITE}/prezent/${encodeURIComponent(trackId)}`;

function clickLink(href: string, download?: string, newTab = false) {
  const a = document.createElement("a");
  a.href = href;
  if (download) a.download = download;
  if (newTab) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Zapisz plik utworu na dysku / w telefonie. Zwraca false, gdy dało się tylko otworzyć w nowej karcie. */
export async function downloadTrackFile(url: string, name: string): Promise<boolean> {
  const proxied = sameOriginMediaUrl(url, { download: true, name });
  if (proxied !== url) { clickLink(proxied, name); return true; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const ext = (new URL(url).pathname.match(/\.([a-z0-9]{2,4})$/i)?.[1] || "mp3").toLowerCase();
    const obj = URL.createObjectURL(blob);
    clickLink(obj, `${name}.${ext}`);
    setTimeout(() => URL.revokeObjectURL(obj), 10_000);
    return true;
  } catch {
    clickLink(url, undefined, true); // nie wyrzucaj słuchacza z aplikacji — nowa karta
    return false;
  }
}
