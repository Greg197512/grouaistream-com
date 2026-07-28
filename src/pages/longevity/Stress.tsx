/**
 * Moduł STRES — HRV, tętno, obciążenie uwagi, aktywność i samopoczucie.
 *
 * Najważniejsza różnica względem typowych aplikacji: wszystko odnosimy
 * do osobistej bazy użytkownika, nie do średniej populacyjnej.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LongevityShell, LONGEVITY_BASE } from "@/components/longevity/LongevityShell";
import { DriverBars, MetricTile, ScoreRing } from "@/components/longevity/ScoreRing";
import { TrendChart } from "@/components/longevity/TrendChart";
import {
  ConfidenceBadge,
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  SectionTitle,
  StatRow,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import { STRESS_LEVEL_LABEL, analyzeTrend, recommendSessions } from "@/lib/longevity";

const LEVEL_META = {
  low: {
    tone: "good" as const,
    description:
      "Obciążenie jest niskie. To dobry moment na trudniejsze zadania, trening jakościowy albo naukę nowych rzeczy.",
  },
  moderate: {
    tone: "warn" as const,
    description:
      "Typowe obciążenie dnia roboczego. Warto zadbać o przerwy i o wieczorne wyciszenie, żeby nie kumulowało się przez tydzień.",
  },
  high: {
    tone: "warn" as const,
    description:
      "Organizm pracuje na podwyższonych obrotach. Priorytetem jest sen i regulacja oddechem — kolejny mocny bodziec pogłębi obciążenie.",
  },
  critical: {
    tone: "danger" as const,
    description:
      "Bardzo wysokie obciążenie. Dzisiaj celem jest wyłącznie regeneracja: sen, spacer, nawodnienie i praktyka oddechowa.",
  },
};

const Stress = () => {
  const { analysis, records, today } = useLongevity();
  const { panel, twin } = analysis;
  const meta = LEVEL_META[panel.stressLevel];

  const hrvTrend = useMemo(() => analyzeTrend(records, "hrvMs", 30), [records]);
  const stressTrend = useMemo(() => analyzeTrend(records, "stressScore", 30), [records]);

  const hrv = today.cardio?.hrvMs ?? today.sleep?.avgHrvMs;
  const hrvDelta =
    hrv !== undefined && twin.baseline.hrvMs ? ((hrv - twin.baseline.hrvMs) / twin.baseline.hrvMs) * 100 : undefined;
  const rhr = today.cardio?.restingHeartRate ?? today.sleep?.avgHeartRate;
  const rhrDelta = rhr !== undefined && twin.baseline.restingHeartRate ? rhr - twin.baseline.restingHeartRate : undefined;

  const sessions = recommendSessions(panel.nervousSystem.state, 3);

  return (
    <LongevityShell title="Stres" subtitle="Codzienna analiza obciążenia fizjologicznego i psychicznego.">
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard
            accent={panel.stressLevel === "low" ? "teal" : "gold"}
            className="flex flex-col items-center gap-4 p-6 lg:col-span-2"
          >
            {/* Pierścień pokazuje spokój (odwrotność indeksu) — rosnący
                wskaźnik zawsze oznacza tu poprawę, jak na pozostałych ekranach. */}
            <ScoreRing
              value={100 - panel.stressIndex.value}
              tone={panel.stressLevel === "low" ? "teal" : "gold"}
              size={190}
            >
              <span className="text-[11px] uppercase tracking-[0.2em] text-longevity-muted">Indeks stresu</span>
              <span className="font-display text-5xl font-semibold tabular-nums leading-none text-longevity-ink">
                {panel.stressIndex.value}
              </span>
              <span className="mt-1 text-xs text-longevity-muted">na 100</span>
            </ScoreRing>

            <div className="text-center">
              <Pill tone={meta.tone}>{STRESS_LEVEL_LABEL[panel.stressLevel]}</Pill>
              <ConfidenceBadge confidence={panel.stressIndex.confidence} className="ml-2" />
            </div>
            <p className="text-center text-sm leading-relaxed text-longevity-muted">{meta.description}</p>
          </GlassCard>

          <div className="space-y-4 lg:col-span-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile
                label="HRV"
                value={hrv ? Math.round(hrv) : "—"}
                unit="ms"
                ratio={hrv && twin.baseline.hrvMs ? Math.min(1, hrv / (twin.baseline.hrvMs * 1.4)) : 0}
                tone={hrvDelta !== undefined && hrvDelta < -10 ? "danger" : "teal"}
                icon="favorite"
                hint={
                  hrvDelta !== undefined
                    ? `${hrvDelta > 0 ? "+" : ""}${Math.round(hrvDelta)}% względem bazy`
                    : "Podłącz urządzenie z pomiarem HRV"
                }
              />
              <MetricTile
                label="Tętno spoczynkowe"
                value={rhr ? Math.round(rhr) : "—"}
                unit="bpm"
                ratio={rhr ? Math.max(0, 1 - (rhr - 45) / 40) : 0}
                tone={rhrDelta !== undefined && rhrDelta >= 5 ? "warn" : "teal"}
                icon="monitor_heart"
                hint={
                  rhrDelta !== undefined
                    ? `${rhrDelta > 0 ? "+" : ""}${Math.round(rhrDelta)} bpm względem bazy`
                    : undefined
                }
              />
              <MetricTile
                label="Stres z urządzenia"
                value={today.vendor?.stressScore ?? "—"}
                ratio={today.vendor?.stressScore ? today.vendor.stressScore / 100 : 0}
                tone={(today.vendor?.stressScore ?? 0) <= 50 ? "good" : "danger"}
                icon="graphic_eq"
                hint="Garmin / Samsung / Huawei"
              />
              <MetricTile
                label="Powiadomienia"
                value={today.lifestyle?.notifications ?? "—"}
                ratio={today.lifestyle?.notifications ? Math.min(1, today.lifestyle.notifications / 250) : 0}
                tone={(today.lifestyle?.notifications ?? 0) <= 100 ? "good" : "warn"}
                icon="notifications"
                hint="Proxy obciążenia uwagi"
              />
            </div>

            <GlassCard className="p-5">
              <SectionTitle eyebrow="Z czego wynika dzisiejszy indeks" title="Składniki obciążenia" />
              <div className="mt-4">
                <DriverBars drivers={panel.stressIndex.drivers} />
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-longevity-muted/80">
                Dłuższy pasek oznacza większy udział danego czynnika w dzisiejszym wyniku. HRV i tętno
                są oceniane względem Twojej bazy z ostatnich 28 dni
                {twin.baseline.hrvMs ? ` (HRV: ${Math.round(twin.baseline.hrvMs)} ms)` : ""}, a nie wobec normy populacyjnej.
              </p>
            </GlassCard>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-5">
            <SectionTitle
              eyebrow="Trend HRV · 30 dni"
              title={
                hrvTrend.direction === "improving"
                  ? `HRV rośnie (+${Math.abs(hrvTrend.changePct)}%)`
                  : hrvTrend.direction === "declining"
                    ? `HRV spada (${hrvTrend.changePct}%)`
                    : "HRV stabilne"
              }
              description="Wielotygodniowy spadek HRV zwykle poprzedza spadek formy i pogorszenie snu."
            />
            <TrendChart
              analysis={hrvTrend}
              unit="ms"
              className="mt-4"
              reference={twin.baseline.hrvMs ? { value: twin.baseline.hrvMs, label: "baza" } : undefined}
            />
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle
              eyebrow="Trend stresu · 30 dni"
              title={
                stressTrend.coverage < 3
                  ? "Brak danych o stresie z urządzenia"
                  : stressTrend.direction === "improving"
                    ? "Obciążenie maleje"
                    : stressTrend.direction === "declining"
                      ? "Obciążenie rośnie"
                      : "Obciążenie stabilne"
              }
            />
            <TrendChart analysis={stressTrend} className="mt-4" />
          </GlassCard>
        </div>

        <GlassCard accent="teal" className="p-5">
          <SectionTitle
            eyebrow="Co zrobić teraz"
            title="Interwencje dopasowane do dzisiejszego stanu"
            description="Kolejność ma znaczenie: najpierw regulacja oddechem, potem ruch, na końcu zmiany długoterminowe."
          />

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {panel.nervousSystem.suggestedProtocols.map((protocolId) => (
              <Link key={protocolId} to={`${LONGEVITY_BASE}/oddech?protokol=${protocolId}`}>
                <GlassCard interactive className="h-full p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-longevity-ink">
                    <span className="material-icons-outlined text-[18px] leading-none text-longevity-teal" aria-hidden>
                      air
                    </span>
                    Ćwiczenie oddechowe
                  </p>
                  <p className="mt-1 text-xs text-longevity-muted">Protokół: {protocolId}</p>
                </GlassCard>
              </Link>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {sessions.map((session) => (
              <Link key={session.id} to={`${LONGEVITY_BASE}/medytacje?sesja=${session.id}`}>
                <GlassCard interactive className="h-full p-4">
                  <p className="text-sm font-medium text-longevity-ink">{session.title}</p>
                  <p className="mt-1 text-xs text-longevity-muted">
                    {session.minutes} min · {session.purpose}
                  </p>
                </GlassCard>
              </Link>
            ))}
          </div>

          <div className="mt-4">
            <StatRow
              label="Aktywność umiarkowana i intensywna dziś"
              value={`${today.activity?.moderateVigorousMin ?? 0} min`}
              hint="Ruch obniża stres, ale przy przeciążeniu lepszy jest spacer niż interwały"
            />
            <StatRow
              label="Medytacja i oddech dziś"
              value={`${(today.lifestyle?.meditationMin ?? 0) + (today.lifestyle?.breathworkMin ?? 0)} min`}
            />
          </div>

          <Link to={`${LONGEVITY_BASE}/uklad-nerwowy`} className="mt-4 inline-block">
            <LongevityButton variant="ghost" size="sm">
              Zobacz stan układu nerwowego
            </LongevityButton>
          </Link>
        </GlassCard>

        <Disclaimer text="Indeks stresu to wskaźnik stylu życia liczony z danych z urządzeń i Twoich wpisów. Nie jest badaniem medycznym ani oceną stanu psychicznego. Jeśli napięcie, lęk lub obniżony nastrój utrzymują się dłużej niż dwa tygodnie, porozmawiaj z lekarzem lub psychoterapeutą. Kryzysowy telefon zaufania: 116 123." />
      </div>
    </LongevityShell>
  );
};

export default Stress;
