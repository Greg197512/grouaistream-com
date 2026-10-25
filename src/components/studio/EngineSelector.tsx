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
    <div className="flex flex-wrap gap-1.5">
      {engines.map((eng) => {
        const info = ENGINE_INFO[eng];
        const active = value === eng;
        return (
          <button
            key={eng}
            type="button"
            onClick={() => !disabled && onChange(eng)}
            disabled={disabled}
            title={info.blurb}
            className={`group relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50 ${
              active ? "text-white shadow-lg" : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
            }`}
            style={active ? { borderColor: info.color, background: `${info.color}22`, boxShadow: `0 0 16px ${info.color}33` } : undefined}
          >
            <span>{info.emoji}</span>
            {info.label}
          </button>
        );
      })}
    </div>
  );
}
