/**
 * Moduł DIETA — cele dzienne, realizacja i konkretne poprawki.
 *
 * Ekran jest jednocześnie widokiem i formularzem: wszystko, co widać, można
 * od razu zmienić. Rozdzielanie „podglądu” od „dodawania wpisu” na dwa ekrany
 * powodowałoby, że dziennik przestaje być prowadzony po tygodniu.
 */

import { useMemo } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import { MetricTile, ScoreRing } from "@/components/longevity/ScoreRing";
import { TrendChart } from "@/components/longevity/TrendChart";
import {
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  ProgressBar,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import { MICRONUTRIENT_RDA, analyzeTrend, type NutritionData } from "@/lib/longevity";
import { cn } from "@/lib/utils";

/** Szybkie przyciski — najczęstsze wpisy jednym kliknięciem. */
const QUICK_ADDS: Array<{ label: string; icon: string; patch: (n: NutritionData) => NutritionData }> = [
  {
    label: "Szklanka wody",
    icon: "local_drink",
    patch: (n) => ({ ...n, waterMl: (n.waterMl ?? 0) + 250 }),
  },
  {
    label: "Porcja warzyw",
    icon: "eco",
    patch: (n) => ({ ...n, vegetableServings: (n.vegetableServings ?? 0) + 1 }),
  },
  {
    label: "Porcja owoców",
    icon: "nutrition",
    patch: (n) => ({ ...n, fruitServings: (n.fruitServings ?? 0) + 1 }),
  },
  {
    label: "Posiłek z białkiem",
    icon: "egg_alt",
    patch: (n) => ({ ...n, proteinG: (n.proteinG ?? 0) + 25, kcal: (n.kcal ?? 0) + 450 }),
  },
  {
    label: "Posiłek przetworzony",
    icon: "fastfood",
    patch: (n) => ({
      ...n,
      ultraProcessedMeals: (n.ultraProcessedMeals ?? 0) + 1,
      addedSugarG: (n.addedSugarG ?? 0) + 15,
      kcal: (n.kcal ?? 0) + 600,
    }),
  },
  {
    label: "Jednostka alkoholu",
    icon: "wine_bar",
    patch: (n) => ({ ...n, alcoholUnits: (n.alcoholUnits ?? 0) + 1, kcal: (n.kcal ?? 0) + 120 }),
  },
];

const Diet = () => {
  const { analysis, today, records, updateRecord } = useLongevity();
  const { nutrition, panel } = analysis;
  const current = today.nutrition ?? {};

  const waterTrend = useMemo(() => analyzeTrend(records, "waterMl", 30), [records]);

  const apply = (patch: (n: NutritionData) => NutritionData) => {
    updateRecord({ nutrition: patch(current) });
  };

  const setField = (field: keyof NutritionData, value: number) => {
    updateRecord({ nutrition: { ...current, [field]: value } });
  };

  return (
    <LongevityShell
      title="Dieta"
      subtitle="Cele wyliczone z Twojego profilu i realnej aktywności dnia — nie ze średniej tabelki."
      action={<Pill tone={nutrition.qualityScore >= 75 ? "good" : "warn"}>Jakość: {nutrition.qualityScore}/100</Pill>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard accent="gold" className="flex flex-col items-center gap-4 p-6 lg:col-span-2">
            <ScoreRing value={nutrition.qualityScore} tone="gold" size={180} label="Jakość diety dziś" />
            <div className="w-full space-y-2.5">
              {nutrition.gaps.slice(0, 5).map((gap) => (
                <div key={gap.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-xs text-longevity-muted">{gap.label}</span>
                    <span className="text-xs font-medium tabular-nums text-longevity-ink">
                      {gap.actual} / {gap.target} {gap.unit}
                    </span>
                  </div>
                  <ProgressBar
                    value={gap.progress}
                    tone={gap.status === "ok" ? "good" : gap.status === "warn" ? "warn" : "danger"}
                  />
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="space-y-4 lg:col-span-3">
            <GlassCard className="p-5">
              <SectionTitle eyebrow="Szybki wpis" title="Dodaj jednym kliknięciem" />
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {QUICK_ADDS.map((quick) => (
                  <button
                    key={quick.label}
                    type="button"
                    onClick={() => apply(quick.patch)}
                    className="flex items-center gap-2.5 rounded-xl border border-longevity-line bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-white/15 active:scale-[0.98]"
                  >
                    <span className="material-icons-outlined text-[18px] leading-none text-longevity-gold" aria-hidden>
                      {quick.icon}
                    </span>
                    <span className="text-xs text-longevity-ink">{quick.label}</span>
                  </button>
                ))}
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile
                label="Woda"
                value={((current.waterMl ?? 0) / 1000).toFixed(1)}
                unit="l"
                ratio={(current.waterMl ?? 0) / nutrition.targets.waterMl}
                tone="teal"
                icon="water_drop"
                hint={`Cel: ${(nutrition.targets.waterMl / 1000).toFixed(1)} l`}
              />
              <MetricTile
                label="Białko"
                value={Math.round(current.proteinG ?? 0)}
                unit="g"
                ratio={(current.proteinG ?? 0) / nutrition.targets.proteinG}
                tone="gold"
                icon="egg_alt"
                hint={`Cel: ${nutrition.targets.proteinG} g`}
              />
              <MetricTile
                label="Błonnik"
                value={Math.round(current.fiberG ?? 0)}
                unit="g"
                ratio={(current.fiberG ?? 0) / nutrition.targets.fiberG}
                tone="good"
                icon="grass"
                hint={`Cel: ${nutrition.targets.fiberG} g`}
              />
              <MetricTile
                label="Cukry dodane"
                value={Math.round(current.addedSugarG ?? 0)}
                unit="g"
                ratio={Math.min(1, (current.addedSugarG ?? 0) / nutrition.targets.addedSugarMaxG)}
                tone={(current.addedSugarG ?? 0) <= nutrition.targets.addedSugarMaxG ? "good" : "danger"}
                icon="cookie"
                hint={`Limit: ${nutrition.targets.addedSugarMaxG} g`}
              />
            </div>

            <GlassCard accent="teal" className="p-5">
              <SectionTitle eyebrow="AI · poprawki na dziś" title="Co dołożyć, co ograniczyć" />
              {nutrition.suggestions.length === 0 ? (
                <p className="mt-3 text-sm text-longevity-muted">
                  Dzisiejsze wpisy nie wskazują braków. Utrzymaj ten sposób jedzenia — model nie widzi tu nic do poprawy.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {nutrition.suggestions.map((suggestion) => (
                    <li key={suggestion} className="flex items-start gap-2.5 text-sm leading-relaxed text-longevity-ink">
                      <span className="material-icons-outlined mt-px text-[16px] leading-none text-longevity-teal" aria-hidden>
                        lightbulb
                      </span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>
        </div>

        {/* ── Precyzyjny wpis ───────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Dziennik dnia"
            title="Wpis precyzyjny"
            description="Suwaki zapisują się automatycznie. Nie ma przycisku „zapisz” — nie ma też ryzyka, że wpis zniknie."
          />

          <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                { field: "waterMl" as const, label: "Woda", max: 4000, step: 100, unit: "ml" },
                { field: "kcal" as const, label: "Kalorie", max: 4500, step: 50, unit: "kcal" },
                { field: "proteinG" as const, label: "Białko", max: 250, step: 5, unit: "g" },
                { field: "fiberG" as const, label: "Błonnik", max: 60, step: 1, unit: "g" },
                { field: "addedSugarG" as const, label: "Cukry dodane", max: 150, step: 1, unit: "g" },
                { field: "vegetableServings" as const, label: "Warzywa", max: 10, step: 1, unit: "porcji" },
                { field: "fruitServings" as const, label: "Owoce", max: 8, step: 1, unit: "porcji" },
                { field: "alcoholUnits" as const, label: "Alkohol", max: 10, step: 1, unit: "jedn." },
                { field: "ultraProcessedMeals" as const, label: "Posiłki przetworzone", max: 6, step: 1, unit: "szt." },
              ]
            ).map((item) => (
              <div key={item.field}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <label htmlFor={`diet-${item.field}`} className="text-xs text-longevity-muted">
                    {item.label}
                  </label>
                  <span className="text-sm font-medium tabular-nums text-longevity-ink">
                    {current[item.field] ?? 0} {item.unit}
                  </span>
                </div>
                <input
                  id={`diet-${item.field}`}
                  type="range"
                  min={0}
                  max={item.max}
                  step={item.step}
                  value={(current[item.field] as number | undefined) ?? 0}
                  onChange={(e) => setField(item.field, Number(e.target.value))}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-longevity-gold"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <LongevityButton
              variant="ghost"
              size="sm"
              onClick={() => updateRecord({ nutrition: { ...current, alcoholUnits: 0, ultraProcessedMeals: 0 } })}
            >
              Dzień bez alkoholu i przetworzonego jedzenia
            </LongevityButton>
            <LongevityButton
              variant="ghost"
              size="sm"
              onClick={() =>
                updateRecord({
                  nutrition: { ...current, lastMealMinOfDay: new Date().getHours() * 60 + new Date().getMinutes() },
                })
              }
            >
              Oznacz ostatni posiłek (teraz)
            </LongevityButton>
          </div>
        </GlassCard>

        {/* ── Mikroskładniki i trend ────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-5">
            <SectionTitle
              eyebrow="Mikroskładniki"
              title="Najczęstsze niedobory"
              description="Wyświetlamy tylko te składniki, które faktycznie zarejestrowałeś i które są poniżej 80% wartości referencyjnej."
            />
            {nutrition.micronutrientGaps.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-longevity-muted">
                Brak zarejestrowanych mikroskładników albo wszystkie mieszczą się w normie. Wartości referencyjne:{" "}
                {Object.values(MICRONUTRIENT_RDA)
                  .slice(0, 4)
                  .map((m) => `${m.label} ${m.amount} ${m.unit}`)
                  .join(", ")}
                .
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {nutrition.micronutrientGaps.map((gap) => (
                  <div key={gap.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-xs text-longevity-muted">{gap.label}</span>
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          gap.pct < 50 ? "text-longevity-danger" : "text-longevity-warn",
                        )}
                      >
                        {gap.pct}% normy
                      </span>
                    </div>
                    <ProgressBar value={gap.pct / 100} tone={gap.pct < 50 ? "danger" : "warn"} />
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle eyebrow="Nawodnienie · 30 dni" title="Trend" />
            <TrendChart
              analysis={waterTrend}
              unit="ml"
              className="mt-4"
              reference={{ value: nutrition.targets.waterMl, label: "cel" }}
            />
          </GlassCard>
        </div>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="Powiązanie z resztą aplikacji" title="Jak dieta wpływa na Twoje wyniki" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-longevity-line bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wider text-longevity-muted">Wynik metaboliczny</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-longevity-ink">
                {panel.metabolicScore.value}
              </p>
              <p className="mt-1 text-[11px] text-longevity-muted/80">BMI, błonnik, cukry, ruch i pora posiłków</p>
            </div>
            <div className="rounded-xl border border-longevity-line bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wider text-longevity-muted">Epigenetic Score</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-longevity-ink">
                {panel.epigeneticScore.value}
              </p>
              <p className="mt-1 text-[11px] text-longevity-muted/80">
                Warzywa 15 pkt, nawodnienie 10 pkt, brak alkoholu 10 pkt
              </p>
            </div>
            <div className="rounded-xl border border-longevity-line bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wider text-longevity-muted">Wiek biologiczny</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-longevity-ink">
                ±2,4 roku
              </p>
              <p className="mt-1 text-[11px] text-longevity-muted/80">Maksymalny wpływ jakości diety w modelu</p>
            </div>
          </div>
        </GlassCard>

        <Disclaimer text="Cele żywieniowe są wyliczane dla zdrowych osób dorosłych na podstawie równania Mifflina–St Jeora i ogólnych rekomendacji. Nie stanowią planu dietetycznego ani elementu leczenia. Przy chorobach przewlekłych, ciąży, karmieniu piersią lub diecie eliminacyjnej decyduje zalecenie lekarza albo dietetyka." />
      </div>
    </LongevityShell>
  );
};

export default Diet;
