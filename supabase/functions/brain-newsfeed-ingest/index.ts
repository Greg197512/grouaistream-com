// 📡 Brain Newsfeed Ingest — webhook przyjmujący świeże newsy/posty z n8n.
// n8n co 1h pobiera RSS/Reddit/HN, my embedduje + zapisujemy do brain_memory
// jako external_signal z TTL 30 dni. Deduplikacja po hash(url).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { semanticEmbed } from "../_shared/semanticEmbed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IngestItem {
  title: string;
  url: string;
  source_name: string; // np. "Pitchfork — News"
  summary?: string;
  content?: string;
  importance?: number; // 1-10
  metadata?: Record<string, unknown>;
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Use semantic fingerprint (LLM concepts → 768-dim vector)
const embed = (text: string, apiKey: string) => semanticEmbed(text, apiKey);


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = req.headers.get("x-ingest-token") || "";
  if (!token) {
    return new Response(JSON.stringify({ error: "missing_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Walidacja tokenu
  const { data: tokenRow } = await supabase
    .from("n8n_ingest_tokens")
    .select("id, source_type, is_active")
    .eq("token", token)
    .eq("source_type", "brain_newsfeed")
    .maybeSingle();

  if (!tokenRow || !tokenRow.is_active) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { items?: IngestItem[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (items.length === 0) {
    return new Response(JSON.stringify({ ok: true, ingested: 0, message: "no items" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ingested = 0;
  let skipped_dedup = 0;
  let skipped_invalid = 0;
  const sourceCounts: Record<string, number> = {};

  for (const item of items) {
    if (!item?.title || !item?.url || !item?.source_name) {
      skipped_invalid++;
      continue;
    }

    const urlHash = await sha256(item.url.toLowerCase().trim());

    // Sprawdź dedup
    const { data: existing } = await supabase
      .from("brain_ingest_dedup")
      .select("url_hash")
      .eq("url_hash", urlHash)
      .maybeSingle();

    if (existing) {
      skipped_dedup++;
      continue;
    }

    const text = `${item.title}\n${item.summary ?? ""}\n${item.content ?? ""}`.slice(0, 4000);
    const embedding = await embed(text, LOVABLE_API_KEY);

    const { error: memErr } = await supabase.from("brain_memory").insert({
      memory_type: "external_signal",
      title: item.title.slice(0, 300),
      summary: (item.summary ?? item.title).slice(0, 500),
      content: text,
      embedding,
      source_url: item.url,
      importance: Math.max(1, Math.min(10, item.importance ?? 4)),
      expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      metadata: {
        source_name: item.source_name,
        ingested_via: "n8n",
        ...(item.metadata ?? {}),
      },
    });

    if (memErr) {
      console.warn("[ingest] memory insert failed:", memErr.message);
      continue;
    }

    await supabase.from("brain_ingest_dedup").insert({
      url_hash: urlHash,
      source_name: item.source_name,
    });

    ingested++;
    sourceCounts[item.source_name] = (sourceCounts[item.source_name] ?? 0) + 1;
  }

  // Aktualizuj statystyki źródeł
  for (const [sourceName, count] of Object.entries(sourceCounts)) {
    const { data: src } = await supabase
      .from("brain_external_sources")
      .select("id, items_ingested_total")
      .eq("name", sourceName)
      .maybeSingle();

    if (src) {
      await supabase
        .from("brain_external_sources")
        .update({
          last_fetched_at: new Date().toISOString(),
          last_status: "ok",
          last_error: null,
          items_ingested_total: (src.items_ingested_total ?? 0) + count,
        })
        .eq("id", src.id);
    }
  }

  // Update token usage
  await supabase
    .from("n8n_ingest_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      total_ingests: (await supabase
        .from("n8n_ingest_tokens")
        .select("total_ingests")
        .eq("id", tokenRow.id)
        .maybeSingle()).data?.total_ingests ?? 0 + 1,
    })
    .eq("id", tokenRow.id);

  // Emit event że Mózg dostał nowe sygnały
  if (ingested > 0) {
    await supabase.rpc("emit_agent_event", {
      _event_type: "newsfeed.ingested",
      _source: "brain-newsfeed-ingest",
      _actor_user_id: null,
      _target_type: null,
      _target_id: null,
      _payload: { ingested, sources: sourceCounts, skipped_dedup },
      _priority: 6,
    }).catch((e) => console.warn("[ingest] emit event failed:", e));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      ingested,
      skipped_dedup,
      skipped_invalid,
      sources: sourceCounts,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
