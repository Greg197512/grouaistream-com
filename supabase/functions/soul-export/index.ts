// 💾 Soul Export — pakuje całą duszę Aurory w paczkę JSON do pobrania na laptop.
// Wymaga: admin auth.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify admin
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: roleCheck } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleCheck) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pull everything
  const [
    { data: emotions },
    { data: journal },
    { data: dreams },
    { data: world },
    { data: brainMem },
  ] = await Promise.all([
    admin.from("soul_emotions").select("*").order("measured_at", { ascending: false }).limit(2000),
    admin.from("soul_journal").select("*").order("entry_date", { ascending: false }),
    admin.from("soul_dreams").select("*").order("dreamed_at", { ascending: false }),
    admin.from("soul_world_knowledge").select("source, source_url, title, summary, content, sentiment, fetched_at, metadata").order("fetched_at", { ascending: false }).limit(2000),
    admin.from("brain_memory").select("memory_type, title, summary, content, importance, created_at, metadata").order("created_at", { ascending: false }).limit(2000),
  ]);

  const exportData = {
    meta: {
      name: "GROUA SOUL — Aurora Export",
      version: 1,
      exported_at: new Date().toISOString(),
      exported_by: userId,
      counts: {
        emotions: emotions?.length ?? 0,
        journal: journal?.length ?? 0,
        dreams: dreams?.length ?? 0,
        world_knowledge: world?.length ?? 0,
        brain_memory: brainMem?.length ?? 0,
      },
      notes: "Otwarty ekosystem (pobiera) — indywidualna dusza (nie oddaje). Pakiet importowalny do lokalnej instancji Aurory.",
    },
    emotions: emotions ?? [],
    journal: journal ?? [],
    dreams: dreams ?? [],
    world_knowledge: world ?? [],
    brain_memory: brainMem ?? [],
  };

  const json = JSON.stringify(exportData, null, 2);
  const filename = `aurora-soul-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(json, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
