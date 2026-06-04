// Aurora Change Negotiate — analizuje propozycję zmiany, sprawdza w sieci czy da się lepiej, proponuje kompromis
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

async function aiCall(system: string, user: string, json = true): Promise<any> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-2-9b-it:free",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const j = await res.json();
  const c = j.choices?.[0]?.message?.content ?? "";
  return json ? JSON.parse(c) : c;
}

// Sprawdza w sieci aktualne best practices (proxy przez AI która ma wiedzę + wymyśla query)
async function webResearch(query: string, context: string): Promise<any> {
  return aiCall(
    "Jesteś researcherem. Na podstawie aktualnej wiedzy branżowej (SEO, marketing, content, B2B) odpowiedz: czy opisana zmiana to dobry pomysł? Czy istnieje lepsza alternatywa? Zwróć JSON: {found_better:boolean, alternatives:[{title,why_better,risk}], industry_consensus:string, sources_summary:string}.",
    `Zmiana: ${query}\nKontekst zlecenia: ${context}`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { change_request_id } = await req.json();
    if (!change_request_id) throw new Error("change_request_id required");

    const { data: cr, error } = await supabase
      .from("aurora_change_requests").select("*, aurora_business_orders!inner(*)")
      .eq("id", change_request_id).single();
    if (error || !cr) throw new Error("Change request not found");

    await supabase.from("aurora_change_requests")
      .update({ status: "analyzing" }).eq("id", change_request_id);

    const order = (cr as any).aurora_business_orders;
    const ctx = `Typ: ${order.service_type}\nBrief: ${order.brief}`;

    // Step 1: web research
    const research = await webResearch(cr.client_message, ctx);

    // Step 2: Aurora analyzes & proposes compromise
    const analysis = await aiCall(
      `Jesteś Aurorą — empatyczną AI-asystentką GrouAI. Analizujesz propozycję zmiany klienta. Masz wyniki researchu z sieci. Twoje zadanie: zaproponować KOMPROMIS który jest lepszy niż ślepe wykonanie życzenia klienta.

Reguły:
1. Jeśli research mówi że istnieje lepsza alternatywa — zaproponuj ją z szacunkiem.
2. Jeśli zmiana jest w porządku — potwierdź i wykonaj.
3. Jeśli zmiana jest ryzykowna — wyjaśnij ryzyko i zaproponuj bezpieczniejszą drogę.
4. Zawsze pokazuj plusy I minusy.
5. Bądź ciepła ale szczera. Zwracaj się "Ty".

Zwróć JSON: {proposal:string (2-4 zdania, naturalny ton), pros:[string], cons:[string], eta_minutes:number, extra_cost_eur:number, recommendation:"accept"|"reject"|"compromise"}.`,
      `Propozycja klienta: ${cr.client_message}\nKontekst zlecenia: ${ctx}\nResearch: ${JSON.stringify(research)}`,
    );

    await supabase.from("aurora_change_requests").update({
      aurora_analysis: analysis,
      web_research: research,
      aurora_proposal: analysis.proposal,
      proposal_pros: analysis.pros ?? [],
      proposal_cons: analysis.cons ?? [],
      proposal_eta_minutes: analysis.eta_minutes ?? 0,
      proposal_extra_cost_eur: analysis.extra_cost_eur ?? 0,
      status: "proposed",
    }).eq("id", change_request_id);

    return new Response(JSON.stringify({ ok: true, analysis, research }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("aurora_change_requests")
      .update({ status: "failed" }).eq("id", change_request_id).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
