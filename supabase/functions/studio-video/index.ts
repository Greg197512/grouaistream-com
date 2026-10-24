// studio-video — wideo dla GrouAI Studio (zastępuje funkcje usuniętego huba).
// Wszystko przez Replicate (REPLICATE_API_TOKEN), wymaga zalogowania.
//
//   { prompt, quality?: "good"|"vip", aspect?: "16:9"|"9:16", image?, singing? } → { job_id, model }
//   { action: "status", job_id }              → { status: "processing"|"completed"|"failed", video_url?, error? }
//   { action: "lipsync", video_url, audio_url } → { job_id, model }   (status jak wyżej)
//   { action: "storyboard", song_prompt, title?, tags?, lyrics?, style?, count?, singing? } → { scenes: string[] }
//
// Adresy wideo z Replicate (replicate.delivery) są ważne ok. godzinę i mają CORS, więc klient
// może je od razu skleić w teledysk; trwałą kopię na R2 robi klient przy publikacji.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Model = { slug: string; input: Record<string, unknown> };

const SINGER = "the same lead singer performing and singing to camera in every shot, expressive face, lips moving";
const QUALITY = "cinematic music video, professional lighting, sharp focus, smooth camera motion";

function videoModels(prompt: string, quality: string, aspect: string, image?: string): Model[] {
  const ar = aspect === "9:16" ? "9:16" : "16:9";
  const list: Model[] = [];
  if (quality === "vip") {
    list.push({
      slug: "minimax/hailuo-02",
      input: { prompt, duration: 6, resolution: "768p", prompt_optimizer: true, ...(image ? { first_frame_image: image } : {}) },
    });
  }
  list.push(
    image
      ? { slug: "wan-video/wan-2.2-i2v-fast", input: { prompt, image } }
      : { slug: "wan-video/wan-2.2-t2v-fast", input: { prompt, aspect_ratio: ar } },
  );
  list.push({ slug: "minimax/video-01", input: { prompt, prompt_optimizer: true, ...(image ? { first_frame_image: image } : {}) } });
  return list;
}

const LIPSYNC_MODELS = (video: string, audio: string): Model[] => [
  { slug: "kwaivgi/kling-lip-sync", input: { video_url: video, audio_file: audio } },
  { slug: "sync/lipsync-2", input: { video, audio } },
];

// Startuje predykcję na pierwszym modelu, który ją przyjmie (bez czekania na wynik).
async function startFirst(token: string, models: Model[]): Promise<{ id: string; model: string } | { error: string }> {
  let last = "";
  for (const m of models) {
    try {
      const r = await fetch(`https://api.replicate.com/v1/models/${m.slug}/predictions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: m.input }),
        signal: AbortSignal.timeout(20_000),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.id) return { id: d.id, model: m.slug };
      last = `${m.slug}: ${d?.detail || d?.error || `HTTP ${r.status}`}`;
      console.warn("[studio-video] model odrzucił zadanie:", last);
      if (r.status === 401) return { error: "Nieprawidłowy klucz Replicate (REPLICATE_API_TOKEN)" };
      if (r.status === 402) return { error: "Brak środków na koncie Replicate — doładuj konto" };
    } catch (e) {
      last = `${m.slug}: ${String(e)}`;
    }
  }
  return { error: `Silnik wideo nie przyjął zadania (${last})` };
}

function heuristicScenes(base: string, count: number, singing: boolean): string[] {
  const shots = [
    "wide establishing shot, slow dolly in",
    "medium shot, warm backlight, gentle handheld movement",
    "close-up, shallow depth of field, slow motion",
    "aerial drone shot, golden hour",
    "tracking shot following the subject, neon reflections",
    "low angle hero shot, dramatic light rays",
  ];
  return Array.from({ length: count }, (_, i) =>
    [base, shots[i % shots.length], singing ? SINGER : "", QUALITY].filter(Boolean).join(", "));
}

async function storyboard(body: any): Promise<string[]> {
  const count = Math.min(Math.max(Number(body?.count) || 4, 1), 8);
  const singing = !!body?.singing;
  const base = String(body?.style || body?.song_prompt || body?.title || "music video").slice(0, 300);
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (key) {
    const sys = `You are a music video director. Return STRICT JSON {"scenes":[...]} with exactly ${count} short English text-to-video prompts (max 40 words each), one continuous visual story matching the song. Each prompt: subject, setting, action, camera move, lighting.${singing ? ` Every scene shows ${SINGER}.` : ""}`;
    const usr = `Song idea: ${body?.song_prompt || ""}\nTitle: ${body?.title || ""}\nTags: ${body?.tags || ""}\nLyrics: ${String(body?.lyrics || "").slice(0, 1500)}\nVisual style hint: ${body?.style || "(free)"}`;
    for (const model of ["google/gemma-4-31b-it:free", "meta-llama/llama-3.3-70b-instruct:free"]) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Stream" },
          body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, { role: "user", content: usr }], response_format: { type: "json_object" } }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) continue;
        const j = await r.json();
        const raw = String(j.choices?.[0]?.message?.content || "").replace(/^```(?:json)?\s*|\s*```$/g, "");
        const scenes = (JSON.parse(raw)?.scenes || []).filter((s: unknown) => typeof s === "string" && s.trim().length > 3);
        if (scenes.length) return scenes.slice(0, count).map((s: string) => `${s}, ${QUALITY}`);
      } catch (e) {
        console.warn("[studio-video] storyboard LLM:", model, e);
      }
    }
  }
  return heuristicScenes(base, count, singing);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u } = await auth.auth.getUser();
  if (!u?.user) return json({ error: "Zaloguj się, aby tworzyć wideo" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = String(body?.action || "generate");

  if (action === "storyboard") return json({ scenes: await storyboard(body) });

  const token = Deno.env.get("REPLICATE_API_TOKEN");
  if (!token) return json({ error: "Brak sekretu REPLICATE_API_TOKEN w projekcie" });

  if (action === "status") {
    const id = String(body?.job_id || "");
    if (!/^[a-z0-9]+$/i.test(id)) return json({ status: "failed", error: "Nieprawidłowe zadanie" });
    try {
      const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.status === "succeeded") {
        const out = d.output;
        const url = typeof out === "string" ? out : Array.isArray(out) ? out[0] : out?.video || null;
        return url ? json({ status: "completed", video_url: url }) : json({ status: "failed", error: "Silnik nie zwrócił pliku" });
      }
      if (d?.status === "failed" || d?.status === "canceled") return json({ status: "failed", error: String(d?.error || "Generowanie nie powiodło się").slice(0, 300) });
      return json({ status: "processing" });
    } catch {
      return json({ status: "processing" }); // chwilowy błąd — klient zapyta ponownie
    }
  }

  if (action === "lipsync") {
    const v = String(body?.video_url || ""), a = String(body?.audio_url || "");
    if (!/^https:\/\//.test(v) || !/^https:\/\//.test(a)) return json({ error: "Potrzebne video_url i audio_url" }, 400);
    const started = await startFirst(token, LIPSYNC_MODELS(v, a));
    return "error" in started ? json({ error: started.error }) : json({ job_id: started.id, model: started.model });
  }

  // generate
  const raw = String(body?.prompt || "").trim();
  if (raw.length < 3) return json({ error: "Opisz krótko scenę" }, 400);
  const prompt = [raw, body?.singing ? SINGER : "", QUALITY].filter(Boolean).join(", ").slice(0, 1000);
  const image = typeof body?.image === "string" && /^https:\/\//.test(body.image) ? body.image : undefined;
  const started = await startFirst(token, videoModels(prompt, String(body?.quality || "good"), String(body?.aspect || "16:9"), image));
  return "error" in started ? json({ error: started.error }) : json({ job_id: started.id, model: started.model });
});
