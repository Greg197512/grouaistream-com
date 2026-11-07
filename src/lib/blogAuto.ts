// Artykuły automatycznej redakcji (api/blog-auto) — własna baza sbmf, publiczny odczyt opublikowanych (RLS).
// Klucz anon jest publiczny z założenia (tylko SELECT opublikowanych + licznik wyświetleń).
const URL = "https://sbmfliylgpqyteezrrtn.supabase.co/rest/v1";
const KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibWZsaXlsZ3BxeXRlZXpycnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2Nzk4MzcsImV4cCI6MjEwODI1NTgzN30.ZqHbHa5ONd0oDyXg1-_OBzEOtXm3JGEIgNltWmgN1bo";
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };

const LIST_COLS = "id,slug,title,description,category,tags,cover_url,created_at,view_count,title_en,title_nl,title_ua,description_en,description_nl,description_ua";

export type AutoPost = Record<string, unknown> & { id: string; slug: string; created_at: string; view_count: number; auto: true };

export async function fetchAutoList(limit = 60): Promise<AutoPost[]> {
  try {
    const r = await fetch(`${URL}/blog_auto_posts?select=${LIST_COLS}&is_published=eq.true&order=created_at.desc&limit=${limit}`, { headers: H });
    if (!r.ok) return [];
    return ((await r.json()) as AutoPost[]).map((p) => ({ ...p, auto: true as const }));
  } catch { return []; }
}

export async function fetchAutoPost(slug: string): Promise<AutoPost | null> {
  try {
    const r = await fetch(`${URL}/blog_auto_posts?select=*&slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&limit=1`, { headers: H });
    if (!r.ok) return null;
    const [p] = (await r.json()) as AutoPost[];
    return p ? { ...p, auto: true as const } : null;
  } catch { return null; }
}

export function countAutoView(slug: string) {
  void fetch(`${URL}/rpc/blog_auto_view`, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ p_slug: slug }) }).catch(() => {});
}
