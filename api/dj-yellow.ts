// DJ Yellow — codziennie 2 nowe utwory elektroniczne (extended mix) z okładkami, do „Nowości” i radia.
//
// Jak działa (cron Vercel 2× dziennie; zapas, gdy pierwsza próba się nie uda):
//  1. Logowanie na konto „DJ Yellow” (grouarock+djyellow@gmail.com, hasło DJ_YELLOW_PASSWORD w Vercel) — utwory są jego.
//     Pierwszy raz: GET /api/dj-yellow?signup=1 zakłada konto (potwierdź mail na grouarock@gmail.com).
//  2. Strażnik: gdy dziś są już 2 utwory DJ Yellow → koniec (nigdy więcej niż 2 dziennie = koszt pod kontrolą).
//     Gdy dziś jest rozpoczęte zadanie (tabela generations, status queued) → tylko dokańczamy, bez nowego zadania.
//  3. Pomysł: asystent tekstowy AI (Pollinations, darmowy) dostaje listę naszych utworów elektronicznych i wymyśla
//     styl, nastrój i 2 tytuły; gdy AI milczy — żywy algorytm (podgatunki, nastroje, tytuły z list).
//  4. Suno (funkcja suno-generate, 1 zadanie = 2 utwory, instrumental, bez płatnego „ulepszacza” GPT).
//  5. Okładki: obraz AI (Pollinations, darmowy) w motywie DJ Yellow, zapas: generatywna okładka SVG. Zapis na R2.
//  6. Wpis do tracks (genre Electronic, artysta DJ Yellow) → sekcja „Nowe” i autopilot radia (blok electronic/klubowy).
//
// GET /api/dj-yellow?diag=1  — stan (bez kosztów).  GET /api/dj-yellow?run=1 — uruchom teraz (ten sam limit 2/dzień).
export const config = { maxDuration: 300 };

/* eslint-disable @typescript-eslint/no-explicit-any */
const env = (k: string) => process.env[k]?.trim() || undefined;
const SUPA = () => (env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL") ?? "https://bvstvawnigyczvofzhps.supabase.co").replace(/\/+$/, "");
const ANON = () => env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const ARTIST = "DJ Yellow";
// Konto artysty: e-mail stały (potwierdzenie trafia na grouarock@gmail.com), hasło tylko w Vercel (DJ_YELLOW_PASSWORD).
const DJ_EMAIL = () => env("DJ_YELLOW_EMAIL") ?? "grouarock+djyellow@gmail.com";
const PER_DAY = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function http(url: string, init: RequestInit & { timeout?: number } = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeout ?? 20000) });
  const text = await r.text();
  let data: any = null; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}
const rest = (jwt: string, path: string, init: RequestInit = {}) => http(`${SUPA()}/rest/v1/${path}`, {
  ...init, headers: { apikey: ANON(), authorization: `Bearer ${jwt}`, "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) },
});
const fn = (jwt: string, name: string, body: unknown, timeout = 60000) => http(`${SUPA()}/functions/v1/${name}`, {
  method: "POST", timeout, headers: { apikey: ANON(), authorization: `Bearer ${jwt}`, "content-type": "application/json" }, body: JSON.stringify(body),
});

/** Początek dzisiejszego dnia w Polsce (UTC ISO). */
function todayStartPl(): string {
  const now = new Date();
  const pl = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
  const diff = now.getTime() - pl.getTime();
  pl.setHours(0, 0, 0, 0);
  return new Date(pl.getTime() + diff).toISOString();
}

async function login(): Promise<{ jwt: string; uid: string } | { error: string }> {
  const email = DJ_EMAIL(), password = env("DJ_YELLOW_PASSWORD");
  if (!password) return { error: "brak DJ_YELLOW_PASSWORD w Vercel" };
  const r = await http(`${SUPA()}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON(), "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!r.ok) return { error: `logowanie: ${r.data?.error_description || r.data?.msg || r.status}` };
  return { jwt: r.data.access_token, uid: r.data.user.id };
}

// ── Pomysł na utwór: AI → zapas algorytm ─────────────────────────────────────
const SUB = ["melodic techno", "progressive house", "deep house", "synthwave", "uplifting trance", "future garage", "liquid drum and bass", "afro house", "electro house", "nu disco", "big room", "minimal techno"];
const MOODS = ["euphoric", "hypnotic", "sunrise", "night drive", "golden hour", "neon", "cosmic", "warm", "dark and driving", "dreamy"];
const WORDS_A = ["Golden", "Neon", "Solar", "Yellow", "Amber", "Electric", "Midnight", "Sunburst", "Lemon", "Honey", "Citrine", "Bright"];
const WORDS_B = ["Pulse", "Horizon", "Skyline", "Frequency", "Motion", "Signal", "Rush", "Dreams", "Waves", "Lights", "Orbit", "Fever"];
const pick = <T,>(a: T[], seed: number) => a[Math.abs(seed) % a.length];

type Idea = { style: string; mood: string; titles: [string, string]; cover: string; source: "ai" | "algorithm" };

function algorithmIdea(seed: number): Idea {
  const sub = pick(SUB, seed), mood = pick(MOODS, seed >> 3);
  const t1 = `${pick(WORDS_A, seed >> 5)} ${pick(WORDS_B, seed >> 7)}`, t2 = `${pick(WORDS_A, seed >> 9)} ${pick(WORDS_B, seed >> 11)}`;
  return {
    style: `${sub}, ${mood}, extended club mix, long intro and outro, big build-ups, euphoric drop, lush analog synths, crisp punchy drums, deep sub bass, wide stereo, pristine high fidelity, professional mastering`,
    mood, titles: [`${t1} (Extended Mix)`, `${t2 === t1 ? `${t1} II` : t2} (Extended Mix)`],
    cover: `${mood} ${sub} album cover, golden yellow neon light, abstract sound waves, DJ silhouette, cinematic, ultra detailed, vibrant`,
    source: "algorithm",
  };
}

async function aiIdea(catalog: string[], seed: number): Promise<Idea | null> {
  const sys = "Jesteś producentem muzyki elektronicznej i art directorem wytwórni. Odpowiadasz WYŁĄCZNIE JSON-em.";
  const user = `Artysta: DJ Yellow (żółty, słoneczny, euforyczny styl). Nasz katalog elektroniczny (inspiracja, nie kopiuj): ${catalog.slice(0, 25).join("; ") || "brak"}.
Wymyśl dzisiejsze wydanie: {"style":"styl dla Suno po angielsku, max 180 znaków, podgatunek elektroniki + extended club mix + brzmienie","mood":"1-2 słowa","titles":["tytuł 1","tytuł 2"],"cover":"opis okładki po angielsku, motyw żółty/złoty, bez tekstu, max 200 znaków"}. Tytuły krótkie, chwytliwe, angielskie, bez nazw innych artystów. Losowość: ${seed}.`;
  try {
    const r = await http("https://text.pollinations.ai/openai", {
      method: "POST", timeout: 25000, headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: sys }, { role: "user", content: user }], response_format: { type: "json_object" }, seed }),
    });
    const content = r.data?.choices?.[0]?.message?.content ?? (typeof r.data === "string" ? r.data : "");
    const j = JSON.parse(String(content).replace(/^```json|```$/g, "").trim());
    const titles = (Array.isArray(j.titles) ? j.titles : []).map((t: unknown) => String(t).replace(/["“”]/g, "").trim().slice(0, 60)).filter(Boolean);
    if (!j.style || titles.length < 2) return null;
    const ext = (t: string) => (/extended/i.test(t) ? t : `${t} (Extended Mix)`);
    return {
      style: `${String(j.style).slice(0, 150)}, extended club mix, pristine high fidelity, professional mastering`.slice(0, 200),
      mood: String(j.mood || "euphoric").slice(0, 30), titles: [ext(titles[0]), ext(titles[1])],
      cover: String(j.cover || "golden neon abstract electronic music cover").slice(0, 220), source: "ai",
    };
  } catch { return null; }
}

// ── Okładka: obraz AI (darmowy) → zapas SVG; zapis na R2 przez podpisany adres ─
function svgCover(title: string, seed: number): string {
  const rings = Array.from({ length: 9 }, (_, i) => `<circle cx="512" cy="560" r="${90 + i * 46}" fill="none" stroke="url(#g)" stroke-opacity="${(0.9 - i * 0.08).toFixed(2)}" stroke-width="${3 + (i % 3)}"/>`).join("");
  const bars = Array.from({ length: 48 }, (_, i) => { const h = 30 + Math.abs(Math.sin(seed + i * 0.7)) * 170; return `<rect x="${40 + i * 20}" y="${930 - h}" width="11" height="${h.toFixed(0)}" rx="5" fill="url(#g)" opacity="0.85"/>`; }).join("");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#3a2a00"/><stop offset="0.55" stop-color="#120d00"/><stop offset="1" stop-color="#000"/></radialGradient>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff59d"/><stop offset="0.5" stop-color="#FFD400"/><stop offset="1" stop-color="#FF8A00"/></linearGradient></defs>
<rect width="1024" height="1024" fill="url(#bg)"/>${rings}<circle cx="512" cy="560" r="70" fill="url(#g)"/>${bars}
<text x="512" y="150" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="92" font-weight="900" fill="url(#g)" letter-spacing="8">DJ YELLOW</text>
<text x="512" y="215" text-anchor="middle" font-family="Arial,sans-serif" font-size="38" fill="#fff8d0">${esc(title.slice(0, 40))}</text></svg>`;
}

async function putR2(jwt: string, body: Uint8Array | string, fileName: string, contentType: string): Promise<string | null> {
  const s = await fn(jwt, "r2-signed-url", { fileName, contentType, folder: "dj-yellow" }, 20000);
  const up = s.data?.uploadUrl ?? s.data?.signedUrl ?? s.data?.url;
  const pub = s.data?.publicUrl;
  if (!s.ok || !up || !pub) return null;
  const r = await fetch(up, { method: "PUT", headers: { "content-type": contentType }, body: body as any, signal: AbortSignal.timeout(60000) });
  return r.ok ? pub : null;
}

async function makeCover(jwt: string, idea: Idea, title: string, seed: number): Promise<string | null> {
  try {
    const prompt = `${idea.cover}, no text, no letters, square album artwork`;
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`, { signal: AbortSignal.timeout(60000) });
    const type = r.headers.get("content-type") ?? "";
    if (r.ok && type.startsWith("image/")) {
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > 20000) {
        const url = await putR2(jwt, buf, `${seed}.jpg`, type.includes("png") ? "image/png" : "image/jpeg");
        if (url) return url;
      }
    }
  } catch { /* zapas niżej */ }
  return putR2(jwt, svgCover(title, seed), `${seed}.svg`, "image/svg+xml");
}

async function archiveAudio(jwt: string, src: string, name: string): Promise<string | null> {
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length < 100000) return null;
    return putR2(jwt, buf, `${name}.mp3`, "audio/mpeg");
  } catch { return null; }
}

// ── Główna praca ────────────────────────────────────────────────────────────
async function run(deadline: number) {
  const auth = await login();
  if ("error" in auth) return { ok: false, step: "login", error: auth.error };
  const { jwt, uid } = auth;
  const since = todayStartPl();
  const done = await rest(jwt, `tracks?select=id,title&user_id=eq.${uid}&created_at=gte.${encodeURIComponent(since)}`);
  const doneList = Array.isArray(done.data) ? done.data : [];
  if (doneList.length >= PER_DAY) return { ok: true, step: "done-today", tracks: doneList };

  // Rozpoczęte dziś zadanie? Dokończ je zamiast płacić za nowe.
  const pend = await rest(jwt, `generations?select=id,replicate_id,prompt,title,lyrics,created_at&user_id=eq.${uid}&status=eq.queued&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1`);
  let gen = Array.isArray(pend.data) && pend.data[0] ? pend.data[0] : null;
  let idea: Idea;
  const seed = Math.floor(Date.now() / 86400000) * 7919 + doneList.length;

  if (gen) {
    try { idea = JSON.parse(gen.lyrics || "{}").idea; } catch { idea = algorithmIdea(seed); }
    if (!idea?.titles) idea = algorithmIdea(seed);
  } else {
    if (doneList.length > 0) return { ok: true, step: "partial-today", note: "dziś wydano już część — nowe zadanie jutro", tracks: doneList };
    const cat = await rest(jwt, `tracks?select=title,mood&genre=ilike.*electr*&order=created_at.desc&limit=40`);
    const catalog = (Array.isArray(cat.data) ? cat.data : []).map((t: any) => `${t.title}${t.mood ? ` (${t.mood})` : ""}`);
    idea = (await aiIdea(catalog, seed)) ?? algorithmIdea(seed);
    const g = await fn(jwt, "suno-generate", { prompt: `${idea.mood} electronic instrumental by DJ Yellow`, style: idea.style, title: idea.titles[0], instrumental: true, enhance: false }, 90000);
    const taskId = g.data?.taskId || g.data?.task_id || g.data?.id;
    if (!taskId) return { ok: false, step: "suno-generate", error: g.data?.error || g.data?.detail || `HTTP ${g.status}`, idea };
    const ins = await rest(jwt, "generations", { method: "POST", body: JSON.stringify({ user_id: uid, prompt: idea.style, title: idea.titles[0], genre: "Electronic", instrumental: true, engine: "suno", status: "queued", replicate_id: String(taskId), lyrics: JSON.stringify({ idea }) }) });
    gen = Array.isArray(ins.data) ? ins.data[0] : { id: null, replicate_id: String(taskId) };
  }

  // Czekamy na Suno (zwykle 1–3 min). Gdy zabraknie czasu — następne uruchomienie dokończy.
  let st: any = null;
  while (Date.now() < deadline - 60000) {
    st = (await fn(jwt, "suno-generate", { action: "status", taskId: gen.replicate_id }, 60000)).data;
    if (st?.status === "succeeded" || st?.status === "failed") break;
    await sleep(12000);
  }
  if (!st || st.status !== "succeeded") {
    if (st?.status === "failed" && gen.id) await rest(jwt, `generations?id=eq.${gen.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) });
    return { ok: st?.status !== "failed", step: "waiting", status: st?.status ?? "processing", idea };
  }

  const items: any[] = Array.isArray(st.all) ? st.all : [];
  const out: any[] = [];
  for (let i = 0; i < Math.min(PER_DAY, Math.max(1, items.length)); i++) {
    if (Date.now() > deadline - 15000) break;
    const it = items[i] ?? {};
    const title = idea.titles[i] ?? `${idea.titles[0]} II`;
    if (doneList.some((d: any) => d.title === title)) continue;
    let audio: string | null = i === 0 && st.audio_archived ? st.audio_url : null;
    if (!audio) audio = await archiveAudio(jwt, it.audioUrl || it.sourceAudioUrl || it.streamAudioUrl || st.audio_url, `${it.id || gen.replicate_id}-${i}`);
    if (!audio) { out.push({ title, error: "nie udało się zapisać audio na R2" }); continue; }
    const cover = await makeCover(jwt, idea, title, seed + i * 101);
    const row = {
      user_id: uid, title, artist: ARTIST, album: "DJ Yellow · Daily", genre: "Electronic", mood: idea.mood,
      duration: Math.round(Number(it.duration || st.duration || 180)), audio_url: audio, cover_url: cover ?? st.cover_url ?? null,
    };
    const ins = await rest(jwt, "tracks", { method: "POST", body: JSON.stringify(row) });
    out.push(ins.ok ? { title, id: ins.data?.[0]?.id, cover } : { title, error: `tracks: ${JSON.stringify(ins.data).slice(0, 200)}` });
  }
  if (gen.id && out.some((o) => o.id)) await rest(jwt, `generations?id=eq.${gen.id}`, { method: "PATCH", body: JSON.stringify({ status: "completed", audio_url: out.find((o) => o.id) ? st.audio_url : null }) });
  return { ok: out.some((o) => o.id), step: "published", idea: { ...idea, cover: undefined }, tracks: out };
}

export default async function handler(req: any, res: any) {
  const q = req.query ?? {};
  res.setHeader("cache-control", "no-store");
  if (q.diag) {
    const s = await http(`${SUPA()}/auth/v1/settings`, { headers: { apikey: ANON() } });
    const auth = await login();
    let today: unknown = null;
    if (!("error" in auth)) {
      const t = await rest(auth.jwt, `tracks?select=title,cover_url,created_at&user_id=eq.${auth.uid}&order=created_at.desc&limit=6`);
      today = t.data;
    }
    return res.status(200).json({ autoconfirm: s.data?.mailer_autoconfirm ?? null, signupDisabled: s.data?.disable_signup ?? null, email: DJ_EMAIL(), configured: !!env("DJ_YELLOW_PASSWORD"), login: "error" in auth ? auth.error : "ok", latest: today });
  }
  if (q.signup) {
    const email = DJ_EMAIL(), password = env("DJ_YELLOW_PASSWORD");
    if (!password) return res.status(400).json({ error: "brak DJ_YELLOW_PASSWORD w Vercel" });
    const r = await http(`${SUPA()}/auth/v1/signup`, { method: "POST", headers: { apikey: ANON(), "content-type": "application/json" }, body: JSON.stringify({ email, password, data: { display_name: ARTIST, full_name: ARTIST } }) });
    return res.status(200).json({ status: r.status, confirmed: !!r.data?.session || !!r.data?.user?.email_confirmed_at, error: r.ok ? null : r.data?.msg || r.data?.error_description || null });
  }
  try {
    const result = await run(Date.now() + 280000);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e as Error)?.message || e).slice(0, 300) });
  }
}
