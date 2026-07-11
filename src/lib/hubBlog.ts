// Świeże wpisy blogowe generowane na hubie GrouAI (bvstv nie ma klucza OpenRouter,
// więc natywny generator zamarł ~15.06). Hub dokłada nowe artykuły; stare 190 wpisów
// z bvstv zostają nietknięte. Odczyt anonimowy (RLS: tylko is_published = true).
const HUB_REST = "https://bmwtydwpevzhbdplilbr.supabase.co/rest/v1/hub_blog_posts";
const HUB_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtd3R5ZHdwZXZ6aGJkcGxpbGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjU3MTUsImV4cCI6MjA5ODYwMTcxNX0.8zWvxj5xQcKNXAlog7NkwBtmOT4BbRI8EnUiQ17LN7I";

const HEADERS = { apikey: HUB_ANON, Authorization: `Bearer ${HUB_ANON}` };

// Wpis huba w kształcie zgodnym z interfejsem blogu (pola *_en/_nl/_ua = null → fallback na PL).
export interface HubBlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[] | null;
  cover_url: string | null;
  created_at: string;
  view_count: number;
  is_hub: true;
}

const LIST_COLS =
  "id,slug,title,description,category,tags,cover_url,created_at,view_count";

/** Lista świeżych wpisów huba (do sekcji „Nowe” / kafelków). Nigdy nie rzuca. */
export async function fetchHubBlogList(limit = 30): Promise<HubBlogPost[]> {
  try {
    const r = await fetch(
      `${HUB_REST}?select=${LIST_COLS}&is_published=eq.true&order=created_at.desc&limit=${limit}`,
      { headers: HEADERS },
    );
    if (!r.ok) return [];
    const rows = (await r.json()) as any[];
    return (rows || []).map((p) => ({ ...p, content: "", is_hub: true as const }));
  } catch {
    return [];
  }
}

/** Pojedynczy wpis huba po slug (fallback gdy nie ma go w bvstv). Nigdy nie rzuca. */
export async function fetchHubBlogPost(slug: string): Promise<HubBlogPost | null> {
  try {
    const r = await fetch(
      `${HUB_REST}?select=*&slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&limit=1`,
      { headers: HEADERS },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as any[];
    if (!rows?.length) return null;
    return { ...rows[0], is_hub: true as const };
  } catch {
    return null;
  }
}
