/**
 * USTAWIENIA — profil, cele, język, powiadomienia, prywatność.
 *
 * Sekcja „Twoje dane” realizuje obowiązki z RODO w sposób, który da się
 * wykonać jednym kliknięciem: eksport (art. 20) i usunięcie (art. 17).
 * Nie chowamy tego w regulaminie.
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
import { formatDuration, formatMinuteOfDay, type LongevityLocale, type Sex } from "@/lib/longevity";
import { cn } from "@/lib/utils";

const LOCALES: Array<{ code: LongevityLocale; label: string; flag: string }> = [
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ua", label: "Українська", flag: "🇺🇦" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: "female", label: "Kobieta" },
  { value: "male", label: "Mężczyzna" },
  { value: "unspecified", label: "Nie podaję" },
];

const SMOKING_OPTIONS = [
  { value: "never" as const, label: "Nigdy nie paliłem" },
  { value: "former" as const, label: "Rzuciłem" },
  { value: "current" as const, label: "Palę" },
];

const Field = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  max: number;
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
      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-longevity-gold"
      aria-label={label}
    />
    {hint && <p className="mt-1 text-[11px] text-longevity-muted/70">{hint}</p>}
  </div>
);

const Toggle = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex w-full items-start gap-4 border-b border-longevity-line/60 py-3.5 text-left last:border-0"
  >
    <div className="min-w-0 flex-1">
      <p className="text-sm text-longevity-ink">{label}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-longevity-muted">{description}</p>
    </div>
    <span
      className={cn(
        "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
        checked ? "bg-longevity-teal" : "bg-white/[0.12]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-300",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </span>
  </button>
);

const Settings = () => {
  const { profile, settings, updateProfile, updateSettings, exportData, deleteAllData, records, totalXp } =
    useLongevity();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = () => {
    const bundle = exportData();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zatrzymac-starosc-eksport-${bundle.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Wyeksportowano ${bundle.records.length} dni danych.`);
  };

  const handleDelete = async () => {
    await deleteAllData();
    setConfirmDelete(false);
    setStatusMessage("Wszystkie dane zostały usunięte z tego urządzenia i z konta.");
  };

  return (
    <LongevityShell title="Ustawienia" subtitle="Profil, cele, język i pełna kontrola nad danymi.">
      <div className="space-y-6">
        {statusMessage && (
          <GlassCard accent="teal" className="flex items-center gap-3 p-4">
            <span className="material-icons-outlined text-[18px] leading-none text-longevity-teal" aria-hidden>
              check_circle
            </span>
            <p className="text-sm text-longevity-ink">{statusMessage}</p>
          </GlassCard>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Profil ──────────────────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <SectionTitle
              eyebrow="Profil"
              title="Dane podstawowe"
              description="Potrzebne do wyliczenia wieku biologicznego, celów żywieniowych i norm wiekowych VO₂max."
            />

            <div className="mt-4 space-y-5">
              <Field
                label="Wiek"
                value={profile.chronologicalAge}
                onChange={(v) => updateProfile({ chronologicalAge: v })}
                min={16}
                max={100}
                format={(v) => `${v} lat`}
              />
              <Field
                label="Wzrost"
                value={profile.heightCm}
                onChange={(v) => updateProfile({ heightCm: v })}
                min={130}
                max={220}
                format={(v) => `${v} cm`}
              />
              <Field
                label="Masa ciała"
                value={profile.weightKg}
                onChange={(v) => updateProfile({ weightKg: v })}
                min={35}
                max={200}
                step={0.5}
                format={(v) => `${v} kg`}
                hint="Pomiar z wagi (np. Withings) nadpisuje tę wartość"
              />

              <div>
                <p className="mb-2 text-xs text-longevity-muted">Płeć biologiczna</p>
                <div className="flex gap-2">
                  {SEX_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateProfile({ sex: option.value })}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2.5 text-xs transition-colors",
                        profile.sex === option.value
                          ? "border-longevity-gold/40 bg-longevity-gold/10 text-longevity-gold-soft"
                          : "border-longevity-line bg-white/[0.03] text-longevity-muted",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-longevity-muted/70">
                  Wpływa wyłącznie na normy referencyjne VO₂max i obwodu talii.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs text-longevity-muted">Palenie tytoniu</p>
                <div className="flex gap-2">
                  {SMOKING_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateProfile({ smokingStatus: option.value })}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2.5 text-xs transition-colors",
                        profile.smokingStatus === option.value
                          ? "border-longevity-gold/40 bg-longevity-gold/10 text-longevity-gold-soft"
                          : "border-longevity-line bg-white/[0.03] text-longevity-muted",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {profile.smokingStatus === "former" && (
                <Field
                  label="Lata od rzucenia"
                  value={profile.yearsSinceQuit}
                  onChange={(v) => updateProfile({ yearsSinceQuit: v })}
                  min={0}
                  max={40}
                  format={(v) => `${v} lat`}
                  hint="Nadwyżka ryzyka maleje z czasem — po około 15 latach jest bliska zeru"
                />
              )}

              <Field
                label="Alkohol tygodniowo"
                value={profile.weeklyAlcoholUnits}
                onChange={(v) => updateProfile({ weeklyAlcoholUnits: v })}
                min={0}
                max={40}
                format={(v) => `${v} jedn.`}
                hint="1 jednostka ≈ 10 g etanolu (małe piwo, lampka wina)"
              />
            </div>
          </GlassCard>

          {/* ── Cele ────────────────────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Cele dzienne" title="Twoje progi" description="Misje i punktacja dopasują się do tych wartości." />

            <div className="mt-4 space-y-5">
              <Field
                label="Docelowa długość snu"
                value={profile.targetSleepMin}
                onChange={(v) => updateProfile({ targetSleepMin: v })}
                min={360}
                max={600}
                step={15}
                format={formatDuration}
              />
              <Field
                label="Docelowa pora zaśnięcia"
                value={profile.targetBedtimeMinOfDay}
                onChange={(v) => updateProfile({ targetBedtimeMinOfDay: v })}
                min={1200}
                max={1560}
                step={15}
                format={formatMinuteOfDay}
              />
              <Field
                label="Docelowa liczba kroków"
                value={profile.targetSteps}
                onChange={(v) => updateProfile({ targetSteps: v })}
                min={2000}
                max={20_000}
                step={500}
                format={(v) => v.toLocaleString("pl-PL")}
              />
              <Field
                label="Docelowe nawodnienie"
                value={profile.targetWaterMl}
                onChange={(v) => updateProfile({ targetWaterMl: v })}
                min={1000}
                max={4000}
                step={100}
                format={(v) => `${(v / 1000).toFixed(1)} l`}
              />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs text-longevity-muted">Jednostki</p>
              <div className="flex gap-2">
                {(["metric", "imperial"] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => updateSettings({ units: unit })}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2.5 text-xs transition-colors",
                      settings.units === unit
                        ? "border-longevity-gold/40 bg-longevity-gold/10 text-longevity-gold-soft"
                        : "border-longevity-line bg-white/[0.03] text-longevity-muted",
                    )}
                  >
                    {unit === "metric" ? "Metryczne (kg, km)" : "Imperialne (lb, mi)"}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* ── Język ─────────────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle eyebrow="Język" title="Wersja językowa" description="Ustawienie dotyczy również odpowiedzi AI Coacha." />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LOCALES.map((locale) => (
              <button
                key={locale.code}
                type="button"
                onClick={() => {
                  updateSettings({ locale: locale.code });
                  updateProfile({ locale: locale.code });
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  settings.locale === locale.code
                    ? "border-longevity-gold/40 bg-longevity-gold/10"
                    : "border-longevity-line bg-white/[0.03] hover:border-white/15",
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {locale.flag}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    settings.locale === locale.code ? "text-longevity-gold-soft" : "text-longevity-muted",
                  )}
                >
                  {locale.label}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ── Powiadomienia ─────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Powiadomienia"
            title="Delikatnie, nie więcej niż cztery dziennie"
            description="Aplikacja ma obniżać stres, więc nie zasypuje powiadomieniami. Twardy limit dobowy to cztery — nawet jeśli wydarzy się więcej rzeczy wartych uwagi."
          />

          <div className="mt-4">
            <Field
              label="Maksymalnie powiadomień dziennie"
              value={settings.maxNotificationsPerDay}
              onChange={(v) => updateSettings({ maxNotificationsPerDay: v })}
              min={0}
              max={4}
              format={(v) => (v === 0 ? "Wyłączone" : `${v}`)}
            />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field
              label="Cisza od godziny"
              value={settings.quietHours.from}
              onChange={(v) => updateSettings({ quietHours: { ...settings.quietHours, from: v } })}
              min={18}
              max={23}
              format={(v) => `${v}:00`}
            />
            <Field
              label="Cisza do godziny"
              value={settings.quietHours.to}
              onChange={(v) => updateSettings({ quietHours: { ...settings.quietHours, to: v } })}
              min={5}
              max={11}
              format={(v) => `${v}:00`}
            />
          </div>

          <div className="mt-5">
            <Toggle
              label="AI Coach"
              description="Zanonimizowany kontekst (same liczby i wnioski) trafia do modelu językowego, aby odpowiedzi brzmiały naturalnie. Po wyłączeniu trener działa wyłącznie na silniku reguł, w całości na Twoim urządzeniu."
              checked={settings.aiCoachEnabled}
              onChange={(v) => updateSettings({ aiCoachEnabled: v })}
            />
            <Toggle
              label="Pokazuj wyniki o niskiej pewności"
              description="Gdy danych jest mało, wyniki i tak są wyświetlane — z wyraźnym oznaczeniem. Po wyłączeniu zamiast liczby zobaczysz informację, czego brakuje."
              checked={settings.showLowConfidence}
              onChange={(v) => updateSettings({ showLowConfidence: v })}
            />
            <Toggle
              label="Tryb demonstracyjny"
              description="Pokazuje dane poglądowe zamiast Twoich. Nic z tego trybu nie trafia do bazy ani nie miesza się z Twoją historią."
              checked={settings.demoMode}
              onChange={(v) => updateSettings({ demoMode: v })}
            />
          </div>
        </GlassCard>

        {/* ── Dane i prywatność ─────────────────────────────────────────────── */}
        <GlassCard accent="gold" className="p-5">
          <SectionTitle
            eyebrow="Twoje dane"
            title="Eksport, import i usunięcie"
            description="Dane zdrowotne należą do Ciebie. Możesz je zabrać ze sobą albo usunąć w całości — bez kontaktu z obsługą."
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Zapisanych dni", records.length.toString()],
              ["Punkty XP", totalXp.toLocaleString("pl-PL")],
              ["Miejsce przechowywania", "Urządzenie + konto"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-longevity-line bg-white/[0.02] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-longevity-muted">{label}</p>
                <p className="mt-1 font-display text-lg font-semibold text-longevity-ink">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <LongevityButton size="sm" onClick={handleExport}>
              <span className="material-icons-outlined text-[16px] leading-none" aria-hidden>
                download
              </span>
              Eksportuj dane (JSON)
            </LongevityButton>

            {!confirmDelete ? (
              <LongevityButton size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <span className="material-icons-outlined text-[16px] leading-none" aria-hidden>
                  delete_outline
                </span>
                Usuń wszystkie dane
              </LongevityButton>
            ) : (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-longevity-danger/30 bg-longevity-danger/[0.06] p-3.5">
                <p className="min-w-0 flex-1 text-sm text-longevity-ink">
                  Usunąć wszystkie dane z tego urządzenia i z konta? Operacja jest nieodwracalna — wcześniej
                  możesz wykonać eksport.
                </p>
                <LongevityButton size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Anuluj
                </LongevityButton>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="rounded-full bg-longevity-danger px-4 py-2 text-xs font-medium text-black transition-colors hover:brightness-110"
                >
                  Usuń bezpowrotnie
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2 text-xs leading-relaxed text-longevity-muted">
            <p className="flex items-start gap-2">
              <Pill tone="teal">RODO</Pill>
              <span>
                Eksport realizuje prawo do przenoszenia danych (art. 20), usunięcie — prawo do bycia
                zapomnianym (art. 17). Dane zdrowotne to szczególna kategoria danych osobowych (art. 9),
                przetwarzana wyłącznie na podstawie Twojej wyraźnej zgody.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Pill tone="neutral">Szyfrowanie</Pill>
              <span>
                Transmisja: TLS 1.3. Przechowywanie w bazie: szyfrowanie AES-256 po stronie usługi.
                Dostęp do wierszy ogranicza polityka RLS — Twoje dane widzi wyłącznie Twoje konto.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Pill tone="neutral">AI</Pill>
              <span>
                Do modelu językowego trafiają wyłącznie zagregowane liczby i wnioski — bez imienia, adresu
                e-mail, identyfikatorów urządzeń i bez surowych szeregów czasowych.
              </span>
            </p>
          </div>
        </GlassCard>

        <Disclaimer text="Zatrzymać Starość to aplikacja wspierająca zdrowy styl życia. Nie jest wyrobem medycznym w rozumieniu rozporządzenia MDR (UE) 2017/745, nie służy do diagnozowania, zapobiegania, monitorowania ani leczenia chorób." />
      </div>
    </LongevityShell>
  );
};

export default Settings;
