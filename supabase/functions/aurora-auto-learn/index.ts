// Aurora Auto-Learn — z opisanego zakresu generuje N podtematów (Lovable AI)
// i kolejkuje je jako jobs, potem od razu uruchamia aurora-web-learn dla każdego.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

async function generateSubtopics(scope: string, count: number): Promise<string[]> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-2-9b-it:free",
      messages: [
        { role: "system", content: "Jesteś planistą nauki Aurory. Z opisanego zakresu wygeneruj listę konkretnych, wyszukiwalnych w internecie podtematów po polsku. Każdy podtemat = jedno hasło do wyszukania, max 8 słów. Myśl strategicznie — pokrywaj różne kąty (techniczny, biznesowy, kulturowy, kontrowersyjny)." },
        { role: "user", content: `Zakres nauki: ${scope}\n\nWygeneruj dokładnie ${count} różnorodnych podtematów pokrywających ten zakres.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "queue_topics",
          description: "Zakolejkuj podtematy do nauki",
          parameters: {
            type: "object",
            properties: {
              topics: { type: "array", items: { type: "string" }, description: "Lista konkretnych podtematów do wyszukania" },
            },
            required: ["topics"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "queue_topics" } },
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`AI gateway ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("Brak podtematów z AI");
  const parsed = JSON.parse(args);
  return (parsed.topics ?? []).slice(0, count);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const scope: string = (body.scope ?? "").trim();
    const count: number = Math.max(1, Math.min(20, Number(body.count ?? 5)));
    const runNow: boolean = body.run_now !== false; // default true

    if (!scope) {
      return new Response(JSON.stringify({ ok: false, error: "Brak zakresu (scope)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const topics = await generateSubtopics(scope, count);
    if (!topics.length) throw new Error("AI nie wygenerowało żadnych podtematów");

    // wstaw joby
    const jobsRows = topics.map((t, i) => ({
      topic: t,
      goal: `Auto-Learn: ${scope}`,
      priority: 7 - Math.min(6, Math.floor(i / 3)),
      status: "pending" as const,
    }));
    const { data: insertedJobs, error: insErr } = await supabase
      .from("aurora_learning_jobs")
      .insert(jobsRows)
      .select("id, topic");
    if (insErr) throw insErr;

    // jeśli run_now — odpal sekwencyjnie aurora-web-learn (fire-and-forget z małym throttle)
    let triggered = 0;
    if (runNow && insertedJobs) {
      // odpalamy w tle, żeby endpoint odpowiedział szybko
      (async () => {
        for (const job of insertedJobs) {
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/aurora-web-learn`, {
              method: "POST",
              headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ topic: job.topic, job_id: job.id }),
            });
            triggered++;
          } catch (e) {
            console.error("auto-learn trigger fail", job.topic, e);
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      })();
    }

    return new Response(JSON.stringify({
      ok: true,
      scope,
      queued: insertedJobs?.length ?? 0,
      topics: insertedJobs?.map((j) => j.topic) ?? [],
      run_now: runNow,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("aurora-auto-learn", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
