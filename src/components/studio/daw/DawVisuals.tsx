// Wygląd studia w stylu profesjonalnego DAW: kostki szybkich akcji (AI robi resztę), znaczniki części utworu,
// ikony instrumentów na paskach miksera, wyświetlacz transportu (LCD). Logika dźwięku zostaje w StudioDAW.
import { AudioWaveform, Drum, Guitar, Mic, Music2, Piano, Sparkles, Wand2, Download, SlidersHorizontal, Waves, Disc3, type LucideIcon } from "lucide-react";
import type { Marker } from "@/lib/daw/audio";

const SECTION_COLORS: Record<string, string> = {
  Intro: "#22d3ee", Zwrotka: "#34d399", Refren: "#FF9500", Bridge: "#a78bfa", Outro: "#f472b6", Drop: "#f87171",
};
const LAYOUTS: Record<string, [number, string][]> = {
  song: [[1, "Intro"], [5, "Zwrotka"], [13, "Refren"], [21, "Zwrotka"], [29, "Refren"], [37, "Bridge"], [41, "Refren"], [49, "Outro"]],
  ballad: [[1, "Intro"], [5, "Zwrotka"], [13, "Refren"], [21, "Zwrotka"], [29, "Refren"], [37, "Outro"]],
};
export const NEXT_SECTION = ["Intro", "Zwrotka", "Refren", "Bridge", "Drop", "Outro"];
export const sectionColor = (name: string) => SECTION_COLORS[name] ?? "#FFD400";
export const markerLayout = (layout = "song"): Marker[] =>
  (LAYOUTS[layout] ?? LAYOUTS.song).map(([bar, name], i) => ({ id: `m${i}-${bar}`, bar, name, color: sectionColor(name) }));

/** Ikona instrumentu po nazwie/rodzaju ścieżki (paski miksera, nagłówki ścieżek). */
export function trackIcon(name: string, kind: string): LucideIcon {
  const n = name.toLowerCase();
  if (kind === "vocal" || /wokal|głos|vocal|chór/.test(n)) return Mic;
  if (/perkus|drum|bęb|kick|snare|hat/.test(n)) return Drum;
  if (/bas/.test(n)) return Guitar;
  if (/akord|piano|pianin|klaw|key|synth|pad/.test(n)) return Piano;
  if (/gitar|guitar/.test(n)) return Guitar;
  if (/podkład|beat|bit|ai/.test(n)) return Disc3;
  return AudioWaveform;
}

export type Tile = { id: string; label: string; hint: string; Icon: LucideIcon; color: string; command?: string; action?: () => void };

/** Kostki: duże, proste przyciski — każdy to polecenie dla asystenta studia (bez znajomości techniki). */
export function DawTiles({ tiles, busy, onTile }: { tiles: Tile[]; busy: boolean; onTile: (t: Tile) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-white/10 bg-[#0b0b12] p-2 sm:grid-cols-4 xl:grid-cols-9" role="toolbar" aria-label="Szybkie akcje studia">
      {tiles.map((t) => (
        <button key={t.id} type="button" disabled={busy} onClick={() => onTile(t)} title={t.hint}
          className="group relative flex min-h-[72px] flex-col items-start justify-between overflow-hidden rounded-xl border border-white/10 p-2.5 text-left transition hover:-translate-y-0.5 hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400] disabled:opacity-50"
          style={{ background: `linear-gradient(145deg, ${t.color}33, ${t.color}10 60%, #12121b)` }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${t.color}40`, color: t.color }}><t.Icon className="h-4 w-4" aria-hidden="true" /></span>
          <span className="mt-1.5 block text-[13px] font-bold leading-tight text-white">{t.label}</span>
          <span className="block text-[10px] leading-tight text-gray-400">{t.hint}</span>
        </button>
      ))}
    </div>
  );
}

export const TILE_DEFS = (opts: { record: () => void; upload: () => void; exportMix: () => void }): Tile[] => [
  { id: "song", label: "Zrób szkic utworu", hint: "Tempo, perkusja, bas, akordy, części", Icon: Sparkles, color: "#FFD400", command: "zrób szkic utworu pop od zera na 16 taktów" },
  { id: "rec", label: "Nagraj wokal", hint: "Uzbraja ścieżkę i nagrywa", Icon: Mic, color: "#f87171", action: opts.record },
  { id: "drums", label: "Perkusja", hint: "Bit hip-hop, 8 taktów", Icon: Drum, color: "#FF6B00", command: "dodaj perkusję hip-hop na 8 taktów" },
  { id: "bass", label: "Bas + akordy", hint: "Harmonia w A-moll", Icon: Piano, color: "#a78bfa", command: "dodaj bas i akordy w A-moll" },
  { id: "voice", label: "Popraw głos", hint: "Obróbka jak w studiu", Icon: Wand2, color: "#34d399", command: "popraw mój głos jak w studiu, mniej syczenia" },
  { id: "tune", label: "Autotune", hint: "Czysto w tonacji utworu", Icon: Music2, color: "#22d3ee", command: "autotune w A-moll" },
  { id: "mix", label: "Wyrównaj miks", hint: "Głos czytelny, przestrzeń", Icon: SlidersHorizontal, color: "#60a5fa", command: "głos czytelniejszy, trochę pogłosu i kompresji" },
  { id: "import", label: "Wgraj audio", hint: "Pliki lub podkład", Icon: Waves, color: "#f472b6", action: opts.upload },
  { id: "export", label: "Gotowe — eksport", hint: "Mastering pod Spotify", Icon: Download, color: "#16a34a", action: opts.exportMix },
];

/** Ekran LCD transportu: pozycja (takt.miara), czas, metrum, tempo, tonacja. */
export function TransportLcd({ barBeat, time, bpm, keyName, clipping, onBpm }: {
  barBeat: string; time: string; bpm: number; keyName: string; clipping: boolean; onBpm: (v: number) => void;
}) {
  return (
    <div className={`flex items-stretch overflow-hidden rounded-lg border font-mono tabular-nums shadow-inner ${clipping ? "border-red-500 bg-red-950/60" : "border-[#1f3b4d] bg-[#06121a]"}`} title={clipping ? "Przester na wyjściu!" : undefined}>
      <div className="flex flex-col justify-center px-3 py-1">
        <span className="text-[9px] uppercase tracking-widest text-[#4fb3d9]/70">Takt</span>
        <span className="text-xl font-bold leading-none text-[#7ee0ff] [text-shadow:0_0_8px_#22d3ee80]">{barBeat}</span>
      </div>
      <div className="flex flex-col justify-center border-l border-[#1f3b4d] px-3 py-1">
        <span className="text-[9px] uppercase tracking-widest text-[#4fb3d9]/70">Czas</span>
        <span className="text-xl font-bold leading-none text-[#7ee0ff] [text-shadow:0_0_8px_#22d3ee80]">{time}</span>
      </div>
      <div className="hidden flex-col justify-center border-l border-[#1f3b4d] px-3 py-1 sm:flex">
        <span className="text-[9px] uppercase tracking-widest text-[#4fb3d9]/70">Metrum</span>
        <span className="text-base font-bold leading-none text-[#7ee0ff]">4/4</span>
      </div>
      <label className="flex flex-col justify-center border-l border-[#1f3b4d] px-3 py-1">
        <span className="text-[9px] uppercase tracking-widest text-[#4fb3d9]/70">Tempo</span>
        <input type="number" min={50} max={220} value={bpm} onChange={(e) => onBpm(Math.max(50, Math.min(220, +e.target.value || 100)))}
          className="w-14 bg-transparent text-base font-bold leading-none text-[#FFD400] outline-none" aria-label="Tempo BPM" />
      </label>
      <div className="flex flex-col justify-center border-l border-[#1f3b4d] px-3 py-1">
        <span className="text-[9px] uppercase tracking-widest text-[#4fb3d9]/70">Tonacja</span>
        <span className="text-base font-bold leading-none text-[#7ee0ff]">{keyName}</span>
      </div>
    </div>
  );
}
