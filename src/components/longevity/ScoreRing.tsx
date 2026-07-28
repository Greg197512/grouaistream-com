/**
 * Pierścień wyniku — centralny element wizualny dashboardu.
 *
 * Rysowany w SVG, animowany wyłącznie przez `stroke-dashoffset` i `opacity`,
 * więc przejście jest realizowane przez kompozytor i nie powoduje przeliczeń
 * układu strony. Gradient jest funkcją wartości: niski wynik przechodzi
 * w czerwień, wysoki w turkus lub złoto.
 */

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RingTone = "gold" | "teal" | "auto";

const stopsFor = (value: number, tone: RingTone): [string, string] => {
  if (tone === "gold") return ["#B8974F", "#F6DCA6"];
  if (tone === "teal") return ["#0E7C6F", "#7FE7DA"];
  if (value >= 75) return ["#0E7C6F", "#7FE7DA"];
  if (value >= 55) return ["#B8974F", "#F6DCA6"];
  if (value >= 40) return ["#B8974F", "#F0B45E"];
  return ["#8A3B45", "#F2707A"];
};

export const ScoreRing = ({
  value,
  max = 100,
  size = 180,
  thickness = 10,
  tone = "auto",
  label,
  caption,
  children,
  className,
  /** Znacznik na obwodzie, np. wartość bazowa użytkownika. */
  marker,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  tone?: RingTone;
  label?: string;
  caption?: string;
  children?: ReactNode;
  className?: string;
  marker?: number;
}) => {
  const clamped = Math.max(0, Math.min(max, value));
  const ratio = max === 0 ? 0 : clamped / max;

  // Animacja od zera przy pierwszym renderze — pierścień „nabiera” wartości.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setProgress(ratio));
    return () => cancelAnimationFrame(frame);
  }, [ratio]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  // Pierścień otwarty u dołu (270° zamiast pełnego koła) — zostawia miejsce
  // na podpis i czyni odczyt wartości łatwiejszym niż zamknięte koło.
  const sweep = 0.75;
  const arc = circumference * sweep;
  const [from, to] = stopsFor(clamped, tone);
  const gradientId = `ring-${Math.round(clamped)}-${from.slice(1)}-${size}`;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[225deg]">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={arc * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        {marker !== undefined && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={thickness + 4}
            strokeLinecap="butt"
            strokeDasharray={`2 ${circumference}`}
            strokeDashoffset={-arc * Math.max(0, Math.min(1, marker / max))}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <>
            <span className="font-display text-4xl font-semibold tabular-nums tracking-tight text-longevity-ink">
              {Math.round(clamped)}
            </span>
            {label && <span className="mt-0.5 text-xs font-medium text-longevity-muted">{label}</span>}
            {caption && <span className="mt-1 text-[11px] text-longevity-muted/70">{caption}</span>}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Kafelek metryki — używany w siatce dashboardu.
 * Pasek u dołu jest zawsze widoczny, żeby wartość dało się porównać wzrokiem
 * bez czytania liczby.
 */
export const MetricTile = ({
  label,
  value,
  unit,
  ratio,
  tone = "teal",
  hint,
  icon,
  onClick,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  /** 0–1 do paska postępu. */
  ratio: number;
  tone?: "teal" | "gold" | "good" | "warn" | "danger";
  hint?: string;
  icon?: string;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={cn(
      "group relative overflow-hidden rounded-2xl border border-longevity-line bg-white/[0.03] p-4 text-left backdrop-blur-xl",
      "shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]",
      onClick &&
        "transition-transform duration-300 ease-out will-change-transform hover:-translate-y-0.5 hover:border-white/15",
      !onClick && "cursor-default",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium uppercase tracking-wider text-longevity-muted">{label}</p>
      {icon && (
        <span className="material-icons-outlined text-[16px] leading-none text-longevity-muted/60" aria-hidden>
          {icon}
        </span>
      )}
    </div>

    <p className="mt-2 flex items-baseline gap-1 font-display text-2xl font-semibold tabular-nums text-longevity-ink">
      {value}
      {unit && <span className="text-sm font-normal text-longevity-muted">{unit}</span>}
    </p>

    {hint && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-longevity-muted/80">{hint}</p>}

    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "teal" && "bg-gradient-to-r from-longevity-teal-deep to-longevity-teal",
          tone === "gold" && "bg-gradient-to-r from-longevity-gold-deep to-longevity-gold-soft",
          tone === "good" && "bg-longevity-good",
          tone === "warn" && "bg-longevity-warn",
          tone === "danger" && "bg-longevity-danger",
        )}
        style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
      />
    </div>
  </button>
);

/**
 * Rozkład udziałów składników wyniku — odpowiedź na pytanie
 * „dlaczego mam akurat tyle punktów”.
 */
export const DriverBars = ({
  drivers,
  limit = 6,
}: {
  drivers: Array<{ key: string; label: string; contribution: number; normalized: number }>;
  limit?: number;
}) => (
  <div className="space-y-2.5">
    {drivers.slice(0, limit).map((driver) => (
      <div key={driver.key}>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="truncate text-xs text-longevity-muted">{driver.label}</span>
          <span className="shrink-0 text-xs font-medium tabular-nums text-longevity-ink">
            {driver.contribution > 0 ? "+" : ""}
            {driver.contribution.toFixed(1)}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              driver.normalized >= 0.7
                ? "bg-longevity-teal"
                : driver.normalized >= 0.45
                  ? "bg-longevity-gold"
                  : "bg-longevity-danger",
            )}
            style={{ width: `${Math.max(3, driver.normalized * 100)}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);
