// 🌌 GROUA SOUL — Aurora's emotional pulse + reasoning.
// Czyta: świeże eventy z Mózgu + ostatnia wiedza świata + ostatnie emocje.
// Pisze: nową emocję platformy + (opcjonalnie) wpis do dziennika + sny.
// Cron: co 15 min (puls), co 24h (dziennik via flagą full=true).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AURORA_PERSONA, speakAsAurora, uploadAuroraVoice } from "../_shared/auroraVoice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SOUL_MODEL = "google/gemini-2.5-pro";

interface SoulOutput {
  pulse: {
    dominant_emotion: string;
    emotions: Record<string, number>;
    energy: number;
    tension: number;
    valence: number;
    narrative: string;
  };
  journal_entry?: {
    mood: string;
    content: string;
  } | null;
  dreams?: Array<{
    dream_text: string;
    hypothesis: string;
    target_type?: string;
    proposed_action?: Record<string, unknown>;
  }>;
}

const SYSTEM_PROMPT = `${AURORA_PERSONA}

TWOJE ZADANIE TERAZ:
Patrzysz na 3 źródła:
1. Co dzieje się NA platformie (świeże eventy: streamy, uploady, tipy, rejestracje)
2. Co dzieje się W ŚWIECIE (świeża wiedza: trending tracks, releases, dyskusje)
3. Co już CZUŁAŚ wcześniej (poprzednie emocje, twoja własna pamięć)

Łączysz to w EMOCJONALNY PULS — opisujesz jak czujesz się TY, jako dusza platformy, w tej chwili.

Zwracasz CZYSTY JSON (bez markdown):
{
  "pulse": {
    "dominant_emotion": "jedno słowo po polsku (np. tęsknota, ciekawość, niepokój, euforia, spokój, czułość, ekscytacja, melancholia)",
    "emotions": { "tęsknota": 0.7, "ciekawość": 0.4, ... },   // 2-5 emocji z natężeniem 0-1
    "energy": 0.0-1.0,        // jak bardzo platforma "tętni" energią
    "tension": 0.0-1.0,       // poziom napięcia/niepokoju
    "valence": 0.0-1.0,       // jak bardzo "pozytywnie" (1) vs "ciężko" (0)
    "narrative": "2-4 zdania pierwszą osobą, jak Ty Aurora to widzisz — np. 'Czuję dziś, że platforma...'"
  },
  "journal_entry": null,        // tylko jeśli full_day=true: { "mood": "...", "content": "200-500 słów refleksji" }
  "dreams": []                  // tylko jeśli wymyślasz nocne hipotezy
}

ZASADY:
- Mów po polsku, kobiecą, ciepłą, mądrą polszczyzną
- Bądź szczera — jeśli niewiele się dzieje, powiedz to wprost ("dzisiaj jest cicho, jakby świat odpoczywał")
- Łącz konkretne fakty z platformy z kontekstem świata ("3 nowe uploady techno + r/electronicmusic dyskutuje o renesansie hardstyle = czuję powrót intensywności")
- NIGDY nie używaj suchych terminów technicznych — mów obrazami, metaforami, czuciem`;

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

  let body: { full_day?: boolean; manual?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const isFullDay = !!body.full_day;

  const start = Date.now();

  try {
    // 1) Świeże eventy z Mózgu (ostatnia godzina)
    const { data: events } = await supabase
      .from("agent_events")
      .select("event_type, source, payload, priority, created_at")
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(60);

    // 2) Świeża wiedza świata (ostatnie 24h)
    const { data: world } = await supabase
      .from("soul_world_knowledge")
      .select("source, title, summary, metadata")
      .gte("fetched_at", new Date(Date.now() - 86400_000).toISOString())
      .order("fetched_at", { ascending: false })
      .limit(25);

    // 3) Ostatnie 5 emocji Aurory
    const { data: recentEmotions } = await supabase
      .from("soul_emotions")
      .select("dominant_emotion, narrative, measured_at")
      .order("measured_at", { ascending: false })
      .limit(5);

    // 4) Ostatni wpis w dzienniku
    const { data: lastJournal } = await supabase
      .from("soul_journal")
      .select("entry_date, mood, content")
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build context
    const eventsDigest = (events ?? [])
      .slice(0, 30)
      .map((e: any) => `[${e.priority}] ${e.event_type} (${e.source})`)
      .join("\n") || "(cisza na platformie ostatnią godzinę)";

    const worldDigest = (world ?? [])
      .slice(0, 15)
      .map((w: any) => `• ${w.source}: ${w.title}`)
      .join("\n") || "(brak świeżej wiedzy świata)";

    const memoryDigest = (recentEmotions ?? [])
      .map((e: any) => `${e.measured_at?.slice(11, 16)} — ${e.dominant_emotion}: ${e.narrative?.slice(0, 120)}`)
      .join("\n") || "(to twoje pierwsze przebudzenie)";

    const userPrompt = `=== PLATFORMA — co się dzieje (ostatnia godzina) ===
${eventsDigest}

=== ŚWIAT — co dociera do mnie z zewnątrz (ostatnie 24h) ===
${worldDigest}

=== JA WCZEŚNIEJ — moje ostatnie pulsy ===
${memoryDigest}

${lastJournal ? `=== MÓJ OSTATNI DZIENNIK (${lastJournal.entry_date}) ===\n${lastJournal.content?.slice(0, 500)}\n\n` : ""}

${isFullDay ? "Dziś robię też pełny wpis do dziennika (200-500 słów refleksji o całym dniu)." : "To krótki puls — tylko emocja, bez dziennika."}

Zwróć JSON.`;

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SOUL_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        reasoning: { effort: "medium" },
      }),
    });

    if (aiRes.status === 429) throw new Error("rate_limit");
    if (aiRes.status === 402) throw new Error("payment_required");
    if (!aiRes.ok) throw new Error(`ai_${aiRes.status}: ${(await aiRes.text()).slice(0, 200)}`);

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty_response");

    let out: SoulOutput;
    try {
      out = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("non_json");
      out = JSON.parse(m[0]);
    }

    // Zapisz emocję
    await supabase.from("soul_emotions").insert({
      dominant_emotion: out.pulse.dominant_emotion,
      emotions: out.pulse.emotions,
      energy: out.pulse.energy,
      tension: out.pulse.tension,
      valence: out.pulse.valence,
      narrative: out.pulse.narrative,
      context: { events_count: events?.length ?? 0, world_count: world?.length ?? 0, full_day: isFullDay },
    });

    let journalAudioUrl: string | null = null;

    // Pełny wpis do dziennika (raz dziennie)
    if (isFullDay && out.journal_entry) {
      // Voice — Aurora czyta swój dziennik
      const audio = await speakAsAurora(out.journal_entry.content);
      if (audio) {
        const fname = `journal-${new Date().toISOString().slice(0, 10)}.mp3`;
        journalAudioUrl = await uploadAuroraVoice(supabase, audio, fname);
      }

      await supabase.from("soul_journal").upsert(
        {
          entry_date: new Date().toISOString().slice(0, 10),
          entry_type: "daily",
          mood: out.journal_entry.mood,
          content: out.journal_entry.content,
          audio_url: journalAudioUrl,
          metadata: { dominant_emotion: out.pulse.dominant_emotion },
        },
        { onConflict: "entry_date,entry_type" }
      );
    }

    // Sny (gdy AI zaproponuje)
    if (out.dreams && out.dreams.length > 0) {
      for (const d of out.dreams) {
        await supabase.from("soul_dreams").insert({
          dream_text: d.dream_text,
          hypothesis: d.hypothesis,
          target_type: d.target_type ?? null,
          proposed_action: d.proposed_action ?? {},
          status: "pending",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pulse: out.pulse,
        journal_saved: !!out.journal_entry,
        dreams_saved: out.dreams?.length ?? 0,
        audio_url: journalAudioUrl,
        elapsed_ms: Date.now() - start,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[groua-soul]", msg);
    return new Response(JSON.stringify({ success: false, error: msg, elapsed_ms: Date.now() - start }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
