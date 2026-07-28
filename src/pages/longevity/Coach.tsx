/**
 * AI COACH — rozmowa oparta na wnioskach wyliczonych lokalnie.
 *
 * Model językowy dostaje gotowy kontekst (`buildCoachContext`) i ma go
 * przeformułować, a nie wymyślać liczby. Gdy funkcja brzegowa jest
 * niedostępna — brak sieci, brak klucza, limit dostawcy — rozmowa nadal
 * działa na warstwie regułowej. Użytkownik zawsze dostaje odpowiedź.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import {
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  MEDICAL_DISCLAIMER,
  NERVOUS_STATE_LABEL,
  STRESS_LEVEL_LABEL,
  buildCoachContext,
  buildGarminMorningReport,
  formatDuration,
} from "@/lib/longevity";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "coach";
  content: string;
  /** Skąd pochodzi odpowiedź — pokazywane przy wiadomości trenera. */
  origin?: "ai" | "rules";
}

const QUICK_PROMPTS = [
  "Jak wygląda dziś mój organizm?",
  "Czy mogę dziś trenować?",
  "Co zrobić z moim snem?",
  "Dlaczego mam taki wynik stresu?",
  "Zaproponuj plan na wieczór",
  "Co poprawić w diecie?",
];

const Coach = () => {
  const { analysis, profile, today, demoMode } = useLongevity();
  const { panel, twin, report, garmin, nutrition } = analysis;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const context = useMemo(
    () => buildCoachContext(panel, twin, report, profile),
    [panel, profile, report, twin],
  );

  /** Powitanie oparte na dzisiejszym raporcie — nie generyczne „cześć”. */
  const greeting = useMemo(() => {
    const lines = [
      report.headline,
      "",
      report.summary,
      "",
      ...report.insights.slice(0, 2).map((insight) => `**${insight.title}**\n${insight.actions.map((a) => `✓ ${a}`).join("\n")}`),
    ];
    return lines.join("\n");
  }, [report]);

  useEffect(() => {
    setMessages([{ id: "greeting", role: "coach", content: greeting, origin: "rules" }]);
  }, [greeting]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /**
   * Odpowiedź regułowa — używana jako zapas i jako źródło prawdy dla modelu.
   * Dopasowanie po słowach kluczowych, bez zgadywania: jeśli pytanie nie
   * pasuje do żadnej kategorii, odsyłamy do dzisiejszego raportu.
   */
  const answerLocally = useCallback(
    (question: string): string => {
      const q = question.toLowerCase();

      if (/trening|ćwicz|siłown|bieg|trenowa/.test(q)) {
        if (garmin.available) return buildGarminMorningReport(garmin);
        return [
          `Regeneracja: ${panel.recoveryScore.value}/100, energia: ${panel.energyScore.value}/100, indeks stresu: ${panel.stressIndex.value}/100.`,
          panel.recoveryScore.value >= 70
            ? "Te wartości nie wskazują przeciwwskazań do mocniejszej jednostki. Zadbaj o rozgrzewkę i nawodnienie."
            : panel.recoveryScore.value >= 50
              ? "Lepiej dziś sprawdzi się trening umiarkowany niż jednostka jakościowa."
              : "Dziś zalecam ruch o niskiej intensywności: spacer, rozciąganie, mobilność.",
        ].join("\n\n");
      }

      if (/sen|spa[cć]|zasyp|wysp/.test(q)) {
        const sleepInsight = report.insights.find((i) => i.category === "sleep");
        return [
          today.sleep?.durationMin
            ? `Ostatnia noc: ${formatDuration(today.sleep.durationMin)}, Sleep Score ${panel.sleepScore.value}/100.`
            : "Nie mam jeszcze danych o tej nocy — podłącz urządzenie albo wpisz sen w dzienniku.",
          sleepInsight ? `\n${sleepInsight.body}\n\n${sleepInsight.actions.map((a) => `✓ ${a}`).join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }

      if (/stres|napi[eę]|nerw|spok/.test(q)) {
        return [
          `Indeks stresu: ${panel.stressIndex.value}/100 (${STRESS_LEVEL_LABEL[panel.stressLevel].toLowerCase()}).`,
          `Stan układu nerwowego: ${NERVOUS_STATE_LABEL[panel.nervousSystem.state].toLowerCase()}.`,
          "",
          ...panel.nervousSystem.rationale.map((r) => `• ${r}`),
          "",
          `Proponowane ćwiczenia: ${panel.nervousSystem.suggestedProtocols.join(", ")}.`,
        ].join("\n");
      }

      if (/diet|jedz|posi[lł]|bia[lł]k|kalor|woda|nawodn/.test(q)) {
        return [
          `Jakość diety dziś: ${nutrition.qualityScore}/100.`,
          "",
          ...(nutrition.suggestions.length > 0
            ? nutrition.suggestions.map((s) => `• ${s}`)
            : ["Dzisiejsze wpisy nie wskazują braków. Utrzymaj ten sposób jedzenia."]),
        ].join("\n");
      }

      if (/wiek|starz|biolog/.test(q)) {
        return [
          `Szacowany wiek biologiczny: ${panel.biologicalAge.estimatedAge} lat przy wieku metrykalnym ${panel.biologicalAge.chronologicalAge}.`,
          "",
          "Największy wpływ mają teraz:",
          ...panel.biologicalAge.drivers
            .slice(0, 4)
            .map((d) => `• ${d.label}: ${d.contribution > 0 ? "+" : ""}${d.contribution} roku`),
          "",
          panel.biologicalAge.missingInputs.length > 0
            ? `Precyzję podniosą: ${panel.biologicalAge.missingInputs.slice(0, 3).join(", ").toLowerCase()}.`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      }

      if (/wieczór|wieczor|plan|rytua/.test(q)) {
        return [
          "Plan na wieczór:",
          `✓ Ostatni posiłek najpóźniej 2 godziny przed snem`,
          `✓ Bez ekranu w godzinie przed położeniem się`,
          `✓ ${panel.stressLevel === "high" || panel.stressLevel === "critical" ? "10 minut oddechu 4-7-8" : "5 minut oddechu rezonansowego"}`,
          twin.optimalBedtimeMinOfDay !== undefined
            ? `✓ Zaśnięcie około ${Math.floor(twin.optimalBedtimeMinOfDay / 60)}:${String(twin.optimalBedtimeMinOfDay % 60).padStart(2, "0")}`
            : "✓ Stała pora zaśnięcia, także w weekend",
        ].join("\n");
      }

      return [
        report.headline,
        "",
        report.summary,
        "",
        "Najważniejsze na dziś:",
        ...report.insights.slice(0, 3).map((i) => `• ${i.title}`),
      ].join("\n");
    },
    [
      garmin,
      nutrition.qualityScore,
      nutrition.suggestions,
      panel,
      report.headline,
      report.insights,
      report.summary,
      today.sleep?.durationMin,
      twin.optimalBedtimeMinOfDay,
    ],
  );

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || sending) return;

      const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: question };
      setMessages((current) => [...current, userMessage]);
      setInput("");
      setSending(true);

      const fallback = answerLocally(question);

      try {
        const { data, error } = await supabase.functions.invoke("stop-aging-coach", {
          body: {
            question,
            context,
            history: messages.slice(-6).map((m) => ({ role: m.role === "coach" ? "assistant" : "user", content: m.content })),
            groundTruth: fallback,
          },
        });

        const reply = (data as { reply?: string } | null)?.reply;
        if (error || !reply) {
          setAiAvailable(false);
          setMessages((current) => [
            ...current,
            { id: `c-${Date.now()}`, role: "coach", content: fallback, origin: "rules" },
          ]);
        } else {
          setAiAvailable(true);
          setMessages((current) => [...current, { id: `c-${Date.now()}`, role: "coach", content: reply, origin: "ai" }]);
        }
      } catch {
        setAiAvailable(false);
        setMessages((current) => [
          ...current,
          { id: `c-${Date.now()}`, role: "coach", content: fallback, origin: "rules" },
        ]);
      } finally {
        setSending(false);
      }
    },
    [answerLocally, context, messages, sending],
  );

  return (
    <LongevityShell
      title="AI Coach"
      subtitle="Rozmowa o Twoich danych — z liczbami, nie z ogólnikami."
      action={
        aiAvailable === false ? (
          <Pill tone="warn">Tryb offline — odpowiedzi z silnika reguł</Pill>
        ) : aiAvailable ? (
          <Pill tone="teal">Model językowy aktywny</Pill>
        ) : undefined
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <GlassCard className="flex h-[70vh] min-h-[520px] flex-col lg:col-span-3">
          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
              >
                {message.role === "coach" && (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-longevity-gold-deep to-longevity-gold-soft">
                    <span className="material-icons-outlined text-[16px] leading-none text-black" aria-hidden>
                      auto_awesome
                    </span>
                  </span>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    message.role === "user"
                      ? "bg-longevity-teal/15 text-longevity-ink"
                      : "border border-longevity-line bg-white/[0.03] text-longevity-ink",
                  )}
                >
                  {message.content.split("\n").map((line, index) => (
                    <p key={index} className={cn(line === "" && "h-2", "whitespace-pre-wrap")}>
                      {line.startsWith("**") && line.endsWith("**") ? (
                        <strong className="text-longevity-gold-soft">{line.slice(2, -2)}</strong>
                      ) : (
                        line
                      )}
                    </p>
                  ))}

                  {message.role === "coach" && message.origin === "rules" && message.id !== "greeting" && (
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-longevity-muted/60">
                      Odpowiedź z silnika reguł
                    </p>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-sm text-longevity-muted">
                <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-longevity-gold" />
                <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-longevity-gold" style={{ animationDelay: "0.15s" }} />
                <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-longevity-gold" style={{ animationDelay: "0.3s" }} />
              </div>
            )}
          </div>

          <div className="border-t border-longevity-line p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  disabled={sending}
                  className="rounded-full border border-longevity-line bg-white/[0.03] px-3 py-1.5 text-xs text-longevity-muted transition-colors hover:border-white/15 hover:text-longevity-ink disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="Zapytaj o sen, stres, trening albo dietę…"
                className="max-h-32 flex-1 resize-none rounded-xl border border-longevity-line bg-white/[0.03] px-4 py-3 text-sm text-longevity-ink outline-none placeholder:text-longevity-muted/60 focus:border-longevity-teal/40"
              />
              <LongevityButton type="submit" disabled={sending || input.trim().length === 0}>
                <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
                  send
                </span>
              </LongevityButton>
            </form>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Kontekst rozmowy" title="Co widzi trener" />
            <div className="mt-3 space-y-2 text-xs">
              {[
                ["Wiek biologiczny", `${panel.biologicalAge.estimatedAge} lat`],
                ["Regeneracja", `${panel.recoveryScore.value}/100`],
                ["Sen", `${panel.sleepScore.value}/100`],
                ["Stres", `${panel.stressIndex.value}/100`],
                ["Energia", `${panel.energyScore.value}/100`],
                ["Epigenetyka", `${panel.epigeneticScore.value}/100`],
                ["Układ nerwowy", NERVOUS_STATE_LABEL[panel.nervousSystem.state]],
                ["Dojrzałość modelu", `${Math.round(twin.maturity * 100)}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-longevity-muted">{label}</span>
                  <span className="font-medium tabular-nums text-longevity-ink">{value}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-longevity-muted/70">
              Do modelu trafiają wyłącznie te liczby i wnioski — bez imienia, adresu e-mail i identyfikatorów
              urządzeń. {demoMode && "W trybie demonstracyjnym są to dane poglądowe."}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle eyebrow="Zasady" title="Czego trener nie robi" />
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-longevity-muted">
              <li>• Nie stawia diagnoz i nie interpretuje objawów chorobowych.</li>
              <li>• Nie zaleca ani nie odradza leków.</li>
              <li>• Nie wymyśla liczb — używa wyłącznie Twoich danych.</li>
              <li>• Przy objawach alarmowych kieruje do pomocy medycznej.</li>
            </ul>
          </GlassCard>

          <Disclaimer text={MEDICAL_DISCLAIMER} />
        </div>
      </div>
    </LongevityShell>
  );
};

export default Coach;
