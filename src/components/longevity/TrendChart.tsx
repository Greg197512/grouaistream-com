/**
 * Wykresy trendów.
 *
 * Konwencja kolorystyczna jest stała w całym module: turkus = kierunek
 * korzystny, złoty = neutralny, czerwony = niekorzystny. Kierunek ustala
 * silnik (`TrendAnalysis.direction`), a nie komponent — dzięki temu wykres
 * tętna spoczynkowego (gdzie spadek jest dobry) koloruje się poprawnie
 * bez żadnych wyjątków w UI.
 */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { TrendAnalysis } from "@/lib/longevity";

const TONE = {
  improving: { stroke: "#2DD4BF", fill: "#2DD4BF" },
  stable: { stroke: "#E3C27E", fill: "#E3C27E" },
  declining: { stroke: "#F2707A", fill: "#F2707A" },
} as const;

const formatDayLabel = (iso: string): string => {
  const [, month, day] = iso.split("-");
  return `${day}.${month}`;
};

interface TrendChartProps {
  analysis: TrendAnalysis;
  unit?: string;
  height?: number;
  /** Linia odniesienia — np. cel snu albo baza HRV użytkownika. */
  reference?: { value: number; label: string };
  className?: string;
  /** Wygładzanie średnią kroczącą 7-dniową, gdy punktów jest dużo. */
  smooth?: boolean;
}

export const TrendChart = ({
  analysis,
  unit,
  height = 220,
  reference,
  className,
  smooth = true,
}: TrendChartProps) => {
  const tone = TONE[analysis.direction];

  const data = useMemo(() => {
    const points = analysis.points.map((p) => ({ date: p.date, value: p.value, avg: undefined as number | undefined }));
    if (!smooth || points.length < 10) return points;
    // Średnia krocząca 7-dniowa — dane dobowe z zegarka mają zbyt duży rozrzut,
    // żeby surowa linia pokazywała cokolwiek na oknie 90 czy 365 dni.
    return points.map((point, index) => {
      const window = points.slice(Math.max(0, index - 6), index + 1);
      const avg = window.reduce((acc, p) => acc + p.value, 0) / window.length;
      return { ...point, avg: Math.round(avg * 10) / 10 };
    });
  }, [analysis.points, smooth]);

  if (data.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-longevity-line bg-white/[0.02] text-sm text-longevity-muted",
          className,
        )}
        style={{ height }}
      >
        Za mało pomiarów, aby narysować trend — potrzebne są co najmniej 2 dni z danymi.
      </div>
    );
  }

  const gradientId = `trend-${analysis.metric}-${analysis.window}`;

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone.fill} stopOpacity={0.28} />
              <stop offset="100%" stopColor={tone.fill} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayLabel}
            tick={{ fill: "#8894A6", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: "#8894A6", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={46}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(12,17,24,0.94)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              backdropFilter: "blur(12px)",
              fontSize: 12,
              color: "#F4F7FA",
            }}
            labelFormatter={(label: string) => label}
            formatter={(value: number, name: string) => [
              `${value}${unit ? ` ${unit}` : ""}`,
              name === "avg" ? "Średnia 7 dni" : "Pomiar",
            ]}
          />

          {reference && (
            <ReferenceLine
              y={reference.value}
              stroke="rgba(255,255,255,0.25)"
              strokeDasharray="4 4"
              label={{ value: reference.label, position: "insideTopRight", fill: "#8894A6", fontSize: 10 }}
            />
          )}

          <Area
            type="monotone"
            dataKey="value"
            stroke={tone.stroke}
            strokeWidth={data.length > 60 ? 1 : 1.8}
            strokeOpacity={data.some((d) => d.avg !== undefined) ? 0.35 : 1}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: tone.stroke, stroke: "#04060A", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={900}
          />

          {data.some((d) => d.avg !== undefined) && (
            <Line
              type="monotone"
              dataKey="avg"
              stroke={tone.stroke}
              strokeWidth={2.4}
              dot={false}
              isAnimationActive
              animationDuration={900}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Miniaturowy wykres do kafelków — bez osi, tooltipów i siatki. */
export const Sparkline = ({
  points,
  tone = "#2DD4BF",
  height = 36,
}: {
  points: Array<{ date: string; value: number }>;
  tone?: string;
  height?: number;
}) => {
  if (points.length < 2) return <div style={{ height }} />;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 100;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / span) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height, width: "100%" }} aria-hidden>
      <path d={path} fill="none" stroke={tone} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
