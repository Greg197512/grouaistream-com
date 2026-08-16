// GROUAI HUB — engine-learn
// Zamyka pętlę uczenia silnika muzycznego. Dwa źródła nauki:
//   1) engine_learning (hub) — każda generacja loguje plan + ocenę tekstu 1-10.
//   2) KATALOG bvstv (20k+ utworów) — czego naprawdę tworzymy najwięcej
//      (tożsamość brzmieniowa). Z kluczem service_role widzi też UKRYTE utwory;
//      z anonimowym — tylko publiczne. Wynik cache'owany w hub_config (6 h).
// Nie trenujemy modelu Suno — uczymy NASZ planer (in-context learning).
//
//   action "lessons" { language }     → przykłady + tożsamość katalogu do promptu.
//   action "stats"   { pin }          → pulpit: lekcje, jakość, trend, tagi, katalog.
//   action "refresh_catalog" { pin }  → wymuś odświeżenie cache katalogu.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function cfg(key: string): Promise<string> {
  const { data } = await admin().from("hub_config").select("value").eq("key", key).maybeSingle();
  return (data?.value as string) || "";
}
async function setCfg(key: string, value: string) {
  await admin().from("hub_config").upsert({ key, value }, { onConflict: "key" });
}

function chorusLine(lyrics: string): string {
  if (!lyrics) return "";
  const m = lyrics.match(/\[chorus\][^\n]*\n\s*([^\[\n]+)/i);
  const line = (m?.[1]
    || lyrics.split(/\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("[") && l.length > 6)
    || "").trim();
  return line.slice(0, 90);
}
function shortTags(tags: string, n = 7): string {
  return String(tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, n).join(", ");
}
function topCounts(vals: (string | null | undefined)[], limit: number): { name: string; n: number }[] {
  const f: Record<string, number> = {};
  for (const v of vals) {
    const k = (v || "").trim();
    if (!k) continue;
    f[k.toLowerCase()] = (f[k.toLowerCase()] || 0) + 1;
  }
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, n]) => ({ name, n }));
}

type Catalog = { total: number; sample: number; source: "full" | "public"; genres: { name: string; n: number }[]; moods: { name: string; n: number }[]; at: number };

// Pobiera katalog z bvstv (service_role → też ukryte; anon → tylko publiczne).
// Cache w hub_config: engine_catalog_cache (6 h), żeby nie odpytywać przy każdej generacji.
async function getCatalog(force = false): Promise<Catalog | null> {
  if (!force) {
    try {
      const cached = JSON.parse((await cfg("engine_catalog_cache")) || "null");
      if (cached && Date.now() - cached.at < 6 * 3600_000) return cached as Catalog;
    } catch { /* brak/zły cache */ }
  }
  const url = (await cfg("bvstv_url")).replace(/\/$/, "");
  const svc = (await cfg("bvstv_service_key")).trim();
  const anon = (await cfg("bvstv_anon_key")).trim();
  const key = svc || anon;
  if (!url || !key) return null;
  try {
    // Próbka do rozkładu gatunków/nastrojów + prawdziwy licznik z Content-Range.
    const r = await fetch(`${url}/rest/v1/tracks?select=genre,mood&order=created_at.desc&limit=2000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as { genre: string | null; mood: string | null }[];
    const cr = r.headers.get("content-range") || ""; // np. "0-1999/20123"
    const total = parseInt(cr.split("/")[1] || "", 10) || rows.length;
    const cat: Catalog = {
      total,
      sample: rows.length,
      source: svc ? "full" : "public",
      genres: topCounts(rows.map((x) => x.genre), 12),
      moods: topCounts(rows.map((x) => x.mood), 8),
      at: Date.now(),
    };
    await setCfg("engine_catalog_cache", JSON.stringify(cat));
    return cat;
  } catch { return null; }
}

type Row = { plan: any; language: string; engine: string; created_at: string; prompt?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = admin();
  let body: Record<string, any> = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* */ } }
  const action = body.action || new URL(req.url).searchParams.get("action") || "lessons";

  try {
    // ── LESSONS: przykłady z najlepszych planów + tożsamość katalogu ──
    if (action === "lessons") {
      const language = String(body.language || "pl").toLowerCase();
      const { data } = await db.from("engine_learning")
        .select("plan, language, created_at")
        .eq("language", language)
        .order("created_at", { ascending: false })
        .limit(60);
      const scored = ((data as Row[]) || [])
        .map((r) => ({
          score: Number(r.plan?.lyrics_score) || 0,
          tags: shortTags(r.plan?.tags || ""),
          hook: chorusLine(String(r.plan?.lyrics || "")),
        }))
        .filter((x) => x.tags)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .filter((x) => x.score >= 7 || x.hook);

      const parts: string[] = [];
      if (scored.length) {
        const lines = scored.map((x, i) =>
          `${i + 1}. tagi: ${x.tags}${x.hook ? ` | refren: „${x.hook}"` : ""}${x.score ? ` (nasza ocena ${x.score}/10)` : ""}`);
        parts.push(`NASZE NAJLEPSZE UTWORY (${language}) — trzymaj TEN poziom tagów i chwytliwości refrenu, ale twórz NOWY, oryginalny utwór:\n${lines.join("\n")}`);
      }
      const cat = await getCatalog();
      if (cat && (cat.genres.length || cat.moods.length)) {
        const g = cat.genres.slice(0, 6).map((x) => x.name).join(", ");
        const m = cat.moods.slice(0, 4).map((x) => x.name).join(", ");
        parts.push(`TOŻSAMOŚĆ NASZEGO KATALOGU (${cat.total}+ utworów) — najczęstsze gatunki: ${g}${m ? `; nastroje: ${m}` : ""}. Trzymaj to nasze rozpoznawalne brzmienie, chyba że użytkownik prosi wyraźnie o coś innego.`);
      }
      return json({ ok: true, lessons: parts.join("\n\n"), count: scored.length, catalog: cat ? { total: cat.total, source: cat.source } : null });
    }

    // ── STATS: pulpit „Nauka silnika" (PIN wspólny z panelami) ──
    if (action === "stats" || action === "refresh_catalog") {
      const pin = String(body.pin || "");
      if (!pin || pin !== (await cfg("pricing_pin"))) return json({ error: "bad_pin" }, 403);
      const cat = await getCatalog(action === "refresh_catalog");
      if (action === "refresh_catalog") return json({ ok: true, catalog: cat });

      const { data } = await db.from("engine_learning")
        .select("plan, language, engine, created_at, prompt")
        .order("created_at", { ascending: false })
        .limit(600);
      const rows = ((data as Row[]) || []);
      const total = rows.length;
      const now = Date.now();
      const scoreOf = (r: Row) => Number(r.plan?.lyrics_score) || 0;
      const scored = rows.filter((r) => scoreOf(r) > 0);
      const avg = (a: Row[]) => a.length ? +(a.reduce((s, r) => s + scoreOf(r), 0) / a.length).toFixed(2) : 0;
      const within = (r: Row, days: number) => (now - new Date(r.created_at).getTime()) <= days * 86400000;

      const byLang: Record<string, number> = {};
      const byEngine: Record<string, number> = {};
      const tagFreq: Record<string, number> = {};
      for (const r of rows) {
        byLang[r.language || "?"] = (byLang[r.language || "?"] || 0) + 1;
        byEngine[r.engine || "?"] = (byEngine[r.engine || "?"] || 0) + 1;
        if (scoreOf(r) >= 8) {
          for (const t of String(r.plan?.tags || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)) {
            if (/studio|master|mix|hi-fi|hifi|radio-ready|clear vocals|quality|stereo|loud/.test(t)) continue;
            tagFreq[t] = (tagFreq[t] || 0) + 1;
          }
        }
      }
      // Seria dzienna jakości (14 dni) — do wykresu „jakość w czasie" vs Suno.
      const dayMap: Record<string, { sum: number; n: number }> = {};
      for (const r of scored) {
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        (dayMap[d] ||= { sum: 0, n: 0 });
        dayMap[d].sum += scoreOf(r); dayMap[d].n += 1;
      }
      const daily: { day: string; avg: number; n: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
        const b = dayMap[d];
        daily.push({ day: d.slice(5), avg: b ? +(b.sum / b.n).toFixed(2) : 0, n: b?.n || 0 });
      }

      const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([tag, n]) => ({ tag, n }));
      const recent = rows.slice(0, 10).map((r) => ({
        language: r.language, engine: r.engine, score: scoreOf(r) || null,
        title: String(r.plan?.title || "").slice(0, 60),
        tags: shortTags(r.plan?.tags || "", 5),
        hook: chorusLine(String(r.plan?.lyrics || "")),
        at: r.created_at,
      }));

      return json({
        ok: true,
        total, scored: scored.length,
        avg_all: avg(scored), avg_7d: avg(scored.filter((r) => within(r, 7))), avg_30d: avg(scored.filter((r) => within(r, 30))),
        by_language: byLang, by_engine: byEngine, top_tags: topTags, recent, daily,
        catalog: cat,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
