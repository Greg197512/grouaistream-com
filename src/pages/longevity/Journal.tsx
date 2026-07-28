/**
 * DZIENNIK DNIA — ręczne uzupełnienie tego, czego nie da się zmierzyć.
 *
 * Aplikacja ma być w pełni użyteczna bez żadnego urządzenia. Ten ekran
 * pozwala wpisać sen, samopoczucie i nawyki w kilkanaście sekund: suwaki
 * zamiast pól tekstowych, zapis automatyczny, żadnego przycisku „zapisz”.
 *
 * Można też cofnąć się do poprzednich dni — dziennik uzupełniony wieczorem
 * następnego dnia jest lepszy niż dziura w danych.
 */

import { useState } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import {
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import { addDays, formatDuration, formatMinuteOfDay, toIsoDate } from "@/lib/longevity";
import { cn } from "@/lib/utils";

/** Suwak z etykietą i wartością — podstawowy element całego dziennika. */
const Slider = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  hint?: string;
}) => (
  <div>
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <label className="text-xs text-longevity-muted">{label}</label>
      <span className="text-sm font-medium tabular-nums text-longevity-ink">
        {value === undefined ? "—" : format ? format(value) : value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value ?? min}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-longevity-teal"
      aria-label={label}
    />
    {hint && <p className="mt-1 text-[11px] text-longevity-muted/70">{hint}</p>}
  </div>
);

/** Ocena 1–5 klikana jednym palcem — szybsza niż suwak przy krótkiej skali. */
const Rating = ({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
}) => (
  <div>
    <p className="mb-2 text-xs text-longevity-muted">{label}</p>
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className={cn(
            "h-10 flex-1 rounded-lg border text-sm font-medium transition-colors",
            value === score
              ? "border-longevity-teal/50 bg-longevity-teal/15 text-longevity-teal"
              : "border-longevity-line bg-white/[0.03] text-longevity-muted hover:border-white/15",
          )}
        >
          {score}
        </button>
      ))}
    </div>
    <div className="mt-1 flex justify-between text-[10px] text-longevity-muted/60">
      <span>{lowLabel}</span>
      <span>{highLabel}</span>
    </div>
  </div>
);

const Journal = () => {
  const { records, updateRecord, todayDate } = useLongevity();
  const [date, setDate] = useState(todayDate);

  const record = records.find((r) => r.date === date) ?? { date };
  const sleep = record.sleep ?? {};
  const lifestyle = record.lifestyle ?? {};
  const subjective = record.subjective ?? {};
  const body = record.body ?? {};
  const activity = record.activity ?? {};

  const patch = (partial: Parameters<typeof updateRecord>[0]) => updateRecord(partial, date);

  const isToday = date === todayDate;
  const filledFields = [
    sleep.durationMin,
    subjective.mood,
    subjective.energy,
    subjective.stress,
    lifestyle.meditationMin,
    record.nutrition?.waterMl,
    activity.steps,
    body.weightKg,
  ].filter((v) => v !== undefined).length;

  return (
    <LongevityShell
      title="Dziennik dnia"
      subtitle="Wszystko, czego nie zmierzy zegarek. Zapisuje się automatycznie."
      action={<Pill tone={filledFields >= 5 ? "good" : "neutral"}>{filledFields} z 8 pól uzupełnionych</Pill>}
    >
      <div className="space-y-6">
        {/* ── Wybór dnia ────────────────────────────────────────────────────── */}
        <GlassCard className="flex flex-wrap items-center gap-3 p-4">
          <button
            type="button"
            onClick={() => setDate(addDays(date, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-longevity-line text-longevity-muted transition-colors hover:text-longevity-ink"
            aria-label="Poprzedni dzień"
          >
            <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
              chevron_left
            </span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="font-display text-lg font-semibold text-longevity-ink">
              {new Date(date).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-xs text-longevity-muted">{isToday ? "Dzisiaj" : date}</p>
          </div>

          <button
            type="button"
            onClick={() => setDate(addDays(date, 1))}
            disabled={isToday}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-longevity-line text-longevity-muted transition-colors hover:text-longevity-ink disabled:opacity-30"
            aria-label="Następny dzień"
          >
            <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
              chevron_right
            </span>
          </button>

          {!isToday && (
            <LongevityButton size="sm" variant="ghost" onClick={() => setDate(toIsoDate(new Date()))}>
              Wróć do dziś
            </LongevityButton>
          )}
        </GlassCard>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Sen ─────────────────────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Noc" title="Sen" />
            <div className="mt-4 space-y-5">
              <Slider
                label="Długość snu"
                value={sleep.durationMin}
                onChange={(v) => patch({ sleep: { ...sleep, durationMin: v } })}
                min={180}
                max={720}
                step={15}
                format={formatDuration}
              />
              <Slider
                label="Godzina zaśnięcia"
                value={sleep.bedtimeMinOfDay}
                onChange={(v) => patch({ sleep: { ...sleep, bedtimeMinOfDay: v } })}
                min={1200}
                max={1620}
                step={15}
                format={formatMinuteOfDay}
                hint="Zakres od 20:00 do 03:00"
              />
              <Slider
                label="Liczba pobudek"
                value={sleep.awakenings}
                onChange={(v) => patch({ sleep: { ...sleep, awakenings: v } })}
                min={0}
                max={10}
              />
              <Rating
                label="Odczuwana jakość snu"
                value={subjective.sleepQuality}
                onChange={(v) => patch({ subjective: { ...subjective, sleepQuality: v } })}
                lowLabel="Bardzo zła"
                highLabel="Doskonała"
              />
            </div>
          </GlassCard>

          {/* ── Samopoczucie ────────────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Jak się dziś czujesz" title="Samopoczucie" />
            <div className="mt-4 space-y-5">
              <Rating
                label="Nastrój"
                value={subjective.mood}
                onChange={(v) => patch({ subjective: { ...subjective, mood: v } })}
                lowLabel="Bardzo zły"
                highLabel="Bardzo dobry"
              />
              <Rating
                label="Energia"
                value={subjective.energy}
                onChange={(v) => patch({ subjective: { ...subjective, energy: v } })}
                lowLabel="Wyczerpanie"
                highLabel="Pełnia sił"
              />
              <Rating
                label="Odczuwany stres"
                value={subjective.stress}
                onChange={(v) => patch({ subjective: { ...subjective, stress: v } })}
                lowLabel="Spokój"
                highLabel="Bardzo wysoki"
              />
              <Rating
                label="Koncentracja"
                value={subjective.focus}
                onChange={(v) => patch({ subjective: { ...subjective, focus: v } })}
                lowLabel="Rozproszenie"
                highLabel="Pełne skupienie"
              />
            </div>
          </GlassCard>

          {/* ── Nawyki ──────────────────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Praktyki" title="Nawyki dnia" />
            <div className="mt-4 space-y-5">
              <Slider
                label="Medytacja"
                value={lifestyle.meditationMin}
                onChange={(v) => patch({ lifestyle: { ...lifestyle, meditationMin: v } })}
                max={60}
                format={(v) => `${v} min`}
              />
              <Slider
                label="Ćwiczenia oddechowe"
                value={lifestyle.breathworkMin}
                onChange={(v) => patch({ lifestyle: { ...lifestyle, breathworkMin: v } })}
                max={60}
                format={(v) => `${v} min`}
              />
              <Slider
                label="Czas na zewnątrz"
                value={lifestyle.outdoorMin}
                onChange={(v) => patch({ lifestyle: { ...lifestyle, outdoorMin: v } })}
                max={240}
                step={5}
                format={(v) => `${v} min`}
              />
              <Slider
                label="Światło poranne"
                value={lifestyle.morningLightMin}
                onChange={(v) => patch({ lifestyle: { ...lifestyle, morningLightMin: v } })}
                max={60}
                step={5}
                format={(v) => `${v} min`}
                hint="W ciągu godziny od przebudzenia"
              />
              <Slider
                label="Ekran przed snem"
                value={lifestyle.screenBeforeBedMin}
                onChange={(v) => patch({ lifestyle: { ...lifestyle, screenBeforeBedMin: v } })}
                max={120}
                step={5}
                format={(v) => `${v} min`}
                hint="Im mniej, tym lepiej"
              />
              <Slider
                label="Papierosy"
                value={lifestyle.cigarettes}
                onChange={(v) =>
                  patch({
                    lifestyle: { ...lifestyle, cigarettes: v, smokingStatus: v > 0 ? "current" : lifestyle.smokingStatus },
                  })
                }
                max={40}
              />
            </div>
          </GlassCard>

          {/* ── Ciało i aktywność ───────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Pomiary" title="Ciało i ruch" />
            <div className="mt-4 space-y-5">
              <Slider
                label="Masa ciała"
                value={body.weightKg}
                onChange={(v) => patch({ body: { ...body, weightKg: v } })}
                min={35}
                max={200}
                step={0.1}
                format={(v) => `${v.toFixed(1)} kg`}
              />
              <Slider
                label="Kroki"
                value={activity.steps}
                onChange={(v) => patch({ activity: { ...activity, steps: v } })}
                max={30_000}
                step={100}
                format={(v) => v.toLocaleString("pl-PL")}
                hint="Dane z zegarka nadpisują wpis ręczny"
              />
              <Slider
                label="Aktywność umiarkowana i intensywna"
                value={activity.moderateVigorousMin}
                onChange={(v) => patch({ activity: { ...activity, moderateVigorousMin: v } })}
                max={240}
                step={5}
                format={(v) => `${v} min`}
              />
              <Slider
                label="Tętno spoczynkowe"
                value={record.cardio?.restingHeartRate}
                onChange={(v) => patch({ cardio: { ...record.cardio, restingHeartRate: v } })}
                min={35}
                max={110}
                format={(v) => `${v} bpm`}
                hint="Zmierz rano, jeszcze w łóżku"
              />
              <Slider
                label="Liczba powiadomień"
                value={lifestyle.notifications}
                onChange={(v) => patch({ lifestyle: { ...lifestyle, notifications: v } })}
                max={400}
                step={10}
                hint="Przybliżenie obciążenia uwagi — wystarczy szacunek"
              />
            </div>
          </GlassCard>
        </div>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="Skróty" title="Typowy dzień jednym kliknięciem" />
          <div className="mt-3 flex flex-wrap gap-2">
            <LongevityButton
              variant="ghost"
              size="sm"
              onClick={() =>
                patch({
                  sleep: { ...sleep, durationMin: 450, bedtimeMinOfDay: 1380, awakenings: 1 },
                  subjective: { ...subjective, mood: 4, energy: 4, stress: 2, focus: 4, sleepQuality: 4 },
                  lifestyle: { ...lifestyle, cigarettes: 0, screenBeforeBedMin: 20 },
                  nutrition: { ...record.nutrition, alcoholUnits: 0 },
                })
              }
            >
              Dzień standardowy
            </LongevityButton>
            <LongevityButton
              variant="ghost"
              size="sm"
              onClick={() =>
                patch({
                  sleep: { ...sleep, durationMin: 330, awakenings: 3 },
                  subjective: { ...subjective, mood: 2, energy: 2, stress: 4, focus: 2, sleepQuality: 2 },
                })
              }
            >
              Ciężka noc
            </LongevityButton>
            <LongevityButton
              variant="ghost"
              size="sm"
              onClick={() => patch({ nutrition: { ...record.nutrition, alcoholUnits: 0 }, lifestyle: { ...lifestyle, cigarettes: 0 } })}
            >
              Bez używek
            </LongevityButton>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-longevity-muted/70">
            Skróty wpisują wartości typowe, które możesz potem poprawić suwakami. Służą do szybkiego
            uzupełnienia zaległych dni, nie do zmyślania danych — wpis nieprawdziwy zepsuje Twoją bazę osobistą.
          </p>
        </GlassCard>

        <Disclaimer text="Dane z dziennika są przechowywane lokalnie na Twoim urządzeniu i — jeśli jesteś zalogowany — synchronizowane z Twoim kontem. Nie są udostępniane osobom trzecim. Szczegóły i eksport znajdziesz w Ustawieniach." />
      </div>
    </LongevityShell>
  );
};

export default Journal;
