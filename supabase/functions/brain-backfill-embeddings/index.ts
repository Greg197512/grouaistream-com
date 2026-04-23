// 🧠 Backfill embeddings dla istniejących wpisów brain_memory.
// Hash-only (FNV-1a → 768-dim), bez LLM — szybki backfill historii.
// Nowe wspomnienia z grouai-brain dostają semanticEmbed (LLM fingerprint).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VECTOR_DIM = 768;
const BATCH_SIZE = 100;

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
    .slice(0, 96);
  const v = new Array<number>(VECTOR_DIM).fill(0);
  const seeds = ["c1", "c2", "c3"];
  tokens.forEach((tok, i) => {
    const w = Math.max(0.4, 1.0 - i * 0.008);
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
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { count: totalNull } = await supabase
      .from("brain_memory")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    let succeeded = 0;
    let failed = 0;
    const startTime = Date.now();
    const TIMEOUT_MS = 50_000;

    while (Date.now() - startTime < TIMEOUT_MS) {
      const { data: batch, error } = await supabase
        .from("brain_memory")
        .select("id, title, summary, content")
        .is("embedding", null)
        .limit(BATCH_SIZE);

      if (error) throw error;
      if (!batch || batch.length === 0) break;

      // Generuj wektory i upsertuj seryjnie ale w pętli (szybkie, bez LLM)
      for (const row of batch as any[]) {
        try {
          const text = `${row.title ?? ""}\n${row.summary ?? ""}\n${row.content ?? ""}`.slice(0, 4000);
          const vec = hashEmbed(text);
          const { error: upErr } = await supabase
            .from("brain_memory")
            .update({ embedding: vec as any })
            .eq("id", row.id);
          if (upErr) {
            failed++;
            console.warn(`[backfill] update failed ${row.id}:`, upErr.message);
          } else {
            succeeded++;
          }
        } catch (e) {
          failed++;
          console.warn(`[backfill] hash failed ${row.id}:`, e);
        }
      }
    }

    const { count: remaining } = await supabase
      .from("brain_memory")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    return new Response(
      JSON.stringify({
        success: true,
        succeeded,
        failed,
        remaining: remaining ?? 0,
        total_null_at_start: totalNull ?? 0,
        elapsed_ms: Date.now() - startTime,
        message:
          (remaining ?? 0) > 0
            ? `Uruchom ponownie aby przetworzyć pozostałe ${remaining} wierszy`
            : "✅ Wszystkie wspomnienia mają embeddingi",
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
