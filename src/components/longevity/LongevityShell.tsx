/**
 * Powłoka aplikacji „Zatrzymać Starość”.
 *
 * Układ responsywny bez przełączania komponentów: na desktopie stała szyna
 * nawigacji po lewej, na telefonie dolny pasek z pięcioma najczęstszymi
 * ekranami i szufladą „Więcej”. Jeden zestaw tras, jeden nagłówek.
 */

import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AuroraBackground, Pill } from "./primitives";
import { useLongevity } from "@/contexts/LongevityContext";

export const LONGEVITY_BASE = "/zatrzymac-starosc";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Czy pozycja trafia do dolnego paska na telefonie. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "", label: "Pulpit", icon: "dashboard", primary: true },
  { to: "/sen", label: "Sen", icon: "bedtime", primary: true },
  { to: "/stres", label: "Stres", icon: "monitor_heart" },
  { to: "/uklad-nerwowy", label: "Układ nerwowy", icon: "psychology" },
  { to: "/oddech", label: "Oddech", icon: "air", primary: true },
  { to: "/medytacje", label: "Medytacje", icon: "self_improvement" },
  { to: "/coach", label: "AI Coach", icon: "forum", primary: true },
  { to: "/wiek", label: "Wiek biologiczny", icon: "hourglass_top" },
  { to: "/dieta", label: "Dieta", icon: "restaurant" },
  { to: "/aktywnosc", label: "Aktywność", icon: "directions_run" },
  { to: "/trendy", label: "Trendy", icon: "insights" },
  { to: "/misje", label: "Misje i poziomy", icon: "military_tech", primary: true },
  { to: "/dziennik", label: "Dziennik dnia", icon: "edit_note" },
  { to: "/urzadzenia", label: "Urządzenia", icon: "watch" },
  { to: "/ustawienia", label: "Ustawienia", icon: "settings" },
];

const PRIMARY_ITEMS = NAV_ITEMS.filter((item) => item.primary);

const isActive = (pathname: string, to: string): boolean => {
  const target = `${LONGEVITY_BASE}${to}`;
  if (to === "") return pathname === LONGEVITY_BASE || pathname === `${LONGEVITY_BASE}/`;
  return pathname.startsWith(target);
};

const Brand = () => (
  <Link to={LONGEVITY_BASE} className="group flex items-center gap-3">
    <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-longevity-gold-deep via-longevity-gold to-longevity-gold-soft">
      <span className="material-icons-outlined text-[18px] leading-none text-black" aria-hidden>
        hourglass_empty
      </span>
    </span>
    <span className="min-w-0">
      <span className="block truncate font-display text-sm font-semibold leading-tight text-longevity-ink">
        Zatrzymać Starość
      </span>
      <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-longevity-muted">Stop Aging AI</span>
    </span>
  </Link>
);

const SyncIndicator = () => {
  const { syncStatus, demoMode } = useLongevity();
  if (demoMode) return <Pill tone="gold">Tryb demonstracyjny</Pill>;
  if (syncStatus === "syncing") return <Pill tone="neutral">Synchronizacja…</Pill>;
  if (syncStatus === "synced") return <Pill tone="good">Zsynchronizowano</Pill>;
  if (syncStatus === "error") return <Pill tone="danger">Błąd synchronizacji</Pill>;
  return <Pill tone="neutral">Dane lokalne</Pill>;
};

export const LongevityShell = ({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { analysis, demoMode } = useLongevity();

  return (
    <div className="dark relative min-h-screen bg-longevity-void text-longevity-ink">
      <AuroraBackground />

      <div className="relative flex min-h-screen">
        {/* Szyna nawigacji — desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-longevity-line bg-black/30 backdrop-blur-2xl lg:flex">
          <div className="px-5 py-6">
            <Brand />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={`${LONGEVITY_BASE}${item.to}`}
                  className={cn(
                    "group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200",
                    active
                      ? "bg-white/[0.07] text-longevity-ink"
                      : "text-longevity-muted hover:bg-white/[0.04] hover:text-longevity-ink",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-longevity-gold" />
                  )}
                  <span
                    className={cn(
                      "material-icons-outlined text-[19px] leading-none",
                      active ? "text-longevity-gold" : "text-longevity-muted group-hover:text-longevity-ink",
                    )}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-longevity-line px-5 py-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-longevity-muted">Poziom {analysis.gamification.level}</span>
              <span className="font-medium tabular-nums text-longevity-gold">
                {analysis.gamification.xp.toLocaleString("pl-PL")} XP
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-longevity-gold-deep to-longevity-gold-soft transition-[width] duration-700"
                style={{
                  width: `${(analysis.gamification.xpIntoLevel / analysis.gamification.xpForNextLevel) * 100}%`,
                }}
              />
            </div>
            <Link
              to="/"
              className="mt-4 flex items-center gap-1.5 text-[11px] text-longevity-muted/70 transition-colors hover:text-longevity-muted"
            >
              <span className="material-icons-outlined text-[13px] leading-none" aria-hidden>
                arrow_back
              </span>
              Wróć do Grouaistream
            </Link>
          </div>
        </aside>

        {/* Treść */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-longevity-line bg-black/40 backdrop-blur-2xl">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="lg:hidden">
                <Brand />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <SyncIndicator />
                <Link
                  to={`${LONGEVITY_BASE}/dziennik`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-longevity-line bg-white/[0.04] text-longevity-muted transition-colors hover:text-longevity-ink"
                  aria-label="Dziennik dnia"
                >
                  <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
                    edit_note
                  </span>
                </Link>
              </div>
            </div>

            <div className="px-4 pb-4 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-longevity-ink sm:text-3xl">
                    {title}
                  </h1>
                  {subtitle && <p className="mt-1 text-sm text-longevity-muted">{subtitle}</p>}
                </div>
                {action}
              </div>
            </div>
          </header>

          {demoMode && (
            <div className="border-b border-longevity-gold/20 bg-longevity-gold/[0.07] px-4 py-2 text-center text-xs text-longevity-gold-soft sm:px-6 lg:px-8">
              Widzisz dane poglądowe. Podłącz urządzenie lub wypełnij dziennik, aby zobaczyć własne wyniki.
            </div>
          )}

          <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
            <div className="mx-auto w-full max-w-6xl animate-rise-in">{children}</div>
          </main>
        </div>
      </div>

      {/* Dolny pasek — telefon */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-longevity-line bg-black/70 backdrop-blur-2xl lg:hidden">
        <div className="grid grid-cols-6">
          {PRIMARY_ITEMS.map((item) => {
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={`${LONGEVITY_BASE}${item.to}`}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
                  active ? "text-longevity-gold" : "text-longevity-muted",
                )}
              >
                <span className="material-icons-outlined text-[20px] leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span className="truncate px-0.5">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-longevity-muted"
          >
            <span className="material-icons-outlined text-[20px] leading-none" aria-hidden>
              more_horiz
            </span>
            <span>Więcej</span>
          </button>
        </div>
      </nav>

      {/* Szuflada „Więcej" */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Zamknij menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl border-t border-longevity-line bg-longevity-bg/95 p-4 pb-8 backdrop-blur-2xl animate-rise-in">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.filter((item) => !item.primary).map((item) => (
                <Link
                  key={item.to}
                  to={`${LONGEVITY_BASE}${item.to}`}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-longevity-line bg-white/[0.03] px-3 py-3 text-sm text-longevity-ink"
                >
                  <span className="material-icons-outlined text-[18px] leading-none text-longevity-gold" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
            <Link
              to="/"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-longevity-line px-3 py-3 text-sm text-longevity-muted"
            >
              <span className="material-icons-outlined text-[16px] leading-none" aria-hidden>
                arrow_back
              </span>
              Wróć do Grouaistream
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
