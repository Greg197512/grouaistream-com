/**
 * Moduł WYKRESY — trendy w oknach 7 / 30 / 90 / 365 dni.
 *
 * Do każdej metryki dokładamy interpretację: sama linia niewiele mówi, jeśli
 * użytkownik nie wie, czy 8% zmiany to szum, czy sygnał. Próg istotności
 * (3%) jest wspólny dla całego silnika.
 */

import { useMemo, useState } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import { Sparkline, TrendChart } from "@/components/longevity/TrendChart";
import {
  Disclaimer,
  GlassCard,
  Pill,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  TREND_METRICS,
  analyzeTrend,
  buildPanel,
  calculateEpigeneticScore,
  estimateBiologicalAge,
  type TrendMetricKey,
  type TrendWindow,
} from "@/lib/longevity";
import { cn } from "@/lib/utils";

const WINDOWS: Array<{ value: TrendWindow; label: string }> = [
  { value: 7, label: "7 dni" },
  { value: 30, label: "30 dni" },
  { value: 90, label: "90 dni" },
  { value: 365, label: "Rok" },
];

const METRIC_NOTES: Record<TrendMetricKey, string> = {
  sleepMin: "Długość snu netto. Regularność liczy się bardziej niż pojedyncze długie noce.",
  hrvMs: "Zmienność rytmu serca. Interpretuj względem własnej bazy, nie wobec innych osób.",
  restingHeartRate: "Tętno spoczynkowe. Spadek w skali tygodni zwykle oznacza poprawę wydolności.",
  steps: "Aktywność podstawowa. Najmocniejszy efekt zdrowotny daje wyjście z przedziału poniżej 5000 kroków.",
  bodyBattery: "Rezerwa energetyczna Garmina. Sprawdzaj poziom poranny — mówi o jakości nocy.",
  stressScore: "Dobowy stres z urządzenia. Niższa wartość jest lepsza.",
  weightKg: "Masa ciała. Waż się o tej samej porze, najlepiej rano po przebudzeniu.",
  vo2Max: "Wydolność tlenowa — czynnik o największej wadze w modelu wieku biologicznego.",
  waterMl: "Nawodnienie z dziennika.",
};

/** Metryki wyliczane, nie mierzone — wymagają przeliczenia panelu dla każdego dnia. */
type DerivedKey = "biologicalAge" | "epigenetic" | "sleepScore" | "stressIndex" | "recoveryScore" | "energyScore";

const DERIVED_LABEL: Record<DerivedKey, string> = {
  biologicalAge: "Wiek biologiczny",
  epigenetic: "Epigenetic Score",
  sleepScore: "Sleep Score",
  stressIndex: "Indeks stresu",
  recoveryScore: "Regeneracja",
  energyScore: "Energia",
};

const Trends = () => {
  const { records, profile, analysis } = useLongevity();
  const [window, setWindow] = useState<TrendWindow>(30);
  const [metric, setMetric] = useState<TrendMetricKey>("sleepMin");

  const main = useMemo(() => analyzeTrend(records, metric, window), [metric, records, window]);

  /**
   * Serie wyliczane — liczone co kilka dni przy dłuższych oknach, bo pełny
   * panel dla 365 dni to setki przeliczeń modelu. Krok dobrany tak, aby
   * wykres miał zawsze około 60 punktów.
   */
  const derived = useMemo(() => {
    const slice = records.slice(-window);
    if (slice.length < 3) return null;
    const step = Math.max(1, Math.floor(slice.length / 60));

    const series: Record<DerivedKey, Array<{ date: string; value: number }>> = {
      biologicalAge: [],
      epigenetic: [],
      sleepScore: [],
      stressIndex: [],
      recoveryScore: [],
      energyScore: [],
    };

    for (let i = 0; i < slice.length; i += step) {
      const record = slice[i];
      const history = records.filter((r) => r.date < record.date);
      const baseline = analysis.baseline;
      const panel = buildPanel(record, history, profile, baseline);

      series.sleepScore.push({ date: record.date, value: panel.sleepScore.value });
      series.stressIndex.push({ date: record.date, value: panel.stressIndex.value });
      series.recoveryScore.push({ date: record.date, value: panel.recoveryScore.value });
      series.energyScore.push({ date: record.date, value: panel.energyScore.value });
      series.epigenetic.push({ date: record.date, value: calculateEpigeneticScore(record, profile).value });
      series.biologicalAge.push({
        date: record.date,
        value: estimateBiologicalAge(profile, [...history.slice(-89), record], baseline).estimatedAge,
      });
    }

    return series;
  }, [analysis.baseline, profile, records, window]);

  const [derivedKey, setDerivedKey] = useState<DerivedKey>("biologicalAge");

  const derivedAnalysis = useMemo(() => {
    if (!derived) return null;
    const points = derived[derivedKey];
    if (points.length < 2) return null;
    const half = Math.floor(points.length / 2);
    const firstHalf = points.slice(0, half).reduce((a, p) => a + p.value, 0) / Math.max(half, 1);
    const secondHalf =
      points.slice(half).reduce((a, p) => a + p.value, 0) / Math.max(points.length - half, 1);
    const changePct = firstHalf === 0 ? 0 : ((secondHalf - firstHalf) / Math.abs(firstHalf)) * 100;
    const lowerIsBetter = derivedKey === "stressIndex" || derivedKey === "biologicalAge";
    const improving = lowerIsBetter ? changePct < -1 : changePct > 1;
    const declining = lowerIsBetter ? changePct > 1 : changePct < -1;

    return {
      metric: derivedKey,
      window,
      points,
      mean: Math.round((points.reduce((a, p) => a + p.value, 0) / points.length) * 10) / 10,
      slopePerDay: 0,
      changePct: Math.round(changePct * 10) / 10,
      direction: improving ? ("improving" as const) : declining ? ("declining" as const) : ("stable" as const),
      coverage: points.length,
    };
  }, [derived, derivedKey, window]);

  return (
    <LongevityShell
      title="Trendy"
      subtitle="Zmiana w czasie mówi więcej niż pojedynczy dzień — to tutaj widać, czy praca przynosi efekt."
      action={
        <div className="flex gap-1.5">
          {WINDOWS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setWindow(item.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                window === item.value
                  ? "border-longevity-gold/40 bg-longevity-gold/10 text-longevity-gold-soft"
                  : "border-longevity-line bg-white/[0.03] text-longevity-muted hover:text-longevity-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Wskaźniki wyliczane ───────────────────────────────────────────── */}
        <GlassCard accent="gold" className="p-5">
          <SectionTitle
            eyebrow="Wskaźniki aplikacji"
            title={DERIVED_LABEL[derivedKey]}
            description={
              derivedAnalysis
                ? `${derivedAnalysis.coverage} punktów w oknie ${window} dni. Zmiana: ${derivedAnalysis.changePct > 0 ? "+" : ""}${derivedAnalysis.changePct}%.`
                : "Za mało danych, aby wyliczyć trend w tym oknie."
            }
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(DERIVED_LABEL) as DerivedKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDerivedKey(key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                  derivedKey === key
                    ? "border-longevity-teal/40 bg-longevity-teal/10 text-longevity-teal"
                    : "border-longevity-line bg-white/[0.03] text-longevity-muted hover:text-longevity-ink",
                )}
              >
                {DERIVED_LABEL[key]}
              </button>
            ))}
          </div>

          {derivedAnalysis ? (
            <TrendChart
              analysis={derivedAnalysis}
              unit={derivedKey === "biologicalAge" ? "lat" : "pkt"}
              height={260}
              className="mt-4"
              smooth={derivedAnalysis.points.length > 20}
            />
          ) : (
            <p className="mt-4 text-sm text-longevity-muted">
              Potrzebne są co najmniej 3 dni z danymi. Wypełnij dziennik albo podłącz urządzenie.
            </p>
          )}
        </GlassCard>

        {/* ── Metryki surowe ────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Pomiary z urządzeń"
            title={TREND_METRICS[metric].label}
            description={METRIC_NOTES[metric]}
            action={
              <Pill
                tone={
                  main.direction === "improving" ? "good" : main.direction === "declining" ? "danger" : "neutral"
                }
              >
                {main.direction === "improving"
                  ? "Kierunek korzystny"
                  : main.direction === "declining"
                    ? "Kierunek niekorzystny"
                    : "Bez istotnej zmiany"}
              </Pill>
            }
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(TREND_METRICS) as TrendMetricKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                  metric === key
                    ? "border-longevity-teal/40 bg-longevity-teal/10 text-longevity-teal"
                    : "border-longevity-line bg-white/[0.03] text-longevity-muted hover:text-longevity-ink",
                )}
              >
                {TREND_METRICS[key].label}
              </button>
            ))}
          </div>

          <TrendChart analysis={main} unit={TREND_METRICS[metric].unit} height={280} className="mt-4" />

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Średnia", `${main.mean} ${TREND_METRICS[metric].unit}`],
              ["Zmiana", `${main.changePct > 0 ? "+" : ""}${main.changePct}%`],
              ["Dni z pomiarem", `${main.coverage} z ${window}`],
              ["Nachylenie", `${main.slopePerDay > 0 ? "+" : ""}${main.slopePerDay} / dzień`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-longevity-line bg-white/[0.02] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-longevity-muted">{label}</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums text-longevity-ink">{value}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* ── Przegląd wszystkich metryk ────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle eyebrow="Przegląd" title="Wszystkie metryki w jednym miejscu" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(TREND_METRICS) as TrendMetricKey[]).map((key) => {
              const trend = analyzeTrend(records, key, window);
              const tone =
                trend.direction === "improving" ? "#2DD4BF" : trend.direction === "declining" ? "#F2707A" : "#E3C27E";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  className="rounded-xl border border-longevity-line bg-white/[0.02] p-4 text-left transition-colors hover:border-white/15"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-longevity-muted">{TREND_METRICS[key].label}</span>
                    <span
                      className="shrink-0 text-xs font-medium tabular-nums"
                      style={{ color: tone }}
                    >
                      {trend.coverage < 2 ? "—" : `${trend.changePct > 0 ? "+" : ""}${trend.changePct}%`}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums text-longevity-ink">
                    {trend.coverage < 1 ? "brak danych" : `${trend.mean} ${TREND_METRICS[key].unit}`}
                  </p>
                  <Sparkline points={trend.points} tone={tone} />
                </button>
              );
            })}
          </div>
        </GlassCard>

        <Disclaimer text="Trendy pokazują zmiany w Twoich danych. Zmiana poniżej 3% jest traktowana jako szum pomiarowy i nie jest raportowana jako poprawa ani pogorszenie. Wykresy nie służą do wykrywania chorób." />
      </div>
    </LongevityShell>
  );
};

export default Trends;
