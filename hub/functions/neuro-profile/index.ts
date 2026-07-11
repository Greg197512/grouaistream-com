// GROUAI HUB — neuro-profile: AI analizuje ZACHOWANIA użytkownika i buduje
// personalny „profil dopaminowy". Czyta dane, które JUŻ zbieramy (za zgodą):
// odsłuchy (listening_history), lajki (liked_songs), gatunki/nastroje utworów.
// NIE keyloguje i nie śledzi oczu — tylko interakcje muzyczne (RODO-friendly).
// Wynik: profil (gatunki, energia, pory dnia, wzorce nastroju, rekomendacje).
// Auth: JWT użytkownika z LIVE (bvstv) — analizuje TYLKO własne dane (RLS).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const hub = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await hub.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await live.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* puste OK */ }

  // Cache: jeśli świeży profil (<12h) i nie wymuszono — oddaj go.
  if (!body.force) {
    const { data: cached } = await hub.from("neuro_profiles").select("profile, summary, analyzed_at").eq("user_id", userId).maybeSingle();
    if (cached?.profile && Date.now() - new Date(cached.analyzed_at).getTime() < 12 * 3600_000) {
      return json({ ok: true, profile: cached.profile, summary: cached.summary, cached: true });
    }
  }

  // ── Zbierz zachowania (własne dane usera przez RLS) ──────────────────────────
  const [histRes, likeRes] = await Promise.all([
    live.from("listening_history").select("created_at, tracks(genre, mood, title, artist)").order("created_at", { ascending: false }).limit(200),
    live.from("liked_songs").select("tracks(genre, mood, title)").limit(120),
  ]);

  const genreCount: Record<string, number> = {};
  const moodCount: Record<string, number> = {};
  const hourCount: Record<string, number> = {};
  for (const r of (histRes.data as any[]) || []) {
    const t = r.tracks || {};
    if (t.genre) genreCount[t.genre] = (genreCount[t.genre] || 0) + 1;
    if (t.mood) moodCount[t.mood] = (moodCount[t.mood] || 0) + 1;
    try { const h = new Date(r.created_at).getHours(); const slot = h < 6 ? "noc" : h < 12 ? "rano" : h < 18 ? "popołudnie" : "wieczór"; hourCount[slot] = (hourCount[slot] || 0) + 1; } catch { /* */ }
  }
  const likedGenres: Record<string, number> = {};
  for (const r of (likeRes.data as any[]) || []) {
    const g = r.tracks?.genre; if (g) likedGenres[g] = (likedGenres[g] || 0) + 1;
  }
  const top = (o: Record<string, number>, n = 5) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const plays = ((histRes.data as any[]) || []).length;
  const likes = ((likeRes.data as any[]) || []).length;

  // Za mało danych → delikatny profil startowy.
  if (plays < 3 && likes < 2) {
    const profile = { status: "za mało danych", top_genres: [], hint: "Posłuchaj kilku utworów, a AI zbuduje Twój profil." };
    return json({ ok: true, profile, summary: "Twój neuro-profil dopiero się tworzy — słuchaj dalej 🎧", fresh: true });
  }

  const facts = {
    plays, likes,
    top_played_genres: top(genreCount),
    top_liked_genres: top(likedGenres),
    moods: top(moodCount),
    listening_times: top(hourCount, 4),
  };

  const apiKey = cfg["openrouter_api_key"];
  const models = (cfg["openrouter_models"] || cfg["openrouter_model"] || "meta-llama/llama-3.3-70b-instruct:free")
    .split(",").map((m) => m.trim()).filter(Boolean);

  const fallbackProfile = {
    top_genres: facts.top_played_genres.map(([g]) => g),
    energy: "średnia",
    moods: facts.moods.map(([m]) => m),
    listening_times: facts.listening_times.map(([t]) => t),
    dopamine_triggers: ["mocny drop", "chwytliwy refren"],
    recommendation: "Więcej " + (facts.top_played_genres[0]?.[0] || "energetycznej muzyki"),
  };

  if (!apiKey) {
    await hub.from("neuro_profiles").upsert({ user_id: userId, profile: fallbackProfile, summary: "Profil z Twoich odsłuchów i lajków.", model: "heuristic", analyzed_at: new Date().toISOString() });
    return json({ ok: true, profile: fallbackProfile, summary: "Profil z Twoich odsłuchów i lajków.", fresh: true });
  }

  const system = `Jesteś neuro-analitykiem muzycznym GrouAI. Na podstawie faktów o zachowaniu słuchacza (gatunki, nastroje, pory dnia, liczba odsłuchów/lajków) zbuduj jego „profil dopaminowy". Ciepło, po polsku, konkretnie. Zwróć TYLKO JSON: {"top_genres":["..."],"energy":"niska|średnia|wysoka","moods":["..."],"listening_times":["..."],"dopamine_triggers":["..."],"recommendation":"jedno zdanie co mu podać","summary":"2-3 zdania portretu słuchacza"}.`;
  const user = `FAKTY (JSON):\n${JSON.stringify(facts)}`;

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Neuro Profile" },
        body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 700, temperature: 0.6 }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const out = await res.json();
      const raw = out.choices?.[0]?.message?.content || "";
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } } }
      if (parsed && (parsed.top_genres || parsed.summary)) {
        const summary = parsed.summary || "Twój profil słuchacza.";
        await hub.from("neuro_profiles").upsert({ user_id: userId, profile: parsed, summary, model, analyzed_at: new Date().toISOString() });
        return json({ ok: true, profile: parsed, summary, model, fresh: true });
      }
    } catch { /* następny model */ }
  }

  await hub.from("neuro_profiles").upsert({ user_id: userId, profile: fallbackProfile, summary: "Profil z Twoich odsłuchów i lajków.", model: "heuristic", analyzed_at: new Date().toISOString() });
  return json({ ok: true, profile: fallbackProfile, summary: "Profil z Twoich odsłuchów i lajków.", fresh: true });
});
