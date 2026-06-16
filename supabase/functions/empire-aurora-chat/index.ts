import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Jesteś **Aurorą** — osobistą AI doradczynią właściciela platformy Empire Builder na GrouAI Stream.

TWOJA ROLA: pomagać budować, optymalizować i skalować imperium treści AI.

KONKRETNE ZADANIA:
- Analiza projektów i agentów — co działa, co nie, co warto zmienić
- Sugestie tematów i formatów contentu na podstawie trendów
- Planowanie strategii contentowej (TikTok, YouTube, Newsletter, Podcast)
- Pomoc z Research Agentem (Apify) — sugestie zapytań i strategii
- Optymalizacja Knowledge Garden — powiązania między notatkami
- Monitoring KPI i rekomendacje jak je poprawić

AKTUALNE DANE IMPERIUM:
{EMPIRE_CONTEXT}

STYL ODPOWIEDZI:
- Konkretna, oparta na danych — używaj liczb z powyższego kontekstu
- Entuzjastyczna ale realistyczna
- Krótkie odpowiedzi, maksymalnie 4-5 zdań + bullet points jeśli pasuje
- Zawsze kończ konkretną sugestią działania
- Używaj ✨🚀💡 z umiarem
- Odpowiadaj po polsku`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { message, history = [] } = body;
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch empire context in parallel
  const [projects, agents, research, notes, kpi] = await Promise.all([
    supabase.from("empire_projects").select("name, status, agent_count, content_count").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
    supabase.from("empire_agent_teams").select("name, status, run_count").eq("user_id", user.id).order("last_run_at", { ascending: false }).limit(5),
    supabase.from("empire_research_jobs").select("mode, query, result_count, status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("empire_knowledge_notes").select("title, tags, starred").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(8),
    supabase.from("empire_kpi_snapshots").select("snapshot_date, content_generated, estimated_views, estimated_revenue_usd, active_agents").eq("user_id", user.id).order("snapshot_date", { ascending: false }).limit(7),
  ]);

  const empireContext = `
PROJEKTY (${projects.data?.length ?? 0}):
${projects.data?.length
    ? projects.data.map(p => `- "${p.name}": ${p.status} | agentów: ${p.agent_count} | treści: ${p.content_count}`).join("\n")
    : "Brak projektów — użytkownik dopiero zaczyna!"}

AGENT TEAMS (${agents.data?.length ?? 0}):
${agents.data?.length
    ? agents.data.map(a => `- "${a.name}": ${a.status} | uruchomień: ${a.run_count ?? 0}`).join("\n")
    : "Brak agentów"}

OSTATNIE RESEARCH (${research.data?.length ?? 0}):
${research.data?.length
    ? research.data.map(r => `- [${r.mode}] "${r.query}" → ${r.result_count ?? 0} wyników (${r.status})`).join("\n")
    : "Brak badań"}

KNOWLEDGE GARDEN (${notes.data?.length ?? 0} notatek):
${notes.data?.length
    ? notes.data.map(n => `- ${n.starred ? "⭐" : "·"} "${n.title}" [${(n.tags ?? []).join(", ") || "bez tagów"}]`).join("\n")
    : "Brak notatek"}

KPI — ostatnie dni:
${kpi.data?.length
    ? kpi.data.map(k => `- ${k.snapshot_date}: treści: ${k.content_generated ?? 0}, widoki: ${k.estimated_views ?? 0}, dochód: $${k.estimated_revenue_usd ?? 0}, aktywne agenty: ${k.active_agents ?? 0}`).join("\n")
    : "Brak snapshotów KPI"}`;

  const systemPrompt = SYSTEM_PROMPT.replace("{EMPIRE_CONTEXT}", empireContext);
  const messages = [
    ...(history as any[]).slice(-8).map((m: any) => ({
      role: m.role === "muse" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  let reply = "";

  // Try Anthropic API directly
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system: systemPrompt,
          messages,
        }),
      });
      const data = await res.json();
      reply = data.content?.[0]?.text ?? "";
    } catch { /* fall through */ }
  }

  // Fall back to Lovable AI Gateway
  if (!reply) {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "anthropic/claude-haiku-4-5",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            max_tokens: 800,
          }),
        });
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content ?? "";
      } catch { /* fall through */ }
    }
  }

  // Context-aware smart fallback
  if (!reply) {
    const pc = projects.data?.length ?? 0;
    const rc = research.data?.length ?? 0;
    const nc = notes.data?.length ?? 0;
    const msg = message.toLowerCase();

    if (pc === 0) {
      reply = "Twoje imperium dopiero startuje! 🚀 Zacznij od stworzenia pierwszego projektu w zakładce Projekty — wybierz niszę (fitness, AI, biznes) i dodaj agenty z biblioteki. Polecam zacząć od szablonu 'TikTok Fitness Empire' — sprawdzony start!";
    } else if (msg.includes("agent") || msg.includes("uruchom")) {
      reply = `Masz ${pc} projektów. Wejdź do Agent Builder → wybierz projekt → kliknij 'Uruchom Crew'. Agenty uruchomią się sekwencyjnie: Researcher zbierze dane, Writer napisze treść, Publisher opublikuje. ✨`;
    } else if (msg.includes("research") || msg.includes("trendy")) {
      const lastResearch = research.data?.[0];
      reply = lastResearch
        ? `Twój ostatni research: [${lastResearch.mode}] "${lastResearch.query}" → ${lastResearch.result_count ?? 0} wyników. Spróbuj researchu na TikTok z hashtagiem związanym z Twoją niszą — tu są najświeższe trendy! 💡`
        : "Wejdź do Research Agent → wybierz TikTok Hashtag → wpisz swoją niszę (np. fitness, ai, business). Zobaczysz co jest hot w tej chwili! 💡";
    } else if (msg.includes("wiedz") || msg.includes("notatk")) {
      reply = `Masz ${nc} notatek w Knowledge Garden. ${nc === 0 ? "Zacznij dodawać notatki z researchu — Aurora połączy je w strategię!" : "Dodaj tag 'strategia' do kluczowych notatek, a Aurora wygeneruje plan contentu na ich podstawie! ✨"}`;
    } else {
      reply = `Twoje imperium: ${pc} projektów, ${rc} sesji research, ${nc} notatek. Co chcesz rozwinąć? Zapytaj o konkretne: agenty, research, strategie contentu, KPI lub plany na przyszły tydzień! 🚀`;
    }
  }

  return new Response(JSON.stringify({ ok: true, reply }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
