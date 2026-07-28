/**
 * Prymitywy wizualne modułu „Zatrzymać Starość”.
 *
 * Jeden zestaw elementów dla całej aplikacji: szklane karty, tytuły sekcji,
 * plakietki, paski postępu i obowiązkowe zastrzeżenie. Ekrany składają się
 * wyłącznie z tych klocków, więc spójność wynika z konstrukcji, a nie
 * z dyscypliny przy pisaniu kolejnych widoków.
 */

import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/longevity";

/** Tło z powolną aurorą — animowane wyłącznie transformem (GPU, 60 FPS). */
export const AuroraBackground = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-longevity-void" />
    <div className="absolute -left-1/4 -top-1/3 h-[70vh] w-[70vw] rounded-full bg-longevity-teal/10 blur-[120px] animate-aurora-drift will-change-transform" />
    <div
      className="absolute -right-1/4 top-1/4 h-[60vh] w-[60vw] rounded-full bg-longevity-gold/10 blur-[130px] animate-aurora-drift will-change-transform"
      style={{ animationDelay: "-9s" }}
    />
    <div
      className="absolute bottom-0 left-1/4 h-[50vh] w-[50vw] rounded-full bg-longevity-teal-deep/10 blur-[140px] animate-aurora-drift will-change-transform"
      style={{ animationDelay: "-17s" }}
    />
    {/* Delikatny raster — bez niego duże gradienty pasmują na tanich panelach. */}
    <div
      className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
      }}
    />
  </div>
);

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Podświetlenie krawędzi kolorem akcentu. */
  accent?: "gold" | "teal" | "none";
  /** Delikatne uniesienie przy najechaniu — tylko dla kart klikalnych. */
  interactive?: boolean;
  onClick?: () => void;
  as?: "div" | "button" | "article";
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className, accent = "none", interactive = false, onClick, as = "div" }, ref) => {
    const Component = as as "div";
    return (
      <Component
        ref={ref}
        onClick={onClick}
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-white/[0.03] backdrop-blur-xl",
          "border-longevity-line shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_50px_-30px_rgba(0,0,0,0.9)]",
          accent === "gold" && "border-longevity-gold/25",
          accent === "teal" && "border-longevity-teal/25",
          interactive &&
            "cursor-pointer transition-transform duration-300 ease-out will-change-transform hover:-translate-y-0.5 hover:border-white/15 active:translate-y-0",
          className,
        )}
      >
        {children}
      </Component>
    );
  },
);
GlassCard.displayName = "GlassCard";

export const SectionTitle = ({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
    <div className="min-w-0">
      {eyebrow && (
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-longevity-gold/80">{eyebrow}</p>
      )}
      <h2 className="font-display text-xl font-semibold tracking-tight text-longevity-ink sm:text-2xl">{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-longevity-muted">{description}</p>}
    </div>
    {action}
  </div>
);

export const Pill = ({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "teal" | "good" | "warn" | "danger";
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
      tone === "neutral" && "border-white/10 bg-white/[0.04] text-longevity-muted",
      tone === "gold" && "border-longevity-gold/30 bg-longevity-gold/10 text-longevity-gold-soft",
      tone === "teal" && "border-longevity-teal/30 bg-longevity-teal/10 text-longevity-teal-soft",
      tone === "good" && "border-longevity-good/30 bg-longevity-good/10 text-longevity-good",
      tone === "warn" && "border-longevity-warn/30 bg-longevity-warn/10 text-longevity-warn",
      tone === "danger" && "border-longevity-danger/30 bg-longevity-danger/10 text-longevity-danger",
      className,
    )}
  >
    {children}
  </span>
);

const CONFIDENCE_TONE: Record<Confidence, "good" | "warn" | "danger"> = {
  high: "good",
  medium: "warn",
  low: "danger",
};

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: "Dane kompletne",
  medium: "Dane częściowe",
  low: "Mało danych",
};

/**
 * Znacznik pewności. Pokazujemy go zawsze, bo wynik policzony z trzech pól
 * i wynik z dwudziestu to nie jest ta sama informacja — użytkownik ma prawo
 * wiedzieć, na czym stoi liczba, którą właśnie zobaczył.
 */
export const ConfidenceBadge = ({ confidence, className }: { confidence: Confidence; className?: string }) => (
  <Pill tone={CONFIDENCE_TONE[confidence]} className={className}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {CONFIDENCE_TEXT[confidence]}
  </Pill>
);

export const ProgressBar = ({
  value,
  tone = "teal",
  className,
  height = "h-1.5",
}: {
  /** 0–1. */
  value: number;
  tone?: "teal" | "gold" | "good" | "warn" | "danger";
  className?: string;
  height?: string;
}) => (
  <div className={cn("w-full overflow-hidden rounded-full bg-white/[0.06]", height, className)}>
    <div
      className={cn(
        "h-full rounded-full transition-[width] duration-700 ease-out",
        tone === "teal" && "bg-gradient-to-r from-longevity-teal-deep to-longevity-teal",
        tone === "gold" && "bg-gradient-to-r from-longevity-gold-deep to-longevity-gold-soft",
        tone === "good" && "bg-longevity-good",
        tone === "warn" && "bg-longevity-warn",
        tone === "danger" && "bg-longevity-danger",
      )}
      style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
    />
  </div>
);

export const StatRow = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "good" | "warn" | "danger";
}) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-longevity-line/60 py-2.5 last:border-0">
    <div className="min-w-0">
      <p className="truncate text-sm text-longevity-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-longevity-muted/70">{hint}</p>}
    </div>
    <p
      className={cn(
        "shrink-0 font-display text-sm font-semibold tabular-nums text-longevity-ink",
        tone === "good" && "text-longevity-good",
        tone === "warn" && "text-longevity-warn",
        tone === "danger" && "text-longevity-danger",
      )}
    >
      {value}
    </p>
  </div>
);

/**
 * Zastrzeżenie prawne i produktowe. Pojawia się na każdym ekranie, który
 * pokazuje wskaźnik zdrowotny — to wymóg, nie ozdobnik.
 */
export const Disclaimer = ({ text, className }: { text?: string; className?: string }) => (
  <p
    className={cn(
      "flex items-start gap-2 rounded-xl border border-longevity-line bg-white/[0.02] p-3 text-xs leading-relaxed text-longevity-muted",
      className,
    )}
  >
    <span className="material-icons-outlined mt-px text-[15px] leading-none text-longevity-gold/70" aria-hidden>
      info
    </span>
    <span>
      {text ??
        "To wskazówka oparta na Twoich danych, a nie diagnoza medyczna. Aplikacja nie zastępuje konsultacji z lekarzem ani badań."}
    </span>
  </p>
);

/** Pusty stan — zawsze z konkretnym następnym krokiem, nigdy z samym „brak danych”. */
export const EmptyState = ({
  icon = "insights",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <span className="material-icons-outlined text-3xl text-longevity-gold/60" aria-hidden>
      {icon}
    </span>
    <h3 className="font-display text-base font-semibold text-longevity-ink">{title}</h3>
    <p className="max-w-sm text-sm leading-relaxed text-longevity-muted">{description}</p>
    {action}
  </div>
);

/** Przycisk w stylu modułu — złoty (główny) lub szklany (drugorzędny). */
export const LongevityButton = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "teal";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-longevity-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-longevity-void",
      "disabled:cursor-not-allowed disabled:opacity-40",
      size === "sm" && "px-3.5 py-1.5 text-xs",
      size === "md" && "px-5 py-2.5 text-sm",
      size === "lg" && "px-7 py-3.5 text-base",
      variant === "primary" &&
        "bg-gradient-to-r from-longevity-gold-deep via-longevity-gold to-longevity-gold-soft text-black shadow-[0_10px_30px_-12px_rgba(227,194,126,0.7)] hover:brightness-110 active:scale-[0.98]",
      variant === "teal" &&
        "bg-gradient-to-r from-longevity-teal-deep to-longevity-teal text-black shadow-[0_10px_30px_-12px_rgba(45,212,191,0.6)] hover:brightness-110 active:scale-[0.98]",
      variant === "ghost" &&
        "border border-longevity-line bg-white/[0.04] text-longevity-ink backdrop-blur hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.98]",
      className,
    )}
  >
    {children}
  </button>
);
