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
// Dodatkowe utwory w wybrane dni (decyzja Grzegorza) — automat sam dorobi brakujące, bez przycisków.
const EXTRA_DAYS: Record<string, number> = { "2026-11-05": 4 };
const plDay = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const dayTarget = () => Math.min(6, EXTRA_DAYS[plDay()] ?? PER_DAY);

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

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
// Tła okładek (bez ludzi, bez tekstu) — zmienia się tylko grafika z tyłu, zdjęcie DJ Yellow zostaje.
const BACKDROPS = [
  "huge open-air music festival at night, crowd with hands up, confetti and golden light beams",
  "concert main stage with lasers, smoke and fireworks over a cheering crowd",
  "summer beach party at sunset with dancing crowd, lanterns and lights",
  "rooftop dance party at night over a city skyline, string lights and lasers",
  "DJ booth view of a packed dance floor with yellow lasers and haze",
  "neon-lit city street party at night with colorful lights and confetti",
  "giant LED stage show at a festival, golden pyrotechnics",
  "outdoor daytime festival with colorful smoke flares and flags",
  "warehouse rave with strobes and yellow lasers through smoke",
  "new year's eve party with fireworks over the city",
  "silent disco in a park at dusk with glowing headphones",
  "carnival parade at night with dancers, lights and confetti",
];

/** Okładka: tło (AI) + zdjęcie DJ Yellow w złotej ramce + DJ YELLOW, tytuł i zawsze znaczek „AI”. */
function personaSvg(photo: { data: Uint8Array; type: string } | null, bg: { data: Uint8Array; type: string } | null, title: string, seed: number): string {
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const back = bg
    ? `<image href="data:${bg.type};base64,${b64(bg.data)}" x="0" y="0" width="1024" height="1024" preserveAspectRatio="xMidYMid slice"/>`
    : svgCover(title, seed).replace(/^<svg[^>]*>|<\/svg>$/g, "");
  const left = [96, 212, 330][Math.abs(seed) % 3];
  const front = photo
    ? `<g filter="url(#sh)"><rect x="${left - 10}" y="110" width="380" height="560" rx="34" fill="url(#gy)"/>
<clipPath id="cp"><rect x="${left}" y="120" width="360" height="540" rx="26"/></clipPath>
<image href="data:${photo.type};base64,${b64(photo.data)}" x="${left}" y="120" width="360" height="540" preserveAspectRatio="xMidYMin slice" clip-path="url(#cp)"/></g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient>
<linearGradient id="gy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff59d"/><stop offset="0.5" stop-color="#FFD400"/><stop offset="1" stop-color="#FF8A00"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.6"/></filter></defs>
${back}<rect width="1024" height="1024" fill="url(#fade)"/>${front}
<rect x="852" y="36" width="136" height="72" rx="18" fill="#000" fill-opacity="0.7" stroke="url(#gy)" stroke-width="4"/>
<text x="920" y="88" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="46" font-weight="900" fill="url(#gy)">AI</text>
<text x="56" y="900" font-family="Arial Black,Arial,sans-serif" font-size="84" font-weight="900" fill="url(#gy)" letter-spacing="6">DJ YELLOW</text>
<text x="58" y="960" font-family="Arial,sans-serif" font-size="40" fill="#fff8d0">${esc(title.slice(0, 44))}</text></svg>`;
}

/** Samo tło okładki z AI (bez ludzi). */
async function backdropImage(seed: number): Promise<{ data: Uint8Array; type: string } | null> {
  try {
    const prompt = `${BACKDROPS[Math.abs(seed) % BACKDROPS.length]}, cinematic, ultra detailed, vibrant yellow and gold accents, no people, no text, no letters`;
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.abs(seed)}`, { signal: AbortSignal.timeout(70000) });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) return null;
    const data = new Uint8Array(await r.arrayBuffer());
    return data.length > 20000 ? { data, type: type.includes("png") ? "image/png" : "image/jpeg" } : null;
  } catch { return null; }
}

// Zdjęcie DJ Yellow od Grzegorza (public/artists/dj-yellow.webp) — twarz artysty na każdej okładce.
// Bez generowania jego twarzy w nowych scenach (puby/kluby) — tylko to zdjęcie, różne kolory i kadry.
let photoCache: { data: Uint8Array; type: string } | null = null;
async function artistPhoto(): Promise<{ data: Uint8Array; type: string } | null> {
  if (photoCache) return photoCache;
  try {
    const base = (env("SITE_URL") ?? "https://grouaistream.com").replace(/\/+$/, "");
    const r = await fetch(`${base}/artists/dj-yellow.webp`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    photoCache = { data: new Uint8Array(await r.arrayBuffer()), type: "image/webp" };
    return photoCache;
  } catch { return null; }
}

async function makeCover(jwt: string, _idea: Idea, title: string, seed: number): Promise<string | null> {
  const [photo, bg] = await Promise.all([artistPhoto(), backdropImage(seed)]);
  return putR2(jwt, personaSvg(photo, bg, title, seed), `y-${Math.abs(seed)}.svg`, "image/svg+xml");
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
const OWNER = "grzegorzkaron553@gmail.com";
/** Właściciel zalogowany w studiu GrouAI — wtedy praca idzie na jego koncie (bez osobnego hasła). */
async function ownerFromToken(authHeader: string): Promise<{ jwt: string; uid: string } | null> {
  if (!authHeader.startsWith("Bearer ")) return null;
  const r = await http(`${SUPA()}/auth/v1/user`, { headers: { apikey: ANON(), authorization: authHeader } });
  if (!r.ok || String(r.data?.email || "").toLowerCase() !== OWNER) return null;
  return { jwt: authHeader.slice(7), uid: r.data.id };
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
const MAX_PER_DAY = 6; // z dodatkowymi („Zrób jeszcze 2”) — twardy sufit kosztów

async function run(deadline: number, who?: { jwt: string; uid: string }) {
  const auth = who ?? (await login());
  if ("error" in auth) return { ok: false, step: "login", error: auth.error };
  const { jwt, uid } = auth;
  const since = todayStartPl();
  // Limit liczony po artyście (niezależnie od konta, z którego ruszyło studio).
  const done = await rest(jwt, `tracks?select=id,title,cover_url&artist=eq.${encodeURIComponent(ARTIST)}&created_at=gte.${encodeURIComponent(since)}`);
  const doneList = Array.isArray(done.data) ? done.data : [];
  // Naprawa: starsze utwory DJ Yellow bez okładki z postacią (i znaczkiem AI) dostają nową — maks. 2 na raz.
  const old = await rest(jwt, `tracks?select=id,title,cover_url&artist=eq.${encodeURIComponent(ARTIST)}&order=created_at.desc&limit=20`);
  const fixed: string[] = [];
  for (const t of (Array.isArray(old.data) ? old.data : []).filter((x: any) => !/\/dj-yellow\/\d+-y-/.test(String(x.cover_url || ""))).slice(0, 6)) {
    if (Date.now() > deadline - 60000) break;
    const cover = await makeCover(jwt, algorithmIdea(0), String(t.title), Math.abs(hash(String(t.id))));
    if (cover && (await rest(jwt, `tracks?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ cover_url: cover }) })).ok) fixed.push(String(t.title));
  }
  const target = Math.min(MAX_PER_DAY, dayTarget());
  if (doneList.length >= target) return { ok: true, step: "done-today", tracks: doneList, fixedCovers: fixed };
  const need = target - doneList.length;

  // Rozpoczęte dziś zadania — dokańczamy je zamiast płacić za nowe.
  const pend = await rest(jwt, `generations?select=id,replicate_id,lyrics,created_at&user_id=eq.${uid}&status=eq.queued&genre=eq.Electronic&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=${need}`);
  const jobs: { gen: any; idea: Idea; seed: number }[] = (Array.isArray(pend.data) ? pend.data : []).map((g: any, i: number) => {
    let idea: Idea | undefined; try { idea = JSON.parse(g.lyrics || "{}").idea; } catch { /* */ }
    const seed = Math.floor(Date.now() / 86400000) * 7919 + doneList.length * 31 + i;
    return { gen: g, idea: idea?.titles ? idea : algorithmIdea(seed), seed };
  });

  // Nowe zadania: każde = osobny pomysł (inny podgatunek, tytuł, scena okładki) → 2 RÓŻNE utwory.
  if (jobs.length < need) {
    const cat = await rest(jwt, `tracks?select=title,mood&genre=ilike.*electr*&order=created_at.desc&limit=40`);
    const catalog = (Array.isArray(cat.data) ? cat.data : []).map((t: any) => `${t.title}${t.mood ? ` (${t.mood})` : ""}`);
    const used = new Set<string>([...doneList.map((d: any) => d.title), ...jobs.map((j) => j.idea.titles[0])]);
    for (let k = jobs.length; k < need; k++) {
      const seed = Math.floor(Date.now() / 1000) + k * 977 + doneList.length * 31;
      let idea = (await aiIdea([...catalog, ...[...used].map((t) => `${t} (już wydane — zrób coś innego)`)], seed)) ?? algorithmIdea(seed);
      if (used.has(idea.titles[0])) idea = algorithmIdea(seed + 13);
      used.add(idea.titles[0]);
      const g = await fn(jwt, "suno-generate", { prompt: `${idea.mood} electronic instrumental by DJ Yellow`, style: idea.style, title: idea.titles[0], instrumental: true, enhance: false }, 90000);
      const taskId = g.data?.taskId || g.data?.task_id || g.data?.id;
      if (!taskId) { if (!jobs.length) return { ok: false, step: "suno-generate", error: g.data?.error || g.data?.detail || `HTTP ${g.status}` }; break; }
      const ins = await rest(jwt, "generations", { method: "POST", body: JSON.stringify({ user_id: uid, prompt: idea.style, title: idea.titles[0], genre: "Electronic", instrumental: true, engine: "suno", status: "queued", replicate_id: String(taskId), lyrics: JSON.stringify({ idea }) }) });
      jobs.push({ gen: Array.isArray(ins.data) ? ins.data[0] : { id: null, replicate_id: String(taskId) }, idea, seed });
    }
  }

  // Czekamy na Suno równolegle (zwykle 1–3 min). Gdy zabraknie czasu — następne uruchomienie dokończy.
  const state = new Map<number, any>();
  while (Date.now() < deadline - 70000 && state.size < jobs.length) {
    await Promise.all(jobs.map(async (j, i) => {
      if (state.has(i)) return;
      const st = (await fn(jwt, "suno-generate", { action: "status", taskId: j.gen.replicate_id }, 60000)).data;
      if (st?.status === "succeeded" || st?.status === "failed") state.set(i, st);
    }));
    if (state.size < jobs.length) await sleep(12000);
  }

  const out: any[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const st = state.get(i), j = jobs[i];
    if (!st) { out.push({ title: j.idea.titles[0], pending: true }); continue; }
    if (st.status === "failed") { if (j.gen.id) await rest(jwt, `generations?id=eq.${j.gen.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) }); out.push({ title: j.idea.titles[0], error: st.error || "Suno: nieudane" }); continue; }
    if (Date.now() > deadline - 20000) { out.push({ title: j.idea.titles[0], pending: true }); continue; }
    const it = (Array.isArray(st.all) ? st.all : [])[0] ?? {};
    const title = j.idea.titles[0];
    let audio: string | null = st.audio_archived ? st.audio_url : null;
    if (!audio) audio = await archiveAudio(jwt, it.audioUrl || it.sourceAudioUrl || it.streamAudioUrl || st.audio_url, `${it.id || j.gen.replicate_id}`);
    if (!audio) { out.push({ title, error: "nie udało się zapisać audio na R2" }); continue; }
    const cover = await makeCover(jwt, j.idea, title, j.seed);
    const base = {
      user_id: uid, title, artist: ARTIST, album: "DJ Yellow · AI", genre: "Electronic", mood: j.idea.mood,
      duration: Math.round(Number(it.duration || st.duration || 180)), audio_url: audio, cover_url: cover ?? st.cover_url ?? null,
    };
    // Wsparcie sieci: wyróżnienie na 7 dni (gdy baza pozwala); inaczej zwykły wpis.
    let ins = await rest(jwt, "tracks", { method: "POST", body: JSON.stringify({ ...base, is_boosted: true, boost_expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }) });
    if (!ins.ok) ins = await rest(jwt, "tracks", { method: "POST", body: JSON.stringify(base) });
    out.push(ins.ok ? { title, id: ins.data?.[0]?.id, cover, audio } : { title, error: `tracks: ${JSON.stringify(ins.data).slice(0, 200)}` });
    if (ins.ok && j.gen.id) await rest(jwt, `generations?id=eq.${j.gen.id}`, { method: "PATCH", body: JSON.stringify({ status: "completed", audio_url: audio }) });
  }
  const published = out.filter((o) => o.id);
  if (!published.length && out.some((o) => o.pending)) return { ok: true, step: "waiting", tracks: out };
  return { ok: published.length > 0, step: out.some((o) => o.pending) ? "waiting" : "published", tracks: out };
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
  if (q.lookup) {
    // Wyszukanie konta po nazwie wyświetlanej (publiczne pola profilu: user_id, display_name, avatar_url).
    const name = String(q.lookup).replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 40);
    const r = await http(`${SUPA()}/rest/v1/profiles?select=user_id,display_name,avatar_url&display_name=ilike.*${encodeURIComponent(name)}*&limit=10`, { headers: { apikey: ANON() } });
    return res.status(200).json(r.data);
  }
  if (q.check) {
    // Diagnostyka plików dzisiejszych utworów: pierwsze bajty dźwięku i okładki (bez kosztów).
    const r = await http(`${SUPA()}/rest/v1/tracks?select=title,audio_url,cover_url,created_at&artist=eq.${encodeURIComponent(ARTIST)}&order=created_at.desc&limit=6`, { headers: { apikey: ANON() } });
    const head = async (u: string | null) => {
      if (!u) return null;
      try {
        const x = await fetch(u, { headers: { range: "bytes=0-23" }, signal: AbortSignal.timeout(15000) });
        const b = new Uint8Array(await x.arrayBuffer());
        return { status: x.status, type: x.headers.get("content-type"), len: x.headers.get("content-range"), hex: Buffer.from(b).toString("hex").slice(0, 48), ascii: Buffer.from(b).toString("latin1").replace(/[^\x20-\x7e]/g, ".") };
      } catch (e) { return { error: String(e) }; }
    };
    const rows = Array.isArray(r.data) ? r.data : [];
    return res.status(200).json(await Promise.all(rows.map(async (t: any) => ({ title: t.title, audio: await head(t.audio_url), cover: await head(t.cover_url), cover_url: t.cover_url }))));
  }
  if (q.status) {
    // Stan na dziś dla karty w studiu (bez kosztów).
    const r = await http(`${SUPA()}/rest/v1/tracks?select=id,title,cover_url,created_at&artist=eq.${encodeURIComponent(ARTIST)}&order=created_at.desc&limit=6`, { headers: { apikey: ANON() } });
    const since = todayStartPl();
    const list = Array.isArray(r.data) ? r.data : [];
    const all = await http(`${SUPA()}/rest/v1/tracks?select=cover_url&artist=eq.${encodeURIComponent(ARTIST)}&order=created_at.desc&limit=20`, { headers: { apikey: ANON() } });
    const needsCovers = (Array.isArray(all.data) ? all.data : []).filter((t: any) => !/\/dj-yellow\/\d+-y-/.test(String(t.cover_url || ""))).length;
    return res.status(200).json({ today: list.filter((t: any) => t.created_at >= since), latest: list, perDay: dayTarget(), needsCovers });
  }
  const who = await ownerFromToken(String(req.headers.authorization || ""));
  if (req.method === "POST" && !who) return res.status(403).json({ ok: false, error: "tylko właściciel studia" });
  try {
    const result = await run(Date.now() + 280000, who ?? undefined);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e as Error)?.message || e).slice(0, 300) });
  }
}
