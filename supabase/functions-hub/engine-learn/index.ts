// GROUAI HUB — engine-learn
// Zamyka pętlę uczenia silnika muzycznego. Dane pochodzą z tabeli
// engine_learning (każda generacja zapisuje: prompt, plan, tagi, tekst,
// ocenę tekstu 1-10, język, silnik). Nie trenujemy modelu Suno — uczymy
// NASZ „mózg" (planer) na naszych najlepszych utworach (in-context learning).
//
//   action "lessons" { language }  → zwraca zwięzłe przykłady naszych
//                                     najlepszych planów do wklejenia w prompt.
//   action "stats"   { pin }       → pulpit: ile lekcji, średnia jakość,
//                                     trend, top tagi, ostatnie przykłady.
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

// Wyciąga jedną, chwytliwą linię refrenu z tekstu (do przykładu-lekcji).
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

type Row = { plan: any; language: string; engine: string; created_at: string; prompt?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = admin();
  let body: Record<string, any> = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* */ } }
  const action = body.action || new URL(req.url).searchParams.get("action") || "lessons";

  try {
    // ── LESSONS: przykłady naszych najlepszych planów w danym języku ──
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
      if (scored.length === 0) return json({ ok: true, lessons: "", count: 0 });
      const lines = scored.map((x, i) =>
        `${i + 1}. tagi: ${x.tags}${x.hook ? ` | refren: „${x.hook}"` : ""}${x.score ? ` (nasza ocena ${x.score}/10)` : ""}`);
      const lessons = `NAUKA — WZORUJ SIĘ NA NASZYCH NAJLEPSZYCH UTWORACH (${language}). Trzymaj TEN poziom precyzji tagów i chwytliwości refrenu, ale stwórz NOWY, oryginalny utwór (nie kopiuj słów):\n${lines.join("\n")}`;
      return json({ ok: true, lessons, count: scored.length });
    }

    // ── STATS: pulpit „Nauka silnika" (PIN wspólny z panelami) ──
    if (action === "stats") {
      const pin = String(body.pin || "");
      if (!pin || pin !== (await cfg("pricing_pin"))) return json({ error: "bad_pin" }, 403);
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
            // pomijamy generyczne tagi jakości — chcemy zwycięskie brzmienia
            if (/studio|master|mix|hi-fi|hifi|radio-ready|clear vocals|quality|stereo|loud/.test(t)) continue;
            tagFreq[t] = (tagFreq[t] || 0) + 1;
          }
        }
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
        total,
        scored: scored.length,
        avg_all: avg(scored),
        avg_7d: avg(scored.filter((r) => within(r, 7))),
        avg_30d: avg(scored.filter((r) => within(r, 30))),
        by_language: byLang,
        by_engine: byEngine,
        top_tags: topTags,
        recent,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
