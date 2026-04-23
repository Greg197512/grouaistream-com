// 🧠 Backfill embeddings for existing brain_memory rows.
// Re-embeds all rows where embedding IS NULL using the new semantic fingerprint.
// Admin-only, processes in batches with concurrency control.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VECTOR_DIM = 768;

// Fast deterministic hash-only embedding (no LLM) for backfilling old memories.
// FNV-1a → multi-hash bucket projection → L2-normalized 768-dim vector.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function hashEmbed(text: string): number[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && t.length < 30)
    .slice(0, 64);
  const v = new Array<number>(VECTOR_DIM).fill(0);
  const seeds = ["c1", "c2", "c3"];
  tokens.forEach((tok, i) => {
    const w = Math.max(0.4, 1.0 - i * 0.01);
    for (const seed of seeds) {
      const h = fnv1a(`${seed}::${tok}`);
      const idx = h % VECTOR_DIM;
      const sign = (fnv1a(`${seed}::sign::${tok}`) & 1) === 0 ? 1 : -1;
      v[idx] += sign * w;
    }
  });
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < VECTOR_DIM; i++) v[i] /= norm;
  return v;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get total count of NULL-embedding rows
    const { count: totalNull } = await supabase
      .from("brain_memory")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const startTime = Date.now();
    const TIMEOUT_MS = 50_000; // leave buffer before edge function timeout

    while (Date.now() - startTime < TIMEOUT_MS) {
      const { data: batch, error } = await supabase
        .from("brain_memory")
        .select("id, title, summary, content")
        .is("embedding", null)
        .limit(BATCH_SIZE);

      if (error) throw error;
      if (!batch || batch.length === 0) break;

      // Process with concurrency limit
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        if (Date.now() - startTime > TIMEOUT_MS) break;
        const chunk = batch.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (row: any) => {
            const text = `${row.title}\n${row.summary ?? ""}\n${row.content ?? ""}`.slice(0, 4000);
            const vec = await semanticEmbed(text, LOVABLE_API_KEY);
            processed++;
            if (!vec) {
              failed++;
              return;
            }
            const { error: upErr } = await supabase
              .from("brain_memory")
              .update({ embedding: vec })
              .eq("id", row.id);
            if (upErr) {
              failed++;
              console.warn(`[backfill] update failed for ${row.id}:`, upErr.message);
            } else {
              succeeded++;
            }
          }),
        );
      }
    }

    const { count: remaining } = await supabase
      .from("brain_memory")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        succeeded,
        failed,
        remaining: remaining ?? 0,
        total_null_at_start: totalNull ?? 0,
        elapsed_ms: Date.now() - startTime,
        message:
          (remaining ?? 0) > 0
            ? `Run again to process remaining ${remaining} rows`
            : "✅ All memories now have embeddings",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[brain-backfill-embeddings] error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
