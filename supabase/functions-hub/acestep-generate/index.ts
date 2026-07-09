// GROUAI HUB — acestep-generate
// Naprawiony silnik ACE-Step (Replicate) dla GrouAI Studio.
// Powód istnienia: wersja na LIVE (bvstv) woła /models/{owner}/{name}/predictions,
// który działa tylko dla modeli oficjalnych → 404 dla lucataco/ace-step.
// Tu: klasyczny POST /v1/predictions z version id + archiwizacja audio do
// Storage huba (linki Replicate wygasają po ~1h).
//
// Auth: JWT użytkownika z LIVE (bvstv) w nagłówku Authorization — weryfikowany
// przez auth bvstv; zapisy do tabeli generations na bvstv idą jako ten user (RLS).
// Klucz Replicate: hub_config.replicate_api_token.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BVSTV_URL = "https://bvstvawnigyczvofzhps.supabase.co";
const BVSTV_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";
const REPLICATE_BASE = "https://api.replicate.com/v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function hubAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function loadConfig(): Promise<Record<string, string>> {
  const { data } = await hubAdmin().from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

function extractAudioUrl(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      return (o.audio as string) || (o.url as string) || "";
    }
  }
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    return (o.audio as string) || (o.url as string) || "";
  }
  return "";
}

// Ściągnij audio z Replicate i zapisz w publicznym buckecie huba.
async function archiveToHubStorage(sourceUrl: string, id: string): Promise<string | null> {
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) return null;
    const contentType = r.headers.get("Content-Type") || "audio/wav";
    const ext = contentType.includes("mpeg") ? "mp3"
      : contentType.includes("flac") ? "flac"
      : contentType.includes("ogg") ? "ogg"
      : "wav";
    const bytes = new Uint8Array(await r.arrayBuffer());
    const path = `${id}.${ext}`;
    const { error } = await hubAdmin().storage.from("acestep").upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.error("[acestep-hub] storage upload failed:", error.message);
      return null;
    }
    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/acestep/${path}`;
  } catch (e) {
    console.error("[acestep-hub] archive error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cfg = await loadConfig();
  const token = cfg["replicate_api_token"] || "";
  if (!token) return json({ error: "replicate_api_token not configured (hub_config)" }, 500);

  const rHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  // Klient bvstv w kontekście zalogowanego użytkownika strony
  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body.action ?? "generate";

  try {
    // ================= STATUS =================
    if (action === "status") {
      const predId = body.task_id || body.prediction_id || body.replicate_id;
      if (!predId) return json({ error: "prediction_id required" }, 400);

      const r = await fetch(`${REPLICATE_BASE}/predictions/${predId}`, { headers: rHeaders });
      const data = await r.json();
      if (!r.ok) return json({ error: "Replicate poll failed", details: data }, r.status);

      const st = data?.status;

      if (st === "succeeded") {
        const audioUrl = extractAudioUrl(data.output);
        if (!audioUrl) return json({ error: "no audio in output", details: data.output }, 502);

        const archived = await archiveToHubStorage(audioUrl, predId);
        const finalUrl = archived || audioUrl;

        if (body.generation_id) {
          await live.from("generations").update({
            status: "completed",
            audio_url: finalUrl,
          }).eq("id", body.generation_id);
        }

        return json({
          id: predId,
          status: "succeeded",
          output: finalUrl,
          audio_url: finalUrl,
          // Okładka generowana równolegle przez studio-cover pod deterministycznym
          // adresem — frontend robi fallback, jeśli plik (jeszcze) nie istnieje.
          cover_url: `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/acestep/${predId}-cover.jpg`,
          r2_archived: !!archived,
        });
      }

      if (st === "failed" || st === "canceled") {
        if (body.generation_id) {
          await live.from("generations").update({ status: "failed" }).eq("id", body.generation_id);
        }
        return json({ id: predId, status: "failed", error: data?.error });
      }

      return json({ id: predId, status: "processing" });
    }

    // ================= GENERATE =================
    const { data: userData } = await live.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    // Generowanie tylko dla planów płatnych (Pro/Ultimate) lub admina —
    // każda generacja kosztuje realne pieniądze na Replicate.
    const [{ data: isAdmin }, { data: subRow }] = await Promise.all([
      live.rpc("has_role", { _user_id: userId, _role: "admin" }),
      live.from("user_subscriptions").select("plan, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
    ]);
    const paidPlan = subRow && (subRow.plan === "pro" || subRow.plan === "ultimate");
    if (!isAdmin && !paidPlan) {
      return json({
        error: "subscription_required",
        message: "Generowanie muzyki wymaga planu Pro lub Ultimate.",
      }, 403);
    }

    const prompt: string = (body.prompt || body.caption || "").trim();
    if (prompt.length < 3) return json({ error: "prompt too short" }, 400);

    const instrumental: boolean = !!body.instrumental;
    const lyrics: string = instrumental ? "[instrumental]" : (body.lyrics || "[instrumental]").trim();
    const duration: number = Math.min(Math.max(body.duration || body.duration_seconds || 60, 10), 240);
    const title: string = body.title || "GrouAI Track";

    // Model społecznościowy ⇒ wymagany version id (endpoint /predictions).
    const modelName = cfg["ace_model"] || "lucataco/ace-step";
    const mr = await fetch(`${REPLICATE_BASE}/models/${modelName}`, { headers: rHeaders });
    const mData = await mr.json();
    const version = mData?.latest_version?.id;
    if (!mr.ok || !version) {
      return json({ error: "Cannot resolve model version", details: mData }, 502);
    }

    const input: Record<string, unknown> = {
      tags: prompt,
      lyrics,
      duration,
      scheduler: "euler",
      guidance_scale: 15,
      number_of_steps: 60,
    };

    const rel = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST",
      headers: rHeaders,
      body: JSON.stringify({ version, input }),
    });
    const relData = await rel.json();
    if (!rel.ok) {
      // Czytelny komunikat, gdy brak środków na koncie Replicate
      if (relData?.status === 402 || rel.status === 402) {
        return json({
          error: "Konto Replicate nie ma środków — doładuj na replicate.com/account/billing",
          details: relData,
        }, 402);
      }
      return json({ error: "Replicate create failed", details: relData }, rel.status);
    }

    const predId = relData?.id;
    if (!predId) return json({ error: "No prediction id from Replicate", details: relData }, 502);

    const { data: gen } = await live.from("generations").insert({
      user_id: userId,
      title,
      genre: body.genre || "ai",
      prompt: prompt.slice(0, 2000),
      lyrics: lyrics.slice(0, 4000),
      instrumental,
      status: "pending",
      replicate_id: predId,
      engine: "acestep",
    }).select().single();

    return json({
      id: predId,
      generation_id: gen?.id ?? null,
      status: "starting",
      engine: "acestep-hub",
      duration,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[acestep-hub] fatal", msg);
    return json({ error: msg }, 500);
  }
});
