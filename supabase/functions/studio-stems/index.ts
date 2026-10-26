// studio-stems — rozkładanie utworu na ścieżki (Demucs na Replicate), zastępuje funkcję
// usuniętego huba. Wymaga zalogowania i REPLICATE_API_TOKEN.
//
//   { audio_url, mode?: "2" | "4" | "6" }      → { task_id, job_id }
//   { action: "status", task_id }              → { status: "processing" | "succeeded" | "failed", stems?, error? }
//
// mode 2: wokal + akompaniament, 4: wokal/perkusja/bas/reszta, 6: + gitara, pianino.
// Gotowe ścieżki kopiujemy na R2 (linki Replicate wygasają po ok. godzinie).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { putToR2Checked } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "cjwbw/demucs";
let cachedVersion: string | null = null;

async function latestVersion(token: string): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const r = await fetch(`https://api.replicate.com/v1/models/${MODEL}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
  });
  const d = await r.json().catch(() => ({}));
  const v = d?.latest_version?.id;
  if (!v) throw new Error(`Nie znaleziono modelu ${MODEL} (HTTP ${r.status})`);
  cachedVersion = v;
  return v;
}

function inputFor(audio: string, mode: string) {
  if (mode === "2") return { audio, model_name: "htdemucs", stem: "vocals", output_format: "mp3", mp3_bitrate: 320 };
  if (mode === "6") return { audio, model_name: "htdemucs_6s", output_format: "mp3", mp3_bitrate: 320 };
  return { audio, model_name: "htdemucs", output_format: "mp3", mp3_bitrate: 320 };
}

/** Wyjście modelu bywa obiektem {nazwa: url} albo tablicą adresów — sprowadzamy do mapy. */
function stemsFromOutput(out: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (out && typeof out === "object" && !Array.isArray(out)) {
    for (const [k, v] of Object.entries(out as Record<string, unknown>)) if (typeof v === "string" && v.startsWith("http")) map[k] = v;
  } else if (Array.isArray(out)) {
    for (const v of out) {
      if (typeof v !== "string") continue;
      const name = v.split("/").pop()?.replace(/\.[a-z0-9]+(\?.*)?$/i, "") || `stem${Object.keys(map).length + 1}`;
      map[name] = v;
    }
  }
  // Demucs w trybie 2 ścieżek nazywa akompaniament „no_vocals”.
  if (map.no_vocals) { map.instrumental = map.no_vocals; delete map.no_vocals; }
  return map;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("authorization") || "" } },
  });
  const { data: u } = await auth.auth.getUser();
  if (!u?.user) return json({ error: "Zaloguj się, aby rozdzielać utwory" }, 401);

  const token = Deno.env.get("REPLICATE_API_TOKEN");
  if (!token) return json({ error: "Brak sekretu REPLICATE_API_TOKEN w projekcie" });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  if (body.action === "status") {
    const id = String(body.task_id || body.job_id || "");
    if (!/^[a-z0-9]+$/i.test(id)) return json({ status: "failed", error: "Nieprawidłowe zadanie" });
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (d?.status === "failed" || d?.status === "canceled") return json({ status: "failed", error: String(d?.error || "Rozdzielanie nie powiodło się").slice(0, 300) });
    if (d?.status !== "succeeded") return json({ status: "processing" });

    const raw = stemsFromOutput(d.output);
    // Kopia na R2 równolegle; gdy się nie uda, zostaje link Replicate (ważny ok. godzinę).
    const entries = await Promise.all(Object.entries(raw).map(async ([name, url]) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
        if (!res.ok) return [name, url] as const;
        const put = await putToR2Checked({
          body: new Uint8Array(await res.arrayBuffer()), folder: `stems/${u.user.id}`,
          fileName: `${id}-${name}.mp3`, contentType: "audio/mpeg",
        });
        return [name, put.url || url] as const;
      } catch {
        return [name, url] as const;
      }
    }));
    return json({ status: "succeeded", stems: Object.fromEntries(entries) });
  }

  const audio = String(body.audio_url || "");
  if (!/^https:\/\//.test(audio)) return json({ error: "Potrzebny adres utworu (https)" }, 400);
  const mode = ["2", "4", "6"].includes(String(body.mode)) ? String(body.mode) : "4";
  try {
    const version = await latestVersion(token);
    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ version, input: inputFor(audio, mode) }),
      signal: AbortSignal.timeout(20_000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 402) return json({ error: "Brak środków na koncie Replicate — doładuj konto" });
    if (!r.ok || !d?.id) return json({ error: `Replicate: ${d?.detail || d?.error || `HTTP ${r.status}`}` });
    return json({ task_id: d.id, job_id: d.id, mode });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e).slice(0, 300) });
  }
});
