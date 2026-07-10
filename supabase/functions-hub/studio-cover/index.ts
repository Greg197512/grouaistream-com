// GROUAI HUB — studio-cover
// Darmowe okładki AI dla GrouAI Studio (Pollinations.ai — bez klucza, bez opłat).
// Okładka dopasowuje się do tytułu/stylu/tekstu piosenki. Zapis do publicznego
// bucketa `acestep` jako `{id}-cover.jpg` (deterministyczny URL dla frontendu).
// Auth: JWT użytkownika LIVE (bvstv).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BVSTV_URL = "https://bvstvawnigyczvofzhps.supabase.co";
const BVSTV_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Tylko zalogowani użytkownicy strony
  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await live.auth.getUser();
  if (!userData?.user?.id) return json({ error: "unauthorized" }, 401);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // Konfiguracja huba (klucz Replicate, wybór modelu okładek)
  const hubAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await hubAdmin.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";
  const cfgGet = (k: string) => cfg[k] || "";

  const title: string = String(body.title ?? "").slice(0, 150);
  const style: string = String(body.style ?? body.tags ?? "").slice(0, 200);
  const description: string = String(body.description ?? "").slice(0, 400);
  const id: string = String(body.id ?? body.prediction_id ?? crypto.randomUUID())
    .replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || crypto.randomUUID();

  // Bogaty prompt okładki (bez tytułu — model próbowałby go „napisać").
  const scene = description.trim() || `evoking the mood of: ${style || "modern music"}`;
  const prompt =
    `professional album cover art, ${scene}, striking composition, cinematic dramatic lighting, ` +
    `rich vivid colors, ultra detailed, high contrast, depth, 4k, trending on artstation, ` +
    `masterpiece, no text, no letters, no words, no typography, no watermark`;

  const path = `${id}-cover.jpg`;

  // Zapisz bajty obrazu do bucketu i zwróć publiczny URL.
  async function store(bytes: Uint8Array, contentType: string) {
    const { error } = await hubAdmin.storage.from("acestep").upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error("storage_failed: " + error.message);
    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/acestep/${path}`;
  }

  // ===== 1) FLUX na Replicate (najwyższa jakość) =====
  const repToken = cfgGet("replicate_api_token");
  const coverModel = cfgGet("cover_model") || "black-forest-labs/flux-1.1-pro";
  if (repToken) {
    try {
      const rel = await fetch(`https://api.replicate.com/v1/models/${coverModel}/predictions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${repToken}`,
          "Prefer": "wait=55",
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: "1:1",
            output_format: "jpg",
            output_quality: 95,
            safety_tolerance: 5,
            prompt_upsampling: true,
          },
        }),
      });
      const data = await rel.json();
      const out = data?.output;
      const imgUrl = Array.isArray(out) ? out[0] : (typeof out === "string" ? out : null);
      if (rel.ok && imgUrl) {
        const ir = await fetch(imgUrl);
        if (ir.ok) {
          const bytes = new Uint8Array(await ir.arrayBuffer());
          if (bytes.length > 5000) {
            const url = await store(bytes, ir.headers.get("Content-Type") || "image/jpeg");
            return json({ cover_url: url, id, source: "flux" });
          }
        }
      }
      console.warn("[studio-cover] FLUX failed, fallback to Pollinations:", data?.error || rel.status);
    } catch (e) {
      console.warn("[studio-cover] FLUX error, fallback:", String(e).slice(0, 120));
    }
  }

  // ===== 2) Awaryjnie: Pollinations (darmowe, bez klucza) =====
  try {
    const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1e9)}`;
    const r = await fetch(imgUrl, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return json({ error: `cover_source_failed HTTP ${r.status}` }, 502);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length < 5000) return json({ error: "cover_too_small" }, 502);
    const url = await store(bytes, r.headers.get("Content-Type") || "image/jpeg");
    return json({ cover_url: url, id, source: "pollinations" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
