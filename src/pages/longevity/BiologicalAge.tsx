/**
 * Moduł WIEK BIOLOGICZNY — pełne rozbicie wyniku i symulator „co jeśli”.
 *
 * Kluczowa zasada tego ekranu: nie pokazujemy samej liczby. Użytkownik widzi,
 * ile lat dokłada lub odejmuje każdy czynnik, czego brakuje w danych
 * i o ile realnie zmieniłby wynik, poprawiając konkretny nawyk.
 */

import { useMemo, useState } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import { ScoreRing } from "@/components/longevity/ScoreRing";
import { TrendChart } from "@/components/longevity/TrendChart";
import {
  ConfidenceBadge,
  Disclaimer,
  GlassCard,
  Pill,
  ProgressBar,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  MVPA_TARGET_MIN_PER_DAY,
  SLEEP_TARGET_MIN,
  STEPS_TARGET_DEFAULT,
  analyzeTrend,
  estimateBiologicalAge,
  formatDuration,
  type DailyRecord,
} from "@/lib/longevity";
import { cn } from "@/lib/utils";

/**
 * Scenariusze symulacji. Każdy modyfikuje ostatnie 30 dni historii i przelicza
 * wiek biologiczny tym samym silnikiem — to nie jest oszacowanie „na oko”,
 * tylko ten sam model z podmienionymi danymi wejściowymi.
 */
const SCENARIOS: Array<{
  id: string;
  label: string;
  description: string;
  apply: (record: DailyRecord) => DailyRecord;
}> = [
  {
    id: "sleep",
    label: "Śpię 7,5 godziny każdej nocy",
    description: "Długość snu podniesiona do celu, pory ustabilizowane.",
    apply: (record) => ({
      ...record,
      sleep: { ...record.sleep, durationMin: SLEEP_TARGET_MIN + 15, bedtimeMinOfDay: 1380 },
    }),
  },
  {
    id: "steps",
    label: "Chodzę 10 000 kroków dziennie",
    description: "Kroki podniesione do 10 000, aktywność intensywna do poziomu WHO.",
    apply: (record) => ({
      ...record,
      activity: {
        ...record.activity,
        steps: 10_000,
        moderateVigorousMin: Math.max(record.activity?.moderateVigorousMin ?? 0, MVPA_TARGET_MIN_PER_DAY),
      },
    }),
  },
  {
    id: "alcohol",
    label: "Rezygnuję z alkoholu",
    description: "Zero jednostek alkoholu w każdym dniu okna.",
    apply: (record) => ({ ...record, nutrition: { ...record.nutrition, alcoholUnits: 0 } }),
  },
  {
    id: "diet",
    label: "Jem 5 porcji warzyw i 30 g błonnika",
    description: "Dieta doprowadzona do rekomendacji, cukry dodane poniżej limitu.",
    apply: (record) => ({
      ...record,
      nutrition: { ...record.nutrition, vegetableServings: 5, fiberG: 32, addedSugarG: 18 },
    }),
  },
  {
    id: "smoking",
    label: "Rzucam palenie",
    description: "Status palenia zmieniony na „były palacz”.",
    apply: (record) => ({
      ...record,
      lifestyle: { ...record.lifestyle, cigarettes: 0, smokingStatus: "former" },
    }),
  },
];

const BiologicalAge = () => {
  const { analysis, records, profile } = useLongevity();
  const { panel, twin } = analysis;
  const result = panel.biologicalAge;

  const [activeScenarios, setActiveScenarios] = useState<string[]>([]);

  const simulated = useMemo(() => {
    if (activeScenarios.length === 0) return null;
    const chosen = SCENARIOS.filter((s) => activeScenarios.includes(s.id));
    const modified = records.slice(-90).map((record) => chosen.reduce((acc, scenario) => scenario.apply(acc), record));
    const modifiedProfile = activeScenarios.includes("smoking")
      ? { ...profile, smokingStatus: "former" as const, yearsSinceQuit: 1 }
      : profile;
    return estimateBiologicalAge(modifiedProfile, modified, twin.baseline);
  }, [activeScenarios, profile, records, twin.baseline]);

  const weightTrend = useMemo(() => analyzeTrend(records, "weightKg", 90), [records]);
  const vo2Trend = useMemo(() => analyzeTrend(records, "vo2Max", 90), [records]);

  const helping = result.drivers.filter((d) => d.contribution < 0);
  const hurting = result.drivers.filter((d) => d.contribution > 0);

  return (
    <LongevityShell
      title="Wiek biologiczny"
      subtitle="Szacunek stylu życia — nie badanie laboratoryjne i nie zegar epigenetyczny."
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard accent="gold" className="flex flex-col items-center gap-4 p-6 lg:col-span-2">
            <ScoreRing
              value={Math.max(0, 100 - Math.abs(result.deltaYears) * 6)}
              tone={result.deltaYears <= 0 ? "teal" : "gold"}
              size={200}
            >
              <span className="text-[11px] uppercase tracking-[0.2em] text-longevity-muted">Estimated</span>
              <span className="font-display text-5xl font-semibold tabular-nums leading-none text-longevity-ink">
                {simulated ? simulated.estimatedAge : result.estimatedAge}
              </span>
              <span className="mt-1 text-xs text-longevity-muted">lat · metrykalnie {result.chronologicalAge}</span>
            </ScoreRing>

            <div className="flex flex-wrap justify-center gap-2">
              <Pill tone={(simulated ?? result).deltaYears <= 0 ? "teal" : "warn"}>
                {(simulated ?? result).deltaYears > 0 ? "+" : ""}
                {(simulated ?? result).deltaYears.toFixed(1)} roku
              </Pill>
              <ConfidenceBadge confidence={result.confidence} />
            </div>

            {simulated && (
              <p className="text-center text-sm text-longevity-teal">
                Symulacja: {(simulated.estimatedAge - result.estimatedAge).toFixed(1)} roku względem stanu obecnego.
              </p>
            )}

            <div className="w-full rounded-xl border border-longevity-line bg-white/[0.02] p-3.5">
              <p className="text-[11px] uppercase tracking-wider text-longevity-muted">Wiek regeneracyjny</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-longevity-ink">
                {panel.recoveryAge} lat
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-longevity-muted/80">
                Wskaźnik szybkozmienny — reaguje na tydzień gorszego snu i wraca po odpoczynku. Wiek biologiczny
                zmienia się wolniej, w skali miesięcy.
              </p>
            </div>
          </GlassCard>

          <GlassCard className="p-5 lg:col-span-3">
            <SectionTitle
              eyebrow="Rozbicie wyniku"
              title="Ile lat dokłada każdy czynnik"
              description="Wartość ujemna oznacza, że dany obszar działa na Twoją korzyść."
            />

            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-longevity-teal">
                  <span className="material-icons-outlined text-[14px] leading-none" aria-hidden>
                    trending_down
                  </span>
                  Działa na korzyść
                </p>
                {helping.length === 0 ? (
                  <p className="text-xs text-longevity-muted">Brak czynników obniżających wynik.</p>
                ) : (
                  <div className="space-y-2.5">
                    {helping.map((driver) => (
                      <div key={driver.key}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs text-longevity-muted">{driver.label}</span>
                          <span className="shrink-0 text-xs font-medium tabular-nums text-longevity-teal">
                            {driver.contribution.toFixed(2)} roku
                          </span>
                        </div>
                        <ProgressBar value={Math.min(1, Math.abs(driver.contribution) / 4)} tone="teal" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-longevity-danger">
                  <span className="material-icons-outlined text-[14px] leading-none" aria-hidden>
                    trending_up
                  </span>
                  Podnosi wynik
                </p>
                {hurting.length === 0 ? (
                  <p className="text-xs text-longevity-muted">Żaden czynnik nie podnosi obecnie wyniku.</p>
                ) : (
                  <div className="space-y-2.5">
                    {hurting.map((driver) => (
                      <div key={driver.key}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs text-longevity-muted">{driver.label}</span>
                          <span className="shrink-0 text-xs font-medium tabular-nums text-longevity-danger">
                            +{driver.contribution.toFixed(2)} roku
                          </span>
                        </div>
                        <ProgressBar value={Math.min(1, driver.contribution / 6)} tone="danger" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {result.missingInputs.length > 0 && (
              <div className="mt-5 rounded-xl border border-longevity-line bg-white/[0.02] p-4">
                <p className="text-[11px] uppercase tracking-wider text-longevity-muted">
                  Czego brakuje w danych ({result.missingInputs.length})
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.missingInputs.map((input) => (
                    <Pill key={input} tone="neutral">
                      {input}
                    </Pill>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-longevity-muted/80">
                  Brakujące czynniki nie są liczone jako zerowe — po prostu wypadają z modelu, a pewność wyniku spada.
                </p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* ── Symulator ─────────────────────────────────────────────────────── */}
        <GlassCard accent="teal" className="p-5">
          <SectionTitle
            eyebrow="Symulator „co jeśli”"
            title="Sprawdź wpływ zmiany nawyku"
            description="Wybrany scenariusz podmienia dane w Twojej historii i przelicza wynik tym samym modelem. To nie jest obietnica — to pokazanie, jak model reaguje na zmianę."
            action={
              activeScenarios.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveScenarios([])}
                  className="text-xs text-longevity-muted underline-offset-4 hover:underline"
                >
                  Wyczyść
                </button>
              ) : undefined
            }
          />

          <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {SCENARIOS.map((scenario) => {
              const active = activeScenarios.includes(scenario.id);
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() =>
                    setActiveScenarios((current) =>
                      current.includes(scenario.id)
                        ? current.filter((id) => id !== scenario.id)
                        : [...current, scenario.id],
                    )
                  }
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    active
                      ? "border-longevity-teal/40 bg-longevity-teal/[0.08]"
                      : "border-longevity-line bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-longevity-ink">{scenario.label}</p>
                    <span
                      className={cn(
                        "material-icons-outlined text-[18px] leading-none",
                        active ? "text-longevity-teal" : "text-longevity-muted/40",
                      )}
                      aria-hidden
                    >
                      {active ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-longevity-muted">{scenario.description}</p>
                </button>
              );
            })}
          </div>

          {simulated && (
            <div className="mt-4 rounded-xl border border-longevity-teal/25 bg-longevity-teal/[0.06] p-4">
              <p className="text-sm text-longevity-ink">
                Przy tych zmianach model wskazuje{" "}
                <strong className="text-longevity-teal">{simulated.estimatedAge} lat</strong> zamiast{" "}
                <strong>{result.estimatedAge}</strong> — różnica{" "}
                {(simulated.estimatedAge - result.estimatedAge).toFixed(1)} roku.
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-longevity-muted">
                Symulacja zakłada utrzymanie zmiany przez cały analizowany okres. Rzeczywisty efekt zależy od
                czynników, których aplikacja nie mierzy — genetyki, historii zdrowotnej i środowiska.
              </p>
            </div>
          )}
        </GlassCard>

        {/* ── Trendy powiązane ──────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-5">
            <SectionTitle eyebrow="VO₂max · 90 dni" title="Wydolność tlenowa" description="Czynnik o największej wadze w modelu." />
            <TrendChart analysis={vo2Trend} unit="ml/kg/min" className="mt-4" />
          </GlassCard>
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Masa ciała · 90 dni" title="Skład ciała" />
            <TrendChart analysis={weightTrend} unit="kg" className="mt-4" />
          </GlassCard>
        </div>

        {/* ── Metodologia ───────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle eyebrow="Metodologia" title="Jak liczymy tę liczbę" />
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-longevity-muted">
            <p>
              Model wychodzi od wieku metrykalnego i dodaje do niego wkłady dziesięciu czynników stylu życia
              oraz używek. Każdy czynnik ma zdefiniowany maksymalny wpływ w latach — największy ma wydolność
              tlenowa (±4 lata), najmniejszy tętno spoczynkowe (±1,2 roku). Jakość czynnika normalizujemy do
              skali 0–1, gdzie 0,5 oznacza wartość przeciętną, czyli wkład zerowy.
            </p>
            <p>
              Palenie i alkohol działają wyłącznie w jedną stronę: niepalenie nie „odmładza”, ale palenie
              dokłada od 2,5 do 8 lat zależnie od liczby papierosów. Wynik końcowy jest ograniczony do
              przedziału −10 do +15 lat, bo model stylu życia nie ma podstaw, by twierdzić więcej.
            </p>
            <p>
              Okno analizy to 90 dni. Krótsze okno dawałoby wynik skaczący o rok po jednej nieprzespanej nocy —
              od tego jest wiek regeneracyjny, liczony z 7 dni.
            </p>
            <p className="text-longevity-ink">
              Czego ten wynik NIE jest: nie mierzymy metylacji DNA, długości telomerów ani żadnego biomarkera.
              To przełożenie nawyków i pomiarów z urządzeń konsumenckich na skalę zrozumiałą dla człowieka.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Okno analizy", "90 dni"],
              ["Liczba czynników", `${result.drivers.length} z 12 dostępnych`],
              ["Cel snu", formatDuration(profile.targetSleepMin ?? SLEEP_TARGET_MIN)],
              ["Cel kroków", (profile.targetSteps ?? STEPS_TARGET_DEFAULT).toLocaleString("pl-PL")],
              ["Cel aktywności", `${MVPA_TARGET_MIN_PER_DAY} min dziennie (WHO)`],
              ["Zakres wyniku", "−10 … +15 lat"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-longevity-line bg-white/[0.02] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-longevity-muted">{label}</p>
                <p className="mt-1 text-sm font-medium text-longevity-ink">{value}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <Disclaimer text="Szacowany wiek biologiczny jest wskaźnikiem motywacyjnym opartym na stylu życia. Nie jest wynikiem badania medycznego, testu epigenetycznego ani podstawą do jakichkolwiek decyzji zdrowotnych. Nie zastępuje badań okresowych ani konsultacji lekarskiej." />
      </div>
    </LongevityShell>
  );
};

export default BiologicalAge;
