/**
 * Moduł UKŁAD NERWOWY — cztery stany na dwóch osiach.
 *
 * Mapa 2×2 (pobudzenie × rezerwa) jest tu głównym elementem, bo dopiero
 * ona wyjaśnia, dlaczego „zmęczony i pobudzony” to inny stan niż
 * „zmęczony i wygaszony” — i dlaczego wymagają odwrotnych interwencji.
 */

import { Link } from "react-router-dom";
import { LongevityShell, LONGEVITY_BASE } from "@/components/longevity/LongevityShell";
import { ScoreRing } from "@/components/longevity/ScoreRing";
import {
  ConfidenceBadge,
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  BREATHING_PROTOCOLS,
  NERVOUS_STATE_DESCRIPTION,
  NERVOUS_STATE_LABEL,
  recommendSessions,
  type NervousSystemState,
} from "@/lib/longevity";
import { cn } from "@/lib/utils";

/** Układ kwadrantów odpowiada osiom: poziomo pobudzenie, pionowo rezerwa. */
const QUADRANTS: Array<{
  state: NervousSystemState;
  position: string;
  axisLabel: string;
  icon: string;
}> = [
  { state: "recovery", position: "row-start-1 col-start-1", axisLabel: "Niskie pobudzenie · wysoka rezerwa", icon: "spa" },
  { state: "fight", position: "row-start-1 col-start-2", axisLabel: "Wysokie pobudzenie · rezerwa obecna", icon: "bolt" },
  { state: "freeze", position: "row-start-2 col-start-1", axisLabel: "Niskie pobudzenie · niska rezerwa", icon: "ac_unit" },
  { state: "overload", position: "row-start-2 col-start-2", axisLabel: "Wysokie pobudzenie · niska rezerwa", icon: "warning_amber" },
];

const STATE_ACTIONS: Record<NervousSystemState, { title: string; steps: string[]; avoid: string[] }> = {
  recovery: {
    title: "Wykorzystaj okno",
    steps: [
      "Zaplanuj najtrudniejsze zadanie dnia na najbliższe 3 godziny",
      "Trening jakościowy jest dziś uzasadniony",
      "Utrzymaj stałą porę snu — to ona zbudowała ten stan",
    ],
    avoid: ["Nadrabianie zaległości kosztem snu", "Skokowe zwiększanie objętości treningu"],
  },
  fight: {
    title: "Zejdź o stopień niżej",
    steps: [
      "Trzy westchnienia fizjologiczne — działa w minutę",
      "Krótki wysiłek jest w porządku, ale bez interwałów pod wieczór",
      "Wieczór zaplanuj wyciszająco: ciepły prysznic, przygaszone światło",
    ],
    avoid: ["Kofeina po godzinie 14", "Trudne rozmowy wieczorem", "Ekran w godzinie przed snem"],
  },
  overload: {
    title: "Priorytet: regeneracja",
    steps: [
      "Dzisiaj bez jednostki jakościowej — spacer 30–45 minut",
      "Sen o godzinę dłuższy niż zwykle",
      "10 minut oddechu rezonansowego (5,5 s wdech, 5,5 s wydech)",
      "Nawodnienie 2 litry rozłożone na dzień",
    ],
    avoid: ["Intensywny trening", "Alkohol", "Praca po godzinach"],
  },
  freeze: {
    title: "Delikatna aktywacja",
    steps: [
      "20 minut światła dziennego, najlepiej przed południem",
      "Oddech aktywujący: wdech 6 s, wydech 2 s przez 3 minuty",
      "Jedna mała, konkretna rzecz do zrobienia — nie lista",
      "Ruch o niskiej intensywności: spacer, rozciąganie",
    ],
    avoid: ["Intensywny trening „na siłę”", "Długie leżenie w ciemnym pokoju"],
  },
};

const NervousSystem = () => {
  const { analysis } = useLongevity();
  const { panel } = analysis;
  const current = panel.nervousSystem;
  const actions = STATE_ACTIONS[current.state];
  const sessions = recommendSessions(current.state, 3);
  const protocols = BREATHING_PROTOCOLS.filter((p) => current.suggestedProtocols.includes(p.id));

  return (
    <LongevityShell
      title="Układ nerwowy"
      subtitle="Cztery stany regulacji autonomicznej i interwencja dopasowana do każdego z nich."
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard accent="teal" className="flex flex-col items-center gap-4 p-6 lg:col-span-2">
            <ScoreRing
              value={current.balanceScore}
              tone={current.state === "recovery" ? "teal" : "gold"}
              size={190}
              label="Równowaga autonomiczna"
            />
            <div className="text-center">
              <p className="font-display text-xl font-semibold text-longevity-ink">
                {NERVOUS_STATE_LABEL[current.state]}
              </p>
              <ConfidenceBadge confidence={current.confidence} className="mt-2" />
            </div>
            <p className="text-center text-sm leading-relaxed text-longevity-muted">
              {NERVOUS_STATE_DESCRIPTION[current.state]}
            </p>
          </GlassCard>

          <GlassCard className="p-5 lg:col-span-3">
            <SectionTitle
              eyebrow="Mapa stanów"
              title="Dwie osie zamiast jednej skali"
              description="Poziomo: pobudzenie współczulne. Pionowo: rezerwa przywspółczulna. Podświetlone pole to Twój dzisiejszy stan."
            />

            <div className="mt-4 grid grid-cols-2 grid-rows-2 gap-2.5">
              {QUADRANTS.map((quadrant) => {
                const active = quadrant.state === current.state;
                return (
                  <div
                    key={quadrant.state}
                    className={cn(
                      quadrant.position,
                      "relative overflow-hidden rounded-xl border p-4 transition-all duration-500",
                      active
                        ? "border-longevity-gold/40 bg-longevity-gold/[0.08] shadow-[0_0_40px_-18px_rgba(227,194,126,0.8)]"
                        : "border-longevity-line bg-white/[0.02]",
                    )}
                  >
                    {active && (
                      <span className="absolute inset-0 animate-glow-pulse bg-gradient-to-br from-longevity-gold/10 to-transparent" />
                    )}
                    <span
                      className={cn(
                        "material-icons-outlined relative text-[20px] leading-none",
                        active ? "text-longevity-gold" : "text-longevity-muted/60",
                      )}
                      aria-hidden
                    >
                      {quadrant.icon}
                    </span>
                    <p
                      className={cn(
                        "relative mt-2 font-display text-sm font-semibold",
                        active ? "text-longevity-ink" : "text-longevity-muted",
                      )}
                    >
                      {NERVOUS_STATE_LABEL[quadrant.state]}
                    </p>
                    <p className="relative mt-1 text-[11px] leading-snug text-longevity-muted/70">
                      {quadrant.axisLabel}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-longevity-line bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-wider text-longevity-muted">Na czym opiera się ocena</p>
              <ul className="mt-2 space-y-1.5">
                {current.rationale.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm leading-relaxed text-longevity-ink">
                    <span className="material-icons-outlined mt-px text-[14px] leading-none text-longevity-teal" aria-hidden>
                      arrow_right
                    </span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard accent="gold" className="p-5">
            <SectionTitle eyebrow="Plan na dziś" title={actions.title} />
            <ul className="mt-4 space-y-2.5">
              {actions.steps.map((step) => (
                <li key={step} className="flex items-start gap-2.5 text-sm leading-relaxed text-longevity-ink">
                  <span className="material-icons-outlined mt-px text-[16px] leading-none text-longevity-gold" aria-hidden>
                    check_circle
                  </span>
                  {step}
                </li>
              ))}
            </ul>

            <p className="mt-5 text-[11px] uppercase tracking-wider text-longevity-muted">Czego dziś unikać</p>
            <ul className="mt-2 space-y-1.5">
              {actions.avoid.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-longevity-muted">
                  <span className="material-icons-outlined mt-px text-[16px] leading-none text-longevity-danger" aria-hidden>
                    do_not_disturb_on
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard className="p-5">
              <SectionTitle eyebrow="Ćwiczenia oddechowe" title="Dobrane do stanu" />
              <div className="mt-3 space-y-2.5">
                {protocols.map((protocol) => (
                  <Link key={protocol.id} to={`${LONGEVITY_BASE}/oddech?protokol=${protocol.id}`}>
                    <GlassCard interactive className="flex items-center gap-3 p-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-longevity-teal/15">
                        <span className="material-icons-outlined text-[17px] leading-none text-longevity-teal" aria-hidden>
                          air
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-longevity-ink">{protocol.name}</p>
                        <p className="truncate text-xs text-longevity-muted">
                          {protocol.subtitle} · {protocol.defaultMinutes} min
                        </p>
                      </div>
                      <span className="material-icons-outlined text-[18px] leading-none text-longevity-muted" aria-hidden>
                        chevron_right
                      </span>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle eyebrow="Sesje audio" title="Regulacja przez dźwięk" />
              <div className="mt-3 space-y-2.5">
                {sessions.map((session) => (
                  <Link key={session.id} to={`${LONGEVITY_BASE}/medytacje?sesja=${session.id}`}>
                    <GlassCard interactive className="flex items-center gap-3 p-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-longevity-gold/15">
                        <span className="material-icons-outlined text-[17px] leading-none text-longevity-gold" aria-hidden>
                          self_improvement
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-longevity-ink">{session.title}</p>
                        <p className="truncate text-xs text-longevity-muted">{session.minutes} min · {session.summary}</p>
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
              <Link to={`${LONGEVITY_BASE}/medytacje`} className="mt-3 inline-block">
                <LongevityButton variant="ghost" size="sm">
                  Cała biblioteka
                </LongevityButton>
              </Link>
            </GlassCard>
          </div>
        </div>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="Słownik" title="Co oznaczają poszczególne stany" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(Object.keys(NERVOUS_STATE_LABEL) as NervousSystemState[]).map((state) => (
              <div key={state} className="rounded-xl border border-longevity-line bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <p className="font-display text-sm font-semibold text-longevity-ink">
                    {NERVOUS_STATE_LABEL[state]}
                  </p>
                  {state === current.state && <Pill tone="gold">Dzisiaj</Pill>}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-longevity-muted">
                  {NERVOUS_STATE_DESCRIPTION[state]}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>

        <Disclaimer text="Ocena stanu układu nerwowego powstaje z danych z urządzeń (HRV, tętno, oddech, aktywność) i Twoich wpisów. To model interpretacyjny stylu życia, nie badanie neurologiczne ani diagnoza zaburzeń regulacji." />
      </div>
    </LongevityShell>
  );
};

export default NervousSystem;
