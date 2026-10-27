// Upload pliku użytkownika na R2 przez edge (multipart: file + folder).
// Zapis przez _shared/r2.ts (fetch + SigV4) — @aws-sdk/client-s3 zawieszał się na PutObject,
// przez co wgrywanie piosenek, sampli i nagrań w GrouAI Studio kończyło się błędem.
//
// Akcje serwisowe (JSON, stała treść — bez danych od wołającego):
//   {"action":"setup-cors"}  ustawia CORS zasobnika (bezpośredni PUT z przeglądarki + GET)
//   {"action":"cors-status"} odczyt CORS
//   {"action":"selftest"}    zapis małego pliku testowego
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getBucketCors, putToR2Checked, setupBucketCors } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function sanitizeFilename(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "upload.bin";
}

async function userIdFrom(authHeader: string): Promise<string | null> {
  if (!authHeader.startsWith("Bearer ")) return null;
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.slice(7);
  try {
    const { data } = await client.auth.getClaims(token);
    if (data?.claims?.sub) return data.claims.sub as string;
  } catch { /* niżej */ }
  try {
    const { data } = await client.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Akcje serwisowe
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      const { action } = await req.json().catch(() => ({ action: null }));
      if (action === "setup-cors") return json(await setupBucketCors());
      if (action === "cors-status") return json(await getBucketCors());
      if (action === "selftest") {
        const r = await putToR2Checked({ body: new TextEncoder().encode(`ok ${new Date().toISOString()}`), folder: "selftest", fileName: "ping.txt", contentType: "text/plain" });
        return json(r, r.url ? 200 : 502);
      }
      return json({ error: "unknown action" }, 400);
    }

    const userId = await userIdFrom(req.headers.get("authorization") || "");
    if (!userId) return json({ error: "Zaloguj się, aby wgrywać pliki." }, 401);

    const formData = await req.formData();
    const file = formData.get("file");
    const folderValue = formData.get("folder");
    if (!(file instanceof File)) return json({ error: "file is required" }, 400);

    const folder = typeof folderValue === "string" && folderValue.trim() ? folderValue.trim().replace(/^\/+|\/+$/g, "") : "tracks";
    const fileName = `${Date.now()}-${sanitizeFilename(file.name)}`;
    const put = await putToR2Checked({
      body: new Uint8Array(await file.arrayBuffer()),
      folder,
      fileName,
      contentType: file.type || "application/octet-stream",
    });
    if (!put.url) return json({ error: `Zapis na dysk nie powiódł się: ${put.error}` }, 502);
    return json({ publicUrl: put.url, key: `${folder}/${fileName}` });
  } catch (err) {
    console.error("r2-upload-proxy error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
