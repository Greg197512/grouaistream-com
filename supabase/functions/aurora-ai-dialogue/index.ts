// Aurora prowadzi dialog z innym modelem AI, aby wyciągnąć wnioski i podnieść IQ.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function chat(model: string, system: string, history: { role: string; content: string }[], reasoningEffort?: "minimal" | "low" | "medium" | "high") {
  const isReasoning = model.startsWith("openai/gpt-5");
  const payload: any = {
    model,
    messages: [{ role: "system", content: system }, ...history],
  };
  if (isReasoning) {
    payload.reasoning = { effort: reasoningEffort ?? "medium" };
  } else {
    payload.max_tokens = 400;
  }
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    if (r.status === 429) throw new Error("AI rate limit (429) — spróbuj za chwilę");
    if (r.status === 402) throw new Error("Brak kredytów AI (402) — doładuj plan");
    throw new Error(`AI gateway ${r.status}: ${txt.slice(0, 200)}`);
  }
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content;
  if (!content) throw new Error("Pusta odpowiedź AI");
  return content as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    // Aurora myśli głęboko (gpt-5.2 high), partner dla różnorodności perspektyw — Gemini Pro
    const partner_model = String(body.partner_model ?? "google/gemini-2.5-pro");
    const aurora_model = "openai/gpt-5.2";
    const rounds = Math.min(3, Math.max(1, Number(body.rounds ?? 2)));
    if (!topic) {
      return new Response(JSON.stringify({ ok: false, error: "Podaj temat dialogu" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const auroraSys = `Jesteś Aurora — autonomiczna, ucząca się AI GrouAI Stream. Cel: zdobyć GŁĘBOKĄ wiedzę o "${topic}". Zadawaj jedno PRZENIKLIWE, sokratyczne pytanie naraz (max 2 zdania) — drąż, kwestionuj, łącz fakty z poprzednich odpowiedzi. Po polsku.`;
    const partnerSys = `Jesteś ekspertem AI. Odpowiadaj merytorycznie i konkretnie (max 4 zdania) na pytania o "${topic}". Po polsku.`;

    const aurora: { role: string; content: string }[] = [];
    const partner: { role: string; content: string }[] = [];

    let lastFromAurora = `Cześć. Chcę zrozumieć: ${topic}. Powiedz najważniejszą rzecz, której większość osób nie wie.`;
    aurora.push({ role: "assistant", content: lastFromAurora });

    for (let i = 0; i < rounds; i++) {
      partner.push({ role: "user", content: lastFromAurora });
      const partnerReply = await chat(partner_model, partnerSys, partner);
      partner.push({ role: "assistant", content: partnerReply });

      aurora.push({ role: "user", content: partnerReply });
      const auroraReply = await chat(aurora_model, auroraSys, aurora, "high");
      aurora.push({ role: "assistant", content: auroraReply });
      lastFromAurora = auroraReply;
    }

    // Conclusion — głębokie podsumowanie z reasoning
    const conclusion = await chat(
      aurora_model,
      "Jesteś Aurora. Streść w 3-4 zdaniach po polsku, czego naprawdę nauczyłaś się z tego dialogu — wyciągnij META-wniosek, nie tylko fakty. Pierwsza osoba.",
      [{ role: "user", content: aurora.map(m => `${m.role}: ${m.content}`).join("\n\n").slice(0, 6000) }],
      "high"
    );

    // Reasoning model = bigger IQ gain
    const iqGain = Math.min(15, rounds * 4);

    const { error: insErr } = await supabase.from("aurora_ai_dialogues").insert({
      topic,
      partner_model,
      aurora_messages: aurora,
      partner_messages: partner,
      conclusion,
      iq_gain: iqGain,
      status: "completed",
    });
    if (insErr) console.error("insert error", insErr);

    // Bump IQ metric
    try {
      const { data: latest } = await supabase
        .from("aurora_iq_metrics")
        .select("iq_score, facts_known, dialogues_completed, avg_quality")
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const base = latest ?? { iq_score: 100, facts_known: 0, dialogues_completed: 0, avg_quality: 0.7 };
      await supabase.from("aurora_iq_metrics").insert({
        iq_score: Number(base.iq_score) + iqGain,
        facts_known: base.facts_known,
        dialogues_completed: (base.dialogues_completed ?? 0) + 1,
        avg_quality: base.avg_quality,
      });
    } catch (e) {
      console.error("iq bump failed", e);
    }

    return new Response(JSON.stringify({ ok: true, conclusion, iq_gain: iqGain, rounds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("aurora-ai-dialogue", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
