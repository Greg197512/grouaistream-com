/**
 * Moduł URZĄDZENIA — integracje z ekosystemami zdrowotnymi.
 *
 * Ekran rozwiązuje realny problem użytkownika: „mam Amazfita, gdzie go
 * podłączyć?”. Zamiast dwudziestu kafelków marek pokazujemy KANAŁY, którymi
 * dane faktycznie płyną, i mapę marka → kanał. Garmin jest pierwszy, bo jako
 * jedyny dostarcza Body Battery, Training Readiness i HRV Status.
 */

import { useMemo, useState } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import {
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import { DEVICE_INTEGRATIONS, SOURCE_TRUST, SUPPORTED_BRANDS, type DataSource } from "@/lib/longevity";
// `storage` importujemy bezpośrednio, a nie przez barrel — dzięki temu testy
// silnika nie ciągną za sobą klienta Supabase i działają bez zmiennych środowiskowych.
import { importBundle } from "@/lib/longevity/storage";
import { cn } from "@/lib/utils";

const TRANSPORT_LABEL = {
  oauth_cloud: "Połączenie z chmurą producenta (OAuth)",
  native_sdk: "Aplikacja mobilna — dane z systemu",
  webhook_push: "Push z webhooka",
  file_import: "Wpis ręczny lub import pliku",
} as const;

const METRIC_LABEL: Record<string, string> = {
  heartRate: "Tętno",
  hrv: "HRV",
  hrvStatus: "HRV Status",
  spo2: "SpO₂",
  ecg: "EKG",
  respiration: "Oddech",
  bodyBattery: "Body Battery",
  trainingReadiness: "Training Readiness",
  stressScore: "Poziom stresu",
  recoveryTime: "Czas regeneracji",
  sleepStages: "Fazy snu",
  sleepScore: "Sleep Score",
  vo2Max: "VO₂max",
  enduranceScore: "Endurance Score",
  hillScore: "Hill Score",
  steps: "Kroki",
  calories: "Kalorie",
  distance: "Dystans",
  workouts: "Treningi",
  skinTemp: "Temperatura skóry",
  temperature: "Temperatura ciała",
  weight: "Masa ciała",
  bodyFat: "Skład ciała",
  bloodPressure: "Ciśnienie krwi",
  sedentaryTime: "Czas siedzenia",
  naps: "Drzemki",
  readiness: "Gotowość",
  recovery: "Regeneracja",
  strain: "Obciążenie dnia",
  nightlyRecharge: "Nocna regeneracja",
  hydration: "Nawodnienie",
  nutrition: "Dieta",
  standHours: "Godziny w ruchu",
  mindfulMinutes: "Minuty uważności",
  cycleTracking: "Cykl",
  bodyComposition: "Skład ciała",
  elevation: "Przewyższenie",
  stress: "Stres",
  sleep: "Sen",
  mood: "Nastrój",
  alcohol: "Alkohol",
  nicotine: "Nikotyna",
  meditation: "Medytacja",
};

const Devices = () => {
  const { records, importRecords, syncNow, syncStatus, syncMessage } = useLongevity();
  const [expanded, setExpanded] = useState<DataSource | null>("garmin");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  /** Źródła, z których realnie napłynęły dane — do oznaczenia „połączone”. */
  const activeSources = useMemo(() => {
    const set = new Set<DataSource>();
    for (const record of records.slice(-30)) {
      record.sources?.forEach((s) => set.add(s));
      [record.sleep?.source, record.cardio?.source, record.activity?.source, record.body?.source, record.vendor?.source]
        .filter((s): s is DataSource => Boolean(s))
        .forEach((s) => set.add(s));
    }
    return set;
  }, [records]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const bundle = importBundle(text);
    if (!bundle) {
      setImportMessage("Nie rozpoznano formatu pliku. Oczekiwany jest eksport z tej aplikacji (JSON, wersja 1).");
      return;
    }
    importRecords(bundle);
    setImportMessage(`Zaimportowano ${bundle.records.length} dni z pliku ${file.name}.`);
  };

  return (
    <LongevityShell
      title="Urządzenia"
      subtitle="Im więcej źródeł, tym wyższa pewność wyników — ale aplikacja działa też bez żadnego."
      action={
        <LongevityButton size="sm" variant="ghost" onClick={() => void syncNow()}>
          <span className="material-icons-outlined text-[16px] leading-none" aria-hidden>
            sync
          </span>
          {syncStatus === "syncing" ? "Synchronizacja…" : "Synchronizuj teraz"}
        </LongevityButton>
      }
    >
      <div className="space-y-6">
        {syncMessage && (
          <GlassCard className="flex items-start gap-3 p-4">
            <span className="material-icons-outlined mt-px text-[18px] leading-none text-longevity-warn" aria-hidden>
              info
            </span>
            <p className="text-sm leading-relaxed text-longevity-muted">{syncMessage}</p>
          </GlassCard>
        )}

        {/* ── Kanały integracji ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {DEVICE_INTEGRATIONS.map((integration) => {
            const connected = activeSources.has(integration.id);
            const open = expanded === integration.id;
            const isPriority = integration.priority === 1;

            return (
              <GlassCard
                key={integration.id}
                accent={isPriority ? "gold" : "none"}
                className={cn("overflow-hidden", open && "border-white/15")}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : integration.id)}
                  className="flex w-full items-center gap-4 p-4 text-left"
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      isPriority
                        ? "bg-gradient-to-br from-longevity-gold-deep to-longevity-gold-soft"
                        : connected
                          ? "bg-longevity-teal/15"
                          : "bg-white/[0.05]",
                    )}
                  >
                    <span
                      className={cn(
                        "material-icons-outlined text-[20px] leading-none",
                        isPriority ? "text-black" : connected ? "text-longevity-teal" : "text-longevity-muted",
                      )}
                      aria-hidden
                    >
                      {integration.transport === "file_import" ? "edit_note" : "watch"}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-semibold text-longevity-ink">{integration.name}</p>
                      {isPriority && <Pill tone="gold">Priorytet</Pill>}
                      {connected && <Pill tone="good">Dane obecne</Pill>}
                      {integration.push && <Pill tone="teal">Push</Pill>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-longevity-muted">
                      {TRANSPORT_LABEL[integration.transport]} · opóźnienie ok. {integration.latencyMin} min
                    </p>
                  </div>

                  <span
                    className={cn(
                      "material-icons-outlined shrink-0 text-[20px] leading-none text-longevity-muted transition-transform duration-300",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  >
                    expand_more
                  </span>
                </button>

                {open && (
                  <div className="border-t border-longevity-line px-4 pb-4 pt-4">
                    <p className="text-sm leading-relaxed text-longevity-muted">{integration.notes}</p>

                    <p className="mt-4 text-[11px] uppercase tracking-wider text-longevity-muted">
                      Metryki pobierane tym kanałem ({integration.metrics.length})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {integration.metrics.map((metric) => (
                        <Pill key={metric} tone="neutral">
                          {METRIC_LABEL[metric] ?? metric}
                        </Pill>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <LongevityButton
                        size="sm"
                        variant={isPriority ? "primary" : "ghost"}
                        disabled={integration.transport === "file_import"}
                      >
                        {integration.transport === "native_sdk"
                          ? "Dostępne w aplikacji mobilnej"
                          : integration.transport === "file_import"
                            ? "Zawsze aktywne"
                            : "Połącz konto"}
                      </LongevityButton>
                      <span className="text-[11px] text-longevity-muted/70">
                        Zaufanie źródła przy scalaniu danych: {SOURCE_TRUST[integration.id]}/100
                      </span>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>

        {/* ── Mapa marek ────────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Mam konkretny zegarek"
            title="Którym kanałem podłączyć swoje urządzenie"
            description="Większość marek nie ma własnego publicznego API — ich dane docierają przez Health Connect na Androidzie albo Apple Health na iOS. To nie jest obejście, tylko oficjalna droga."
          />

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {SUPPORTED_BRANDS.map((brand) => (
              <button
                key={brand.brand}
                type="button"
                onClick={() => setExpanded(brand.via)}
                className="flex items-center justify-between gap-3 rounded-xl border border-longevity-line bg-white/[0.02] px-3.5 py-3 text-left transition-colors hover:border-white/15"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-longevity-ink">{brand.brand}</p>
                  <p className="truncate text-[11px] text-longevity-muted">{brand.note}</p>
                </div>
                <span className="material-icons-outlined shrink-0 text-[16px] leading-none text-longevity-muted" aria-hidden>
                  arrow_forward
                </span>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ── Scalanie danych ───────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Wiele urządzeń naraz"
            title="Jak rozstrzygamy konflikty danych"
            description="Gdy zegarek i telefon raportują różną liczbę kroków, wygrywa źródło o wyższym zaufaniu. Urządzenie noszone całą dobę na nadgarstku lub palcu ma pierwszeństwo przed telefonem, a ten przed wpisem ręcznym — z wyjątkiem pól, które wprowadzasz świadomie (dieta, nastrój, używki)."
          />

          <div className="mt-4 space-y-2">
            {Object.entries(SOURCE_TRUST)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([source, trust]) => {
                const integration = DEVICE_INTEGRATIONS.find((d) => d.id === source);
                return (
                  <div key={source} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs text-longevity-muted">
                      {integration?.name ?? source}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-longevity-teal-deep to-longevity-teal"
                        style={{ width: `${trust}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-longevity-ink">{trust}</span>
                  </div>
                );
              })}
          </div>
        </GlassCard>

        {/* ── Import pliku ──────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Import"
            title="Wczytaj dane z pliku"
            description="Obsługujemy eksport z tej aplikacji (JSON). Import scala dane po dacie — istniejące wpisy nie są nadpisywane, tylko uzupełniane."
          />

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-longevity-line bg-white/[0.02] p-5 transition-colors hover:border-white/20">
            <span className="material-icons-outlined text-[22px] leading-none text-longevity-gold" aria-hidden>
              upload_file
            </span>
            <div className="min-w-0">
              <p className="text-sm text-longevity-ink">Wybierz plik JSON</p>
              <p className="text-xs text-longevity-muted">Eksport znajdziesz w Ustawieniach → Twoje dane</p>
            </div>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>

          {importMessage && <p className="mt-3 text-sm text-longevity-good">{importMessage}</p>}
        </GlassCard>

        <Disclaimer text="Urządzenia konsumenckie nie są wyrobami medycznymi (poza funkcjami wyraźnie certyfikowanymi przez producenta, np. EKG w niektórych zegarkach). Ich pomiary mają ograniczoną dokładność i służą do śledzenia trendów stylu życia, nie do oceny stanu zdrowia." />
      </div>
    </LongevityShell>
  );
};

export default Devices;
