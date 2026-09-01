// batch-fill-covers — masowe uzupełnianie okładek utworom, które ich nie mają.
// Panel admina (CoverFillPanel) wołał tę funkcję, ale nigdy nie została
// utworzona — przycisk "Uruchom batch" nie miał czego wywołać. Ta funkcja
// nie duplikuje logiki wyszukiwania/generowania okładek — dla każdego utworu
// woła już istniejącą, sprawdzoną `ai-cover` (iTunes/MusicBrainz/Deezer →
// AI fallback z promptem wymuszającym profesjonalną, fotorealistyczną
// jakość → gradient placeholder jako ostateczność) przez tryb "auto_trigger"
// (ten sam, którego funkcja już używa dla wywołań automatycznych).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Tylko admin — batch generuje realny koszt (AI + zapytania zewnętrzne).
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* domyślne wartości */ }
  const limit = Math.max(1, Math.min(200, Number(body?.limit) || 50));
  const onlyRecent = body?.onlyRecent !== false;
  const allowAI = body?.allowAI !== false;

  let query = admin
    .from("tracks")
    .select("id, title, artist")
    .or("cover_url.is.null,cover_url.eq.,cover_url.ilike.%picsum.photos%,cover_url.ilike.%placeholder%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (onlyRecent) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", cutoff);
  }

  const { data: tracks, error: tracksErr } = await query;
  if (tracksErr) return json({ error: tracksErr.message }, 500);

  const list = tracks || [];
  const results = { original: 0, ai: 0, placeholder: 0, failed: 0 };

  await mapWithConcurrency(list, CONCURRENCY, async (t) => {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/ai-cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ trackId: t.id, source: "auto_trigger", allow_ai_fallback: allowAI }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) { results.failed++; return; }
      if (j.skipped) return;
      if (j.source === "original") results.original++;
      else if (j.source === "ai-generated") results.ai++;
      else results.placeholder++;
    } catch {
      results.failed++;
    }
  });

  return json({ ok: true, processed: list.length, results });
});
