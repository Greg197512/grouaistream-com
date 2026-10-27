import { useRef } from "react";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  color?: string;
  defaultValue?: number;
  onChange: (v: number) => void;
};

const ARC = 270; // zakres obrotu gałki (stopnie)

/** Gałka obrotowa jak we wzmacniaczu: przeciągnij w górę/dół, kółko myszy, strzałki; dwuklik = wartość domyślna. */
export function Knob({ label, value, min, max, step = 1, unit = "", color = "#FF9500", defaultValue, onChange }: Props) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const frac = (value - min) / (max - min || 1);
  const angle = -ARC / 2 + frac * ARC;
  const r = 20, cx = 26, cy = 26;
  const polar = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = polar(from), [x2, y2] = polar(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const zero = min < 0 && max > 0 ? -ARC / 2 + ((0 - min) / (max - min)) * ARC : -ARC / 2;
  const shown = Number.isInteger(step) ? Math.round(value) : value.toFixed(1);

  return (
    <div className="flex w-[64px] flex-col items-center gap-0.5 select-none">
      <svg
        width={52} height={52} viewBox="0 0 52 52" role="slider" tabIndex={0}
        aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        className="cursor-ns-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]"
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { y: e.clientY, v: value }; }}
        onPointerMove={(e) => { if (drag.current) onChange(clamp(drag.current.v + ((drag.current.y - e.clientY) / 140) * (max - min))); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => onChange(clamp(value + (e.deltaY < 0 ? 1 : -1) * Math.max(step, (max - min) / 50)))}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); onChange(clamp(value + Math.max(step, (max - min) / 50))); }
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); onChange(clamp(value - Math.max(step, (max - min) / 50))); }
        }}
      >
        <path d={arc(-ARC / 2, ARC / 2)} stroke="rgba(255,255,255,0.1)" strokeWidth={4} fill="none" strokeLinecap="round" />
        {Math.abs(angle - zero) > 0.5 && (
          <path d={arc(Math.min(zero, angle), Math.max(zero, angle))} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        )}
        <circle cx={cx} cy={cy} r={14} fill="url(#knobGrad)" stroke="rgba(0,0,0,0.6)" />
        <defs>
          <radialGradient id="knobGrad" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#4a4a5c" />
            <stop offset="100%" stopColor="#15151f" />
          </radialGradient>
        </defs>
        <line x1={cx} y1={cy} x2={cx} y2={cy - 11} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${angle} ${cx} ${cy})`} />
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-none">{label}</span>
      <span className="text-[10px] tabular-nums text-gray-500 leading-none">{shown}{unit}</span>
    </div>
  );
}
