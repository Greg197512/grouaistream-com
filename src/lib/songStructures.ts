// Gotowe struktury utworu (zwrotka/refren…) — do podpowiedzi w opisie i do szablonu tekstu ze znacznikami.

export type SectionKind = "intro" | "verse" | "pre" | "chorus" | "bridge" | "drop" | "build" | "solo" | "hook" | "outro" | "break";
export type Section = { kind: SectionKind; n?: number; bars: number };
export type SongStructure = { id: string; pl: string; en: string; sections: Section[] };

export const SECTION_META: Record<SectionKind, { pl: string; en: string; color: string }> = {
  intro: { pl: "Intro", en: "Intro", color: "#64748B" },
  verse: { pl: "Zwrotka", en: "Verse", color: "#3B82F6" },
  pre: { pl: "Przedrefren", en: "Pre-Chorus", color: "#06B6D4" },
  chorus: { pl: "Refren", en: "Chorus", color: "#F5B73B" },
  hook: { pl: "Hook", en: "Hook", color: "#F5B73B" },
  bridge: { pl: "Bridge", en: "Bridge", color: "#A855F7" },
  build: { pl: "Narastanie", en: "Build-up", color: "#F97316" },
  drop: { pl: "Drop", en: "Drop", color: "#EF4444" },
  break: { pl: "Przerwa", en: "Break", color: "#14B8A6" },
  solo: { pl: "Solo", en: "Solo", color: "#EC4899" },
  outro: { pl: "Outro", en: "Outro", color: "#64748B" },
};

const s = (kind: SectionKind, bars: number, n?: number): Section => ({ kind, bars, n });

export const SONG_STRUCTURES: SongStructure[] = [
  { id: "pop", pl: "Przebój pop", en: "Pop hit", sections: [s("intro", 4), s("verse", 8, 1), s("pre", 4), s("chorus", 8), s("verse", 8, 2), s("pre", 4), s("chorus", 8), s("bridge", 8), s("chorus", 8), s("outro", 4)] },
  { id: "ballad", pl: "Ballada", en: "Ballad", sections: [s("intro", 4), s("verse", 8, 1), s("verse", 8, 2), s("chorus", 8), s("verse", 8, 3), s("chorus", 8), s("bridge", 8), s("chorus", 8), s("outro", 6)] },
  { id: "hiphop", pl: "Hip-hop", en: "Hip-hop", sections: [s("intro", 4), s("verse", 16, 1), s("hook", 8), s("verse", 16, 2), s("hook", 8), s("bridge", 8), s("hook", 8), s("outro", 4)] },
  { id: "edm", pl: "EDM z dropem", en: "EDM drop", sections: [s("intro", 8), s("build", 8), s("drop", 16), s("break", 8), s("build", 8), s("drop", 16), s("outro", 8)] },
  { id: "rock", pl: "Rock z solówką", en: "Rock with solo", sections: [s("intro", 4), s("verse", 8, 1), s("chorus", 8), s("verse", 8, 2), s("chorus", 8), s("solo", 8), s("chorus", 8), s("outro", 4)] },
  { id: "short", pl: "Krótki (TikTok/Reels)", en: "Short (TikTok/Reels)", sections: [s("hook", 4), s("verse", 8, 1), s("chorus", 8), s("outro", 2)] },
];

const sectionName = (x: Section, lang: "pl" | "en") => `${SECTION_META[x.kind][lang]}${x.n ? ` ${x.n}` : ""}`;

/** Dopisek do opisu utworu, np. „struktura: intro, zwrotka 1, refren, …”. */
export function structureToPrompt(st: SongStructure, lang: "pl" | "en"): string {
  return `${lang === "pl" ? "struktura" : "structure"}: ${st.sections.map((x) => sectionName(x, lang).toLowerCase()).join(", ")}`;
}

/** Szablon tekstu ze znacznikami sekcji ([Zwrotka 1], [Refren]…) i pustymi liniami do wpisania słów. */
export function structureToLyrics(st: SongStructure, lang: "pl" | "en"): string {
  return st.sections.map((x) => {
    const lines = x.kind === "intro" || x.kind === "outro" || x.kind === "drop" || x.kind === "build" || x.kind === "break" || x.kind === "solo" ? 0 : Math.max(2, Math.round(x.bars / 2));
    return [`[${sectionName(x, lang)}]`, ...Array.from({ length: lines }, () => "")].join("\n");
  }).join("\n\n");
}

/** Sekcje odczytane ze znaczników w tekście (do podglądu struktury własnego tekstu). */
export function sectionsFromLyrics(lyrics: string): { label: string; kind: SectionKind; lines: number }[] {
  const out: { label: string; kind: SectionKind; lines: number }[] = [];
  for (const line of lyrics.split("\n")) {
    const m = line.trim().match(/^\[([^\]]+)\]$/);
    if (m) {
      const l = m[1].toLowerCase();
      const kind: SectionKind = /^pre|przed/.test(l) ? "pre" : /refren|chorus/.test(l) ? "chorus" : /hook/.test(l) ? "hook" : /zwrotk|verse|couplet|куплет/.test(l) ? "verse"
        : /bridge|most/.test(l) ? "bridge" : /intro/.test(l) ? "intro" : /outro|koniec|zakończ/.test(l) ? "outro" : /drop/.test(l) ? "drop" : /solo/.test(l) ? "solo" : /build|narast/.test(l) ? "build" : "break";
      out.push({ label: m[1], kind, lines: 0 });
    } else if (line.trim() && out.length) out[out.length - 1].lines++;
  }
  return out;
}
