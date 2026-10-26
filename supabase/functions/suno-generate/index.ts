// Suno V5 engine (primary) with V4_5PLUS auto-fallback + GPT-5.5 prompt/lyrics enhancer.
// Normalized response shape so SunoGeneratePanel can poll it identically to acestep/musicgen:
//   generate → { id: <taskId>, status: "queued" }
//   status   → { status: "processing"|"succeeded"|"failed", audio_url?, cover_url?, title?, duration? }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { archiveToR2, putToR2Checked } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUNO_API_BASE = "https://api.sunoapi.org/api/v1";
const AI_GATEWAY = "https://openrouter.ai/api/v1/chat/completions";
// Darmowe modele OpenRouter, próbowane po kolei (stare id bywają wycofywane).
const ENHANCE_MODELS = ["google/gemma-4-31b-it:free", "meta-llama/llama-3.3-70b-instruct:free"];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Kody błędów sunoapi.org → zrozumiały komunikat dla twórcy.
function sunoReason(code: number | undefined, msg?: string): string {
  switch (code) {
    case 401: return "Klucz Suno (SUNO_API_KEY) jest nieprawidłowy lub wygasł";
    case 402:
    case 429: return "Brak kredytów na koncie sunoapi.org — doładuj konto";
    case 405:
    case 430: return "Zbyt wiele zapytań do Suno — spróbuj za minutę";
    case 413: return "Opis lub tekst jest za długi dla Suno";
    case 455: return "Suno ma przerwę techniczną — spróbuj później";
    default: return msg ? `Suno: ${msg}` : "Suno nie przyjęło zadania";
  }
}

// GPT-5.5 rewrites user idea into a top-tier Suno prompt (style + optional lyrics).
// Optimized for PL phonetics + clean instrumentation cues.
async function enhanceWithGPT(input: {
  prompt: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
  language?: string;
}): Promise<{ style: string; title: string; lyrics: string } | null> {
  // Ulepszacz działa tylko z kluczem OpenRouter (klucz Lovable nie pasuje do tej bramki).
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return null;

  const lang = input.language || "pl";
  const langName = { pl: "Polish", en: "English", nl: "Dutch", ua: "Ukrainian" }[lang] || "Polish";

  const sys = `You are a world-class Suno V5 prompt engineer and lyricist for GrouAI Studio.
Your #1 goal: MAXIMUM AUDIO CLARITY. The output must sound like a professionally mixed and mastered studio record — never muddy, never lo-fi, never distorted, never boxy.

Return STRICT JSON only, no markdown:
{
  "style": "<up to 200-char rich style tag>",
  "title": "<catchy 2-5 word title>",
  "lyrics": "<full song in ${langName} with [Verse]/[Chorus]/[Bridge]/[Outro] tags, or empty string if instrumental>"
}

Rules for lyrics:
- Native ${langName}, natural stress, singable syllables, regular rhymes (AABB or ABAB), 4-8 syllables per line.
- For Polish: unikaj trudnych zbitek spółgłoskowych, dobieraj samogłoski wygodne do śpiewu.
- Structure: [Verse 1] / [Chorus] / [Verse 2] / [Chorus] / [Bridge] / [Chorus] / [Outro].

Rules for style (CRITICAL for clean sound):
- Always include these clarity anchors: "crystal clear mix, pristine high fidelity, 24-bit studio master, wide stereo image, deep controlled sub-bass, airy top end, transparent vocals up-front, zero distortion, zero mud, professional mastering, radio-ready, reference-monitor quality".
- Name PRECISE instruments and their character (e.g. "warm Rhodes electric piano, felt-hammer grand piano, analog Moog bass, live acoustic drums with tight snare, silky violin section").
- Include a specific vocal descriptor unless instrumental (e.g. "emotive male tenor, warm intimate delivery, close-mic'd, subtle reverb").
- Avoid: "lofi", "vintage tape hiss", "8-bit", "compressed radio", "phone speaker", "muffled", "distorted", "trashy", "grunge".
- Avoid generic filler ("nice", "cool", "good").`;

  const usr = `Description: ${input.prompt}
Requested style hint: ${input.style || "(none, choose best)"}
Requested title hint: ${input.title || "(auto)"}
Instrumental: ${input.instrumental ? "yes (lyrics must be empty)" : "no (write full lyrics)"}
Language: ${langName}`;

  for (const model of ENHANCE_MODELS) try {
    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://grouaistream.com",
        "X-Title": "GrouAI Stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
        response_format: { type: "json_object" },
      }),
      // Ulepszacz jest opcjonalny — nie może blokować generowania.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("[suno-generate] GPT enhance failed:", model, res.status, await res.text().catch(() => ""));
      continue;
    }
    const j = await res.json();
    const raw = String(j.choices?.[0]?.message?.content || "{}").replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw);
    const CLARITY = "crystal clear mix, pristine high fidelity, 24-bit studio master, wide stereo image, transparent vocals, zero distortion, zero mud, professional mastering, radio-ready";
    const styleBase = String(parsed.style || input.style || "modern pop, warm analog synth").trim();
    const mergedStyle = /clear|fidelity|master/i.test(styleBase) ? styleBase : `${styleBase}, ${CLARITY}`;
    return {
      style: mergedStyle.slice(0, 200),
      title: String(parsed.title || input.title || "GrouAI Track").slice(0, 80),
      lyrics: input.instrumental ? "" : String(parsed.lyrics || ""),
    };
  } catch (e) {
    console.error("[suno-generate] GPT enhance error:", model, e);
  }
  return null;
}

async function callSuno(apiKey: string, body: any) {
  return fetch(`${SUNO_API_BASE}/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}

// ── Odzyskiwanie utworów Studia, których plik zniknął (usunięty serwer „hub")
// albo został tylko pod tymczasowym adresem Suno (tempfile — wygasa).
// Źródła: zapis zadania w sunoapi.org (stary adres zawiera suno-<taskId>) albo
// identyfikator nagrania z tempfile; pobieramy plik lub strumień i kładziemy na R2.
const LOST_HUB = "bmwtydwpevzhbdplilbr.supabase.co";
const TEMP_HOST = "tempfile.aiquickdraw.com";

async function fetchAudio(url: string, timeoutMs: number): Promise<Uint8Array | string> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return `HTTP ${r.status}`;
    const buf = new Uint8Array(await r.arrayBuffer());
    return buf.length > 20_000 ? buf : `za mały plik (${buf.length} B)`;
  } catch (e) {
    return String(e).slice(0, 120);
  }
}

async function recoverLost(apiKey: string, limit: number, offset: number) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows, error } = await admin
    .from("generations")
    .select("id, title, audio_url")
    .or(`audio_url.like.%${LOST_HUB}%,audio_url.like.%${TEMP_HOST}%`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return { error: error.message };

  const started = Date.now();
  const results: Record<string, unknown>[] = [];
  for (const g of rows || []) {
    if (Date.now() - started > 100_000) break; // limit czasu funkcji
    const old = String(g.audio_url || "");
    const sources: string[] = [];
    let clipId = "";
    let cover: string | undefined;
    const taskId = old.includes(LOST_HUB) ? old.match(/suno-([0-9a-f]{16,})/)?.[1] : undefined;
    if (taskId) {
      try {
        const r = await fetch(`${SUNO_API_BASE}/generate/record-info?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000),
        });
        const j = await r.json().catch(() => ({}));
        const items = j?.data?.response?.sunoData || [];
        const it = items.find((x: any) => x?.title === g.title) || items[0];
        if (it) {
          clipId = it.id || "";
          for (const k of ["audio_url", "audioUrl", "source_audio_url", "sourceAudioUrl", "stream_audio_url", "streamAudioUrl", "source_stream_audio_url", "sourceStreamAudioUrl"]) {
            if (typeof it[k] === "string" && it[k]) sources.push(it[k]);
          }
          cover = it.image_url || it.imageUrl || it.source_image_url || it.sourceImageUrl || undefined;
        }
      } catch { /* brak zapisu w Suno */ }
    } else if (old.includes(TEMP_HOST)) {
      clipId = old.match(/\/r\/([0-9a-f-]{36})/)?.[1] || "";
      sources.push(old);
      if (clipId) sources.push(`https://audiostream.api.box/stream/${clipId}.mp3`);
    }
    if (!sources.length) { results.push({ id: g.id, title: g.title, status: "brak źródła" }); continue; }

    let url: string | undefined;
    const tried: string[] = [];
    for (const src of [...new Set(sources)]) {
      const audio = await fetchAudio(src, 60_000);
      if (typeof audio === "string") { tried.push(`${new URL(src).host}: ${audio}`); continue; }
      const put = await putToR2Checked({ body: audio, folder: "studio/recovered", fileName: `${clipId || g.id}.mp3`, contentType: "audio/mpeg" });
      if (put.url) { url = put.url; break; }
      tried.push(put.error || "R2: nieznany błąd");
    }
    if (!url) { results.push({ id: g.id, title: g.title, status: "nie udało się", tried }); continue; }

    let coverUrl: string | null = null;
    if (cover) {
      const img = await fetchAudio(cover, 15_000);
      if (typeof img !== "string") {
        coverUrl = (await putToR2Checked({ body: img, folder: "studio/recovered", fileName: `${clipId || g.id}.jpg`, contentType: "image/jpeg" })).url ?? null;
      }
    }
    await admin.from("generations").update({ audio_url: url }).eq("id", g.id);
    await admin.from("tracks").update({ audio_url: url, ...(coverUrl ? { cover_url: coverUrl } : {}) }).eq("audio_url", old);
    results.push({ id: g.id, title: g.title, status: "odzyskano", url });
  }
  return { processed: results.length, recovered: results.filter((r) => r.status === "odzyskano").length, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const raw = await req.text();
  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { /* puste lub nie-JSON */ }

  // Callback sunoapi.org (bez logowania) — wynik i tak odbieramy pollingiem „status".
  if (body?.data?.callbackType || body?.data?.task_id) return json({ ok: true });

  // Odzyskiwanie utraconych plików Studia — działa tylko na rekordach z naszej bazy
  // (nie przyjmuje adresów z zewnątrz), więc może je wywołać zadanie serwerowe.
  if (body?.action === "recover") {
    const k = Deno.env.get("SUNO_API_KEY");
    if (!k) return json({ error: "Brak sekretu SUNO_API_KEY" });
    return json(await recoverLost(k, Math.min(Math.max(Number(body.limit) || 3, 1), 10), Math.max(Number(body.offset) || 0, 0)));
  }

  // Diagnostyka bez kosztów: czy klucz jest ustawiony i ile zostało kredytów.
  if (body?.action === "health") {
    const k = Deno.env.get("SUNO_API_KEY");
    if (!k) return json({ ok: false, configured: false, reason: "Brak sekretu SUNO_API_KEY" });
    try {
      const r = await fetch(`${SUNO_API_BASE}/generate/credit`, {
        headers: { Authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(10_000),
      });
      const j = await r.json().catch(() => ({}));
      const ok = r.ok && j?.code === 200;
      return json({ ok, configured: true, http: r.status, code: j?.code, credits: ok ? j?.data : undefined,
        reason: ok ? undefined : sunoReason(j?.code ?? r.status, j?.msg) });
    } catch (e) {
      return json({ ok: false, configured: true, reason: `sunoapi.org nie odpowiada: ${String(e)}` });
    }
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
  if (!SUNO_API_KEY) {
    return json({ error: "Brak sekretu SUNO_API_KEY w projekcie — dodaj klucz z sunoapi.org" });
  }

  try {
    const action = body.action || (body.taskId || body.task_id || body.prediction_id ? "status" : "generate");

    // -------- STATUS --------
    if (action === "status") {
      const taskId = body.taskId || body.task_id || body.prediction_id;
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await fetch(`${SUNO_API_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${SUNO_API_KEY}` },
        signal: AbortSignal.timeout(20_000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        return new Response(JSON.stringify({ status: "failed", error: j?.msg || `HTTP ${r.status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const d = j?.data;
      const s = String(d?.status || "").toUpperCase();
      const items = d?.response?.sunoData || d?.response?.data || [];
      const first = Array.isArray(items) ? items[0] : null;
      let norm: any = { status: "processing", raw_status: s };
      if (s === "SUCCESS" || s === "COMPLETE" || first?.audioUrl) {
        // Linki Suno wygasają — kopiujemy nagranie i okładkę na stałe do R2.
        const rawAudio = first?.audioUrl || first?.sourceAudioUrl || first?.streamAudioUrl;
        const rawCover = first?.imageUrl || first?.sourceImageUrl || "";
        // Kopia na R2: plik (60 s), a gdy się nie uda — strumień Suno. Błąd trafia do odpowiedzi.
        let permAudio: string | null = null;
        const archiveErrors: string[] = [];
        if (first?.audioUrl || first?.sourceAudioUrl) {
          const clip = first?.id || taskId;
          const srcs = [first?.audioUrl, first?.sourceAudioUrl, first?.streamAudioUrl, `https://audiostream.api.box/stream/${clip}.mp3`]
            .filter((u, i, arr): u is string => typeof u === "string" && !!u && arr.indexOf(u) === i);
          for (const src of srcs) {
            const audio = await fetchAudio(src, 60_000);
            if (typeof audio === "string") { archiveErrors.push(`${new URL(src).host}: ${audio}`); continue; }
            const put = await putToR2Checked({ body: audio, folder: "suno", fileName: `${clip}.mp3`, contentType: "audio/mpeg" });
            if (put.url) { permAudio = put.url; break; }
            archiveErrors.push(put.error || "R2: nieznany błąd");
          }
          if (!permAudio) console.error("[suno-generate] archiwizacja na R2 nie powiodła się:", archiveErrors);
        }
        const permCover = rawCover
          ? await archiveToR2({ sourceUrl: rawCover, folder: "suno-covers", id: first?.id || taskId, ext: "jpg", contentType: "image/jpeg" })
          : null;
        norm = {
          status: "succeeded",
          id: taskId,
          audio_url: permAudio || rawAudio,
          cover_url: permCover || rawCover,
          title: first?.title || "",
          duration: first?.duration || 0,
          all: items,
          ...(permAudio ? {} : { archive_error: archiveErrors.join(" | ") || "brak pliku" }),
        };
      } else if (s === "CREATE_TASK_FAILED" || s === "GENERATE_AUDIO_FAILED" || s === "CALLBACK_EXCEPTION" || s === "SENSITIVE_WORD_ERROR") {
        norm = { status: "failed", error: d?.errorMessage || s };
      }
      return new Response(JSON.stringify(norm), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- GENERATE --------
    const { prompt = "", style = "", title = "", instrumental = false, vocal_language, language, enhance = true } = body;

    const styleGiven = !!String(style || "").trim();
    let finalStyle = style;
    let finalTitle = title;
    let finalLyrics = ""; // Suno's `prompt` field = lyrics in customMode

    let enhanced = false;
    if (enhance) {
      const boost = await enhanceWithGPT({
        prompt, style, title, instrumental,
        language: vocal_language || language || "pl",
      });
      if (boost) {
        enhanced = true;
        finalStyle = boost.style;
        finalTitle = boost.title;
        finalLyrics = boost.lyrics;
      }
    }

    // Explicit user-written lyrics/style override the enhancer.
    if (typeof body.lyrics === "string" && body.lyrics.trim()) finalLyrics = body.lyrics.trim();
    if (!enhance && style) finalStyle = style;
    if (!enhance && title) finalTitle = title;

    // Fallbacks if GPT unavailable — always push for maximum clarity
    if (!finalStyle) finalStyle = "modern pop, warm analog synth, punchy live drums, transparent vocals, crystal clear mix, pristine high fidelity, 24-bit studio master, wide stereo image, professional mastering, radio-ready";
    if (!finalTitle) finalTitle = "GrouAI Track";

    const callBackUrl = `${supabaseUrl}/functions/v1/suno-generate`;

    // Negative tags — everything that ruins a clean mix
    const NEGATIVE_TAGS = "lofi, low fidelity, muddy, muffled, distorted, clipping, boxy, tape hiss, vinyl crackle, 8-bit, chiptune, phone speaker, AM radio, background noise, harsh sibilance, autotune artifacts, robotic vocals, off-key, out of tune";

    // Custom mode gives us full control (style + title + lyrics). We use it whenever we have enhanced output.
    const useCustom = !!(finalStyle || finalTitle || finalLyrics) && (instrumental || finalLyrics.length > 0);

    const baseBody: any = {
      customMode: useCustom,
      instrumental: !!instrumental,
      negativeTags: NEGATIVE_TAGS,
      callBackUrl,
    };
    if (useCustom) {
      baseBody.style = finalStyle.slice(0, 200);
      baseBody.title = finalTitle.slice(0, 80);
      baseBody.prompt = instrumental ? "" : finalLyrics.slice(0, 3000);
    } else {
      // Tryb opisowy: Suno samo pisze tekst. Wysyłamy opis użytkownika; styl dokładamy tylko
      // wtedy, gdy podał go użytkownik lub ulepszacz — domyślny „modern pop" zmieniałby gatunek.
      const lang = String(vocal_language || language || "").toLowerCase();
      const LANG_HINT: Record<string, string> = { pl: "śpiew po polsku", en: "English vocals", nl: "Nederlandse zang", uk: "вокал українською", ua: "вокал українською" };
      const parts = [String(prompt).trim()];
      if (styleGiven || enhanced) parts.push(finalStyle);
      if (!instrumental && LANG_HINT[lang]) parts.push(LANG_HINT[lang]);
      baseBody.prompt = parts.filter(Boolean).join(" — ").slice(0, 490);
    }

    // Try V5_5 (najwyższa jakość) first, then V5, then V4_5PLUS on model error.
    const modelsToTry = ["V5_5", "V5", "V4_5PLUS"];
    let genData: any = null;
    let genOk = false;
    let usedModel = "";
    let lastErr = "";
    let lastReason = "";
    for (const m of modelsToTry) {
      const res = await callSuno(SUNO_API_KEY, { ...baseBody, model: m });
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j?.code === 200 || j?.data?.taskId)) {
        genData = j;
        genOk = true;
        usedModel = m;
        break;
      }
      const code = Number(j?.code ?? res.status);
      lastErr = `[${m}] HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`;
      lastReason = sunoReason(code, j?.msg);
      console.warn("[suno-generate] model failed:", lastErr);
      // Klucz/kredyty/limit dotyczą konta, nie modelu — kolejny model nic nie zmieni.
      if ([401, 402, 429, 430, 455].includes(code)) break;
    }

    if (!genOk) {
      // 200 z polem error: klient pokazuje powód zamiast ogólnego „non-2xx".
      return json({ error: lastReason || "Suno nie przyjęło zadania", detail: lastErr });
    }

    const taskId = genData?.data?.taskId || genData?.data?.task_id;
    if (!taskId) {
      return new Response(JSON.stringify({ error: "No taskId returned", raw: genData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      id: taskId,
      task_id: taskId,
      taskId,
      status: "queued",
      model: usedModel,
      enhanced: enhance,
      style: finalStyle,
      title: finalTitle,
      lyrics: finalLyrics,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[suno-generate] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
