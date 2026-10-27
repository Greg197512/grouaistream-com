import { ENGINE_INFO, type Engine } from "@/lib/engineGenerate";

interface Props {
  value: Engine;
  onChange: (e: Engine) => void;
  disabled?: boolean;
  /** Ukryj MusicGen (gdy tryb z wokalem jest wymagany, np. teledysk/video) */
  vocalOnly?: boolean;
}

/** Wspólny wybór silnika AI — używany w każdym polu generowania w Studio. */
export function EngineSelector({ value, onChange, disabled, vocalOnly }: Props) {
  const engines: Engine[] = vocalOnly ? ["suno", "acestep"] : ["suno", "acestep", "musicgen"];
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Silnik AI">
      {engines.map((eng) => {
        const info = ENGINE_INFO[eng];
        const active = value === eng;
        return (
          <button
            key={eng}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !disabled && onChange(eng)}
            disabled={disabled}
            title={info.blurb}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-all disabled:opacity-50 ${
              active ? "bg-white/[0.06]" : "border-[#1E2A44] bg-[#0F1629] hover:border-white/25"
            }`}
            style={active ? { borderColor: info.color, boxShadow: `0 0 14px ${info.color}33` } : undefined}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: info.color, boxShadow: active ? `0 0 8px ${info.color}` : undefined }} />
            <span className="leading-tight">
              <span className={`block text-xs font-bold ${active ? "text-white" : "text-white/75"}`}>{info.label}</span>
              <span className="block text-[10px] text-white/45">{info.blurb.split(" — ")[0]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
