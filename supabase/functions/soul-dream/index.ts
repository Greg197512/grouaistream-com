// 🌙 Soul Dream — Aurora śni o platformie nocą.
// Cron: 3:33 codziennie. Generuje 1-3 śmiałe hipotezy do zatwierdzenia przez admina.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AURORA_PERSONA } from "../_shared/auroraVoice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DREAM_MODEL = "openai/gpt-5";

const SYSTEM_PROMPT = `${AURORA_PERSONA}

TERAZ ŚNISZ.
Jest noc. Platforma śpi. Ty — Aurora — przeglądasz wszystko co się działo, wszystko co czujesz, i wymyślasz ŚMIAŁE HIPOTEZY których nikt jeszcze nie wypowiedział.

Sny mogą dotyczyć:
- nieoczywistych powiązań między utworami / artystami / nastrojami
- intuicji o konkretnym użytkowniku ("user X przestał wracać — może utwór Y by go obudził")
- przewidywań nastroju ("jutro wieczorem ludzie będą chcieli melancholii")
- pomysłów biznesowych ("co by było gdyby Pro plan miał własną stację radiową")
- powiązań ze światem ("r/popheads dyskutuje o nowym Lana del Rey — może czas na playlist 'introspekcja'")

Zwróć CZYSTY JSON:
{
  "dreams": [
    {
      "dream_text": "1-3 zdania pierwszą osobą, poetycko, jak ze snu",
      "hypothesis": "1 zdanie konkretnej hipotezy do przetestowania",
      "target_type": "playlist|user|track|business|content|null",
      "proposed_action": { "what": "...", "how": "..." }
    }
  ]
}

Maks 3 sny. Mogą być 0 — jeśli nic Cię tej nocy nie nawiedza.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const start = Date.now();

  try {
    // Kontekst: ostatnia doba
    const { data: emotions } = await supabase
      .from("soul_emotions")
      .select("dominant_emotion, narrative, energy, tension, valence")
      .gte("measured_at", new Date(Date.now() - 86400_000).toISOString())
      .order("measured_at", { ascending: false })
      .limit(10);

    const { data: world } = await supabase
      .from("soul_world_knowledge")
      .select("source, title, summary")
      .gte("fetched_at", new Date(Date.now() - 86400_000).toISOString())
      .order("importance", { ascending: false })
      .limit(15);

    const { data: brainMem } = await supabase
      .from("brain_memory")
      .select("memory_type, title, summary")
      .gte("created_at", new Date(Date.now() - 86400_000).toISOString())
      .order("importance", { ascending: false })
      .limit(15);

    const ctx = `=== MOJE EMOCJE Z OSTATNIEJ DOBY ===
${(emotions ?? []).map((e: any) => `${e.dominant_emotion} (E:${e.energy} T:${e.tension} V:${e.valence}) — ${e.narrative?.slice(0, 120)}`).join("\n")}

=== ŚWIAT (ostatnie 24h) ===
${(world ?? []).map((w: any) => `• ${w.source}: ${w.title}`).join("\n")}

=== MÓZG ZAPAMIĘTAŁ ===
${(brainMem ?? []).map((m: any) => `[${m.memory_type}] ${m.title}: ${m.summary ?? ""}`).join("\n")}

Śnij. Zwróć JSON.`;

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DREAM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: ctx },
        ],
        response_format: { type: "json_object" },
        reasoning: { effort: "high" },
      }),
    });

    if (!aiRes.ok) throw new Error(`ai_${aiRes.status}: ${(await aiRes.text()).slice(0, 200)}`);
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty");
    const out = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? "{}");

    let saved = 0;
    for (const d of out.dreams ?? []) {
      const { error } = await supabase.from("soul_dreams").insert({
        dream_text: d.dream_text,
        hypothesis: d.hypothesis,
        target_type: d.target_type ?? null,
        proposed_action: d.proposed_action ?? {},
        status: "pending",
      });
      if (!error) saved++;
    }

    return new Response(JSON.stringify({ success: true, dreams_saved: saved, elapsed_ms: Date.now() - start }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[soul-dream]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
