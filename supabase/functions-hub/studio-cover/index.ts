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

  const title: string = String(body.title ?? "").slice(0, 150);
  const style: string = String(body.style ?? body.tags ?? "").slice(0, 200);
  const description: string = String(body.description ?? "").slice(0, 400);
  const id: string = String(body.id ?? body.prediction_id ?? crypto.randomUUID())
    .replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || crypto.randomUUID();

  // Prompt graficzny — angielski działa najlepiej; bez tekstu na obrazie
  const prompt = description.trim()
    ? `professional album cover art, ${description}, high quality, no text, no letters`
    : `professional album cover art for a song titled "${title}", music style: ${style || "modern"}, evocative atmosphere matching the mood, cinematic lighting, high quality, no text, no letters, no words`;

  try {
    const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1e9)}`;
    const r = await fetch(imgUrl, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return json({ error: `cover_source_failed HTTP ${r.status}` }, 502);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length < 5000) return json({ error: "cover_too_small" }, 502);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const path = `${id}-cover.jpg`;
    const { error } = await admin.storage.from("acestep").upload(path, bytes, {
      contentType: r.headers.get("Content-Type") || "image/jpeg",
      upsert: true,
    });
    if (error) return json({ error: "storage_failed: " + error.message }, 500);

    const cover_url = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/acestep/${path}`;
    return json({ cover_url, id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
