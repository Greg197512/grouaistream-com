/**
 * Moduł MISJE I GAMIFIKACJA — XP, poziomy, odznaki i seria dni.
 *
 * Zasada projektowa: nagradzamy konsekwencję, nie rekordy. Seria ma jeden
 * „dzień ochronny” w tygodniu, bo aplikacja, która karze za jeden gorszy
 * dzień, sama staje się źródłem stresu — a to sprzeczne z jej celem.
 */

import { useMemo } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import { ScoreRing } from "@/components/longevity/ScoreRing";
import {
  Disclaimer,
  GlassCard,
  Pill,
  ProgressBar,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  EPIGENETIC_RULES,
  addDays,
  calculateEpigeneticScore,
  formatDuration,
  titleForLevel,
  toIsoDate,
} from "@/lib/longevity";
import { cn } from "@/lib/utils";

const CATEGORY_ICON = {
  sleep: "bedtime",
  movement: "directions_run",
  nutrition: "restaurant",
  mind: "self_improvement",
  recovery: "spa",
} as const;

const Missions = () => {
  const { analysis, records, profile } = useLongevity();
  const { missionProgress, gamification, panel, earnedXpToday } = analysis;

  /** Kalendarz aktywności — 12 tygodni wstecz, siatka jak wykres wkładu. */
  const calendar = useMemo(() => {
    const today = toIsoDate(new Date());
    const days: Array<{ date: string; score: number; hasData: boolean }> = [];
    for (let i = 83; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const record = records.find((r) => r.date === date);
      days.push({
        date,
        score: record ? calculateEpigeneticScore(record, profile).value : 0,
        hasData: Boolean(record),
      });
    }
    return days;
  }, [profile, records]);

  const earnedBadges = gamification.badges.filter((b) => b.progress >= 1);
  const inProgressBadges = gamification.badges
    .filter((b) => b.progress < 1)
    .sort((a, b) => b.progress - a.progress);

  return (
    <LongevityShell
      title="Misje i poziomy"
      subtitle="Codzienne zadania dobierane do Twojego stanu — nie do uniwersalnej listy."
      action={<Pill tone="gold">+{earnedXpToday} XP dzisiaj</Pill>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard accent="gold" className="flex flex-col items-center gap-4 p-6 lg:col-span-2">
            <ScoreRing
              value={(gamification.xpIntoLevel / gamification.xpForNextLevel) * 100}
              tone="gold"
              size={190}
            >
              <span className="text-[11px] uppercase tracking-[0.2em] text-longevity-muted">Poziom</span>
              <span className="font-display text-5xl font-semibold tabular-nums leading-none text-longevity-ink">
                {gamification.level}
              </span>
              <span className="mt-1 text-xs text-longevity-gold">{titleForLevel(gamification.level)}</span>
            </ScoreRing>

            <p className="text-center text-sm text-longevity-muted">
              {gamification.xpIntoLevel} / {gamification.xpForNextLevel} XP do poziomu {gamification.level + 1}
            </p>

            <div className="grid w-full grid-cols-3 gap-2.5">
              {[
                ["Seria", `${gamification.currentStreak} dni`],
                ["Rekord", `${gamification.longestStreak} dni`],
                ["XP łącznie", gamification.xp.toLocaleString("pl-PL")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-longevity-line bg-white/[0.02] p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-longevity-muted">{label}</p>
                  <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-longevity-ink">{value}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 lg:col-span-3">
            <SectionTitle
              eyebrow="Misje na dziś"
              title={`${missionProgress.filter((m) => m.complete).length} z ${missionProgress.length} ukończonych`}
              description="Zadania są generowane z Twoich danych: deficytu snu, stanu układu nerwowego i luk w nawykach z ostatniego tygodnia."
            />

            <div className="mt-4 space-y-3">
              {missionProgress.map(({ mission, current, progress, complete }) => (
                <div
                  key={mission.id}
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    complete
                      ? "border-longevity-good/25 bg-longevity-good/[0.05]"
                      : "border-longevity-line bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        complete ? "bg-longevity-good/15" : "bg-white/[0.05]",
                      )}
                    >
                      <span
                        className={cn(
                          "material-icons-outlined text-[18px] leading-none",
                          complete ? "text-longevity-good" : "text-longevity-gold",
                        )}
                        aria-hidden
                      >
                        {complete ? "check" : CATEGORY_ICON[mission.category]}
                      </span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-longevity-ink">{mission.title}</p>
                        <Pill tone={complete ? "good" : "gold"}>+{mission.xp} XP</Pill>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-longevity-muted">{mission.description}</p>
                      <p className="mt-1.5 text-[11px] italic leading-relaxed text-longevity-muted/70">
                        {mission.reason}
                      </p>

                      <div className="mt-2.5 flex items-center gap-3">
                        <ProgressBar value={progress} tone={complete ? "good" : "teal"} className="flex-1" />
                        <span className="shrink-0 text-[11px] tabular-nums text-longevity-muted">
                          {mission.metric === "sleepMin"
                            ? `${formatDuration(current)} / ${formatDuration(mission.target)}`
                            : `${current.toLocaleString("pl-PL")} / ${mission.target.toLocaleString("pl-PL")} ${mission.unit}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* ── Epigenetic Score ──────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Epigenetic Lifestyle Score"
            title={`${panel.epigeneticScore.value} / 100 punktów dzisiaj`}
            description="Punkty za nawyki, o których wiadomo, że wpływają na procesy starzenia. Punktacja jest częściowa — dzień „prawie udany” nie wygląda jak zmarnowany."
          />

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {panel.epigeneticScore.awards.map((award) => {
              const rule = EPIGENETIC_RULES.find((r) => r.key === award.key);
              return (
                <div
                  key={award.key}
                  className={cn(
                    "rounded-xl border p-3.5",
                    award.complete
                      ? "border-longevity-good/25 bg-longevity-good/[0.05]"
                      : "border-longevity-line bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-longevity-ink">{award.label}</p>
                    <p className="shrink-0 text-xs font-medium tabular-nums text-longevity-gold">
                      {award.points} / {award.maxPoints}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-longevity-muted">{award.detail}</p>
                  <ProgressBar
                    value={award.points / award.maxPoints}
                    tone={award.complete ? "good" : "gold"}
                    className="mt-2"
                  />
                  {rule && <p className="mt-1.5 text-[10px] text-longevity-muted/60">Cel: {rule.target}</p>}
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* ── Kalendarz ─────────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Ostatnie 12 tygodni"
            title="Kalendarz konsekwencji"
            description="Intensywność koloru odpowiada dziennemu Epigenetic Score. Puste pola to dni bez danych."
          />

          <div className="mt-4 overflow-x-auto">
            <div className="grid min-w-[560px] grid-flow-col grid-rows-7 gap-1">
              {calendar.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.hasData ? `${day.score}/100` : "brak danych"}`}
                  className="h-4 w-4 rounded-[3px] transition-colors"
                  style={{
                    background: day.hasData
                      ? `rgba(45,212,191,${0.12 + (day.score / 100) * 0.75})`
                      : "rgba(255,255,255,0.04)",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-longevity-muted">
            <span>Mniej</span>
            {[0.15, 0.35, 0.55, 0.75, 0.9].map((opacity) => (
              <span
                key={opacity}
                className="h-3 w-3 rounded-[3px]"
                style={{ background: `rgba(45,212,191,${opacity})` }}
              />
            ))}
            <span>Więcej</span>
          </div>
        </GlassCard>

        {/* ── Odznaki ───────────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Odznaki"
            title={`${earnedBadges.length} z ${gamification.badges.length} zdobytych`}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...earnedBadges, ...inProgressBadges].map((badge) => {
              const earned = badge.progress >= 1;
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4",
                    earned
                      ? "border-longevity-gold/30 bg-longevity-gold/[0.06]"
                      : "border-longevity-line bg-white/[0.02]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      earned ? "bg-gradient-to-br from-longevity-gold-deep to-longevity-gold-soft" : "bg-white/[0.05]",
                    )}
                  >
                    <span
                      className={cn(
                        "material-icons-outlined text-[18px] leading-none",
                        earned ? "text-black" : "text-longevity-muted/50",
                      )}
                      aria-hidden
                    >
                      {earned ? "workspace_premium" : "lock"}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", earned ? "text-longevity-ink" : "text-longevity-muted")}>
                      {badge.label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-longevity-muted/80">{badge.description}</p>
                    {!earned && (
                      <>
                        <ProgressBar value={badge.progress} tone="gold" className="mt-2" />
                        <p className="mt-1 text-[10px] tabular-nums text-longevity-muted/60">
                          {Math.round(badge.progress * 100)}%
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="Jak działa punktacja" title="Zasady bez ukrytych mnożników" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ["XP za misje", "Pełne XP za ukończoną misję, połowa proporcjonalnie za częściowy postęp."],
              ["Poziomy", "Wymagane XP rośnie o 18% na poziom — od 100 XP na starcie."],
              ["Seria dni", "Liczy się dzień z co najmniej jedną ukończoną misją. Jeden dzień w tygodniu jest wybaczany."],
              ["Brak kar", "Nie odbieramy XP ani nie resetujemy postępu za gorszy dzień."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-longevity-line bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-longevity-ink">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-longevity-muted">{text}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <Disclaimer text="Misje są sugestiami dotyczącymi stylu życia dopasowanymi do Twoich danych. Nie stanowią planu terapeutycznego. Jeśli którekolwiek zadanie jest sprzeczne z zaleceniami Twojego lekarza, kieruj się zaleceniem lekarza." />
      </div>
    </LongevityShell>
  );
};

export default Missions;
