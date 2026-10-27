import { useState } from "react";
import { Lightbulb, ListMusic } from "lucide-react";
import { SECTION_META, SONG_STRUCTURES, type SongStructure } from "@/lib/songStructures";

type Props = {
  lang: "pl" | "en";
  L: (pl: string, en: string, nl: string, ua: string) => string;
  /** Dopisz frazę do opisu utworu. */
  onHint: (text: string) => void;
  /** Wybrano strukturę (do opisu albo jako szablon tekstu). */
  onStructure: (s: SongStructure) => void;
  structureLabel: string;
};

const HINTS: { group: [string, string]; items: [string, string][] }[] = [
  { group: ["Instrumenty", "Instruments"], items: [["fortepian", "piano"], ["smyczki", "strings"], ["gitara akustyczna", "acoustic guitar"], ["przesterowane gitary", "distorted guitars"], ["syntezatory lat 80.", "80s synths"], ["bas 808", "808 bass"], ["saksofon", "saxophone"]] },
  { group: ["Wokal", "Vocals"], items: [["męski wokal", "male vocals"], ["żeński wokal", "female vocals"], ["chór", "choir"], ["rap", "rap verses"], ["duet", "duet"]] },
  { group: ["Klimat", "Vibe"], items: [["filmowy", "cinematic"], ["nocne miasto", "night city"], ["letni, słoneczny", "summery, sunny"], ["nostalgiczny", "nostalgic"], ["mroczny", "dark"], ["podnoszący na duchu", "uplifting"]] },
  { group: ["Produkcja", "Production"], items: [["narastające napięcie", "building tension"], ["wielki refren", "huge chorus"], ["minimalistyczny", "minimalist"], ["szum winylu lo-fi", "lo-fi vinyl crackle"], ["mocny drop", "big drop"]] },
];

/** Podpowiedzi do opisu i gotowe struktury utworu (zwrotka/refren…) z podglądem proporcji sekcji. */
export function PromptCoach({ lang, L, onHint, onStructure, structureLabel }: Props) {
  const [group, setGroup] = useState(0);
  const i = lang === "pl" ? 0 : 1;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300"><Lightbulb className="h-3.5 w-3.5 text-[#F5B73B]" />{L("Podpowiedzi", "Hints", "Tips", "Підказки")}</span>
          <div className="flex gap-1" role="tablist">
            {HINTS.map((h, k) => (
              <button key={h.group[1]} type="button" role="tab" aria-selected={group === k} onClick={() => setGroup(k)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${group === k ? "bg-[#F5B73B] text-[#1a1203]" : "text-gray-400 hover:text-white"}`}>
                {h.group[i]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HINTS[group].items.map((it) => (
            <button key={it[1]} type="button" onClick={() => onHint(it[i])}
              className="rounded-full border border-[#1E2A44] bg-[#0F1629] px-3 py-1 text-xs text-gray-300 transition-colors hover:border-[#F5B73B]/60 hover:text-white">
              + {it[i]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300"><ListMusic className="h-3.5 w-3.5 text-[#3B82F6]" />{structureLabel}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SONG_STRUCTURES.map((st) => {
            const total = st.sections.reduce((s, x) => s + x.bars, 0);
            return (
              <button key={st.id} type="button" onClick={() => onStructure(st)}
                className="group rounded-xl border border-[#1E2A44] bg-[#0F1629] p-2.5 text-left transition-colors hover:border-[#3B82F6]/60">
                <span className="flex items-center justify-between text-xs font-semibold text-white">{st[lang]}<span className="text-[10px] font-normal text-gray-500 group-hover:text-[#93C5FD]">{L("Użyj", "Use", "Gebruik", "Використати")}</span></span>
                <span className="mt-2 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                  {st.sections.map((x, k) => <span key={k} style={{ flexGrow: x.bars, background: SECTION_META[x.kind].color }} />)}
                </span>
                <span className="mt-1.5 block truncate text-[10px] text-gray-500">
                  {st.sections.map((x) => SECTION_META[x.kind][lang]).filter((v, k, arr) => arr.indexOf(v) === k).join(" · ")} · {total} {L("taktów", "bars", "maten", "тактів")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
