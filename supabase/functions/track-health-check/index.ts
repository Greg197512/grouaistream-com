// Sprawdza, czy pliki utworów naprawdę istnieją (zapytanie o 1 bajt).
// Zwraca listę zepsutych; nic nie zmienia w bazie.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const offset = Number(url.searchParams.get("offset") || 0);
  const limit = Math.min(400, Number(url.searchParams.get("limit") || 200));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await db.from("tracks").select("id,title,audio_url").order("created_at").range(offset, offset + limit - 1);
  const rows = data || [];
  const bad: unknown[] = [];
  const stats: Record<string, number> = {};
  for (let i = 0; i < rows.length; i += 20) {
    await Promise.all(rows.slice(i, i + 20).map(async (t) => {
      let st = "nourl", ct = "";
      if (t.audio_url) {
        try {
          const r = await fetch(t.audio_url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(8000) });
          st = String(r.status); ct = r.headers.get("content-type") || "";
          await r.body?.cancel();
        } catch (e) { st = "err:" + String(e).slice(0, 40); }
      }
      const ok = (st === "200" || st === "206") && !ct.includes("text/html") && !ct.includes("xml");
      stats[ok ? "ok" : st + " " + ct] = (stats[ok ? "ok" : st + " " + ct] || 0) + 1;
      if (!ok) bad.push({ id: t.id, title: t.title, st, ct, u: (t.audio_url || "").slice(0, 90) });
    }));
  }
  return new Response(JSON.stringify({ checked: rows.length, stats, bad }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
