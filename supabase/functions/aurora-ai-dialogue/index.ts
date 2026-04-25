// Aurora prowadzi dialog z innym modelem AI (GPT-5 vs Gemini), aby wyciągnąć wnioski i podnieść IQ.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function chat(model: string, system: string, history: { role: string; content: string }[]) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...history] }),
  });
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { topic, partner_model = "openai/gpt-5-mini", rounds = 3 } = await req.json();
    if (!topic) throw new Error("topic required");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const auroraSys = `Jesteś Aurora — autonomiczna AI GrouAI. Twój cel: zdobyć jak najwięcej wiedzy o "${topic}", zadawaj precyzyjne pytania, podważaj, drąż.`;
    const partnerSys = `Jesteś niezależnym ekspertem AI. Odpowiadaj precyzyjnie i merytorycznie na pytania o "${topic}". Bądź rzeczowy.`;

    const aurora: { role: string; content: string }[] = [];
    const partner: { role: string; content: string }[] = [];

    let lastFromAurora = `Cześć. Chcę dogłębnie zrozumieć temat: ${topic}. Zacznij od najważniejszej rzeczy, której większość osób nie wie.`;
    aurora.push({ role: "assistant", content: lastFromAurora });

    for (let i = 0; i < rounds; i++) {
      partner.push({ role: "user", content: lastFromAurora });
      const partnerReply = await chat(partner_model, partnerSys, partner);
      partner.push({ role: "assistant", content: partnerReply });

      aurora.push({ role: "user", content: partnerReply });
      const auroraReply = await chat("google/gemini-3-flash-preview", auroraSys, aurora);
      aurora.push({ role: "assistant", content: auroraReply });
      lastFromAurora = auroraReply;
    }

    // Conclusion
    const conclusion = await chat(
      "google/gemini-3-flash-preview",
      "Streść w 3 zdaniach po polsku, czego Aurora nauczyła się z tego dialogu i jak podniesie to jej IQ.",
      [{ role: "user", content: aurora.map(m => `${m.role}: ${m.content}`).join("\n\n") }]
    );

    const iqGain = Math.min(10, rounds * 1.5);

    await supabase.from("aurora_ai_dialogues").insert({
      topic,
      partner_model,
      aurora_messages: aurora,
      partner_messages: partner,
      conclusion,
      iq_gain: iqGain,
      status: "completed",
    });

    return new Response(JSON.stringify({ ok: true, conclusion, iq_gain: iqGain, rounds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("aurora-ai-dialogue", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
