// Asystent DAW: polecenia zwykłymi słowami → akcje w studiu (bez kręcenia gałkami)
// oraz podpowiedzi zależne od tego, co użytkownik właśnie robi.
// AI (/api/assistant, tryb „daw”) zwraca akcje w JSON; gdy jest niedostępne — lokalny parser.
import { FLAT_FX, NOTE_NAMES, PROGRESSIONS, type StripFx } from "./dsp";
import type { Scale } from "./autotune";

export type DawAction =
  | { type: "fx"; track?: string; set?: Partial<StripFx>; add?: Partial<StripFx> }
  | { type: "preset"; track?: string; preset: string }
  | { type: "smart"; track?: string }
  | { type: "autotune"; track?: string; key?: string; scale?: Scale; strength?: number; speedMs?: number }
  | { type: "bpm"; value: number }
  | { type: "drums"; style?: string; bars?: number }
  | { type: "harmony"; part: "bass" | "chords"; key?: string; progression?: string; bars?: number }
  | { type: "mix"; track?: string; volumeDb?: number; pan?: number; mute?: boolean; solo?: boolean }
  | { type: "transport"; action: "play" | "stop" | "record" }
  | { type: "backing"; prompt: string }
  | { type: "save" }
  | { type: "export" };

export type DawState = {
  bpm: number;
  tracks: { name: string; kind: string; clips: number; recorded: boolean; processed: boolean; autotuned: boolean; muted: boolean }[];
  selectedTrack?: string;
  micOn: boolean;
  monitor: boolean;
  speakers: boolean;
  armed: boolean;
  clipping: boolean;
  saved: boolean;
};

export type AssistantResult = { reply: string; actions: DawAction[]; source: "ai" | "local" };

const FX_RANGES: Record<keyof StripFx, [number, number]> = {
  gate: [-90, -30], hpf: [20, 400], deEss: [0, 100], eqLow: [-12, 12], eqMid: [-12, 12], eqHigh: [-12, 12],
  presence: [-6, 10], air: [-6, 10], compress: [0, 100], reverb: [0, 100], delay: [0, 100],
};

/** Nowe ustawienia: `set` = wartości bezwzględne, `add` = zmiana względna; wszystko w zakresach suwaków. */
export function applyFxChange(fx: StripFx, set?: Partial<StripFx>, add?: Partial<StripFx>): StripFx {
  const out = { ...fx };
  for (const k of Object.keys(FX_RANGES) as (keyof StripFx)[]) {
    let v = out[k];
    if (typeof set?.[k] === "number") v = set[k]!;
    if (typeof add?.[k] === "number") v += add[k]!;
    const [lo, hi] = FX_RANGES[k];
    out[k] = Math.round(Math.max(lo, Math.min(hi, v)) * 10) / 10;
  }
  return out;
}

const keyIndex = (s?: string) => {
  if (!s) return -1;
  const m = s.trim().toUpperCase().replace("IS", "#").match(/^([A-G])(#|B)?/);
  if (!m) return -1;
  const base = NOTE_NAMES.indexOf(m[1]);
  return (base + (m[2] === "#" ? 1 : m[2] === "B" ? 11 : 0)) % 12;
};
export const parseKey = keyIndex;

/** Lokalny parser poleceń (po polsku i angielsku) — działa bez internetu i bez AI. */
export function parseCommandLocally(text: string, state: DawState): AssistantResult {
  const t = text.toLowerCase();
  const actions: DawAction[] = [];
  const said: string[] = [];
  const less = /mniej|zmniejsz|słabsz|ogranicz|bez /.test(t);
  const vocal = state.tracks.find((x) => x.kind === "vocal")?.name;
  const target = /wokal|głos|vocal|śpiew/.test(t) ? vocal : undefined;
  const add: Partial<StripFx> = {};

  if (/ciepł|cieplej|warm|pełniej/.test(t)) { Object.assign(add, { eqLow: 2, eqHigh: -1, air: -1 }); said.push("cieplejsze brzmienie"); }
  if (/jaśniej|jasn|klarown|czyteln|wyraźn|bright/.test(t)) { Object.assign(add, { presence: 3, air: 2 }); said.push("więcej czytelności"); }
  if (/pogłos|reverb|przestrze|hall|kości/.test(t)) { add.reverb = less ? -20 : 20; said.push(less ? "mniej pogłosu" : "więcej pogłosu"); }
  if (/echo|delay|pogłos echa/.test(t)) { add.delay = less ? -20 : 20; said.push(less ? "mniej echa" : "więcej echa"); }
  if (/sycz|sss|de-?ess|ostre s/.test(t)) { add.deEss = 25; said.push("złagodzone syczenie"); }
  if (/dudni|bucz|basow.*za dużo|huczy/.test(t)) { add.hpf = 40; said.push("wycięte dudnienie"); }
  if (/kompres|wyrówn|równiej|punch/.test(t)) { add.compress = less ? -20 : 20; said.push(less ? "mniej kompresji" : "więcej kompresji"); }
  const fxSet: Partial<StripFx> = {};
  if (/szum|szumi|hałas|noise/.test(t)) { fxSet.gate = -50; said.push("bramka szumów"); }
  if (Object.keys(add).length || Object.keys(fxSet).length) actions.push({ type: "fx", track: target, add, set: fxSet });

  const presetMap: [RegExp, string, string][] = [
    [/naturaln/, "natural", "preset Naturalny"], [/brzmieni\w* pop|jak w popie|pop studio/, "pop", "preset Pop studio"],
    [/brzmieni\w* rap|jak w rapie|pod rap/, "rap", "preset Rap"], [/ballad/, "ballad", "preset Ballada"],
    [/radio|telefon/, "radio", "efekt radia"], [/bez efektów|wyczyść efekty|reset/, "flat", "bez efektów"],
  ];
  for (const [re, id, label] of presetMap) if (re.test(t)) { actions.push({ type: "preset", track: target, preset: id }); said.push(label); break; }

  if (/popraw|obrób|automatyczn|realizator|profesjonaln|jak w studiu/.test(t)) { actions.push({ type: "smart", track: target ?? vocal }); said.push("inteligentna obróbka głosu"); }

  const keyM = t.match(/\b(?:w|tonacj\w*|key)\s+([a-h](?:is|#|b)?)(?:[- ]?(dur|moll?|minor|major))?/) || t.match(/\b([a-h](?:is|#)?)[- ](dur|moll?)\b/);
  const key = keyM ? keyM[1].replace(/^h/, "b").toUpperCase() : undefined;
  const minor = /mol|moll|minor|smutn|mroczn/.test(t);
  if (/autotun|autotjun|auto-tun|korekt\w* wysoko|fałsz|nierówno śpiew/.test(t)) {
    actions.push({ type: "autotune", track: target ?? vocal, key, scale: key ? (minor ? "minor" : "major") : "chromatic", strength: /mocn|robot|t-?pain/.test(t) ? 1 : 0.8, speedMs: /robot|t-?pain/.test(t) ? 0 : 40 });
    said.push(`autotune${key ? ` w ${key}${minor ? "-moll" : "-dur"}` : ""}`);
  }

  const bpm = t.match(/(?:tempo|bpm)\D{0,3}(\d{2,3})|(\d{2,3})\s*bpm/);
  if (bpm) { const v = +(bpm[1] || bpm[2]); if (v >= 50 && v <= 220) { actions.push({ type: "bpm", value: v }); said.push(`tempo ${v} BPM`); } }

  const bars = (() => { const m = t.match(/(\d{1,2})\s*takt/); return m ? Math.min(32, Math.max(1, +m[1])) : undefined; })();
  if (/perkusj|bit\b|beat|bębn|drum/.test(t)) {
    const style = /trap/.test(t) ? "Trap" : /house|klub/.test(t) ? "House" : /hip.?hop|rap/.test(t) ? "Hip-hop" : "Pop";
    actions.push({ type: "drums", style, bars }); said.push(`perkusja ${style}`);
  }
  const progression = minor ? (/mroczn|dark/.test(t) ? "dark" : "minor") : /ballad/.test(t) ? "ballad" : undefined;
  if (/\bbas\b|basu|linia basu|bass/.test(t) && !/za dużo basu|mniej basu/.test(t)) { actions.push({ type: "harmony", part: "bass", key, progression, bars }); said.push("linia basu"); }
  if (/akord|pad|harmoni|klawisz|pianin/.test(t)) { actions.push({ type: "harmony", part: "chords", key, progression, bars }); said.push("akordy"); }

  const db = t.match(/([+-]?\d{1,2})\s*db/);
  if (/głośniej|podgłoś|louder/.test(t)) { actions.push({ type: "mix", track: target, volumeDb: db ? Math.abs(+db[1]) : 3 }); said.push("głośniej"); }
  if (/ciszej|ścisz|quieter/.test(t)) { actions.push({ type: "mix", track: target, volumeDb: -(db ? Math.abs(+db[1]) : 3) }); said.push("ciszej"); }
  if (/wycisz|mute/.test(t)) { actions.push({ type: "mix", track: target, mute: true }); said.push("wyciszona ścieżka"); }

  const backing = text.match(/podkład\w*\s*(?:ai)?[:,-]?\s*(.{3,})/i);
  if (backing && /zrób|stwórz|wygeneruj|dodaj/.test(t)) { actions.push({ type: "backing", prompt: backing[1].trim() }); said.push("podkład AI"); }

  if (/^(graj|odtwórz|play|start)\b/.test(t)) actions.push({ type: "transport", action: "play" });
  if (/^(stop|zatrzymaj)\b/.test(t)) actions.push({ type: "transport", action: "stop" });
  if (/nagraj|nagrywaj|record/.test(t) && !said.length) actions.push({ type: "transport", action: "record" });
  if (/zapisz projekt|zapisz pracę/.test(t)) actions.push({ type: "save" });
  if (/eksport|pobierz miks|wyeksportuj/.test(t)) actions.push({ type: "export" });

  const reply = actions.length
    ? `Robię: ${said.length ? said.join(", ") : "wykonuję polecenie"}.`
    : "Nie zrozumiałem — spróbuj np. „głos cieplejszy i więcej pogłosu”, „dodaj perkusję hip-hop na 8 taktów”, „tempo 90”, „autotune w A-moll”, „popraw mój głos”.";
  return { reply, actions, source: "local" };
}

/** Wyciąga JSON z odpowiedzi modelu (bywa owinięty w ``` albo tekst). */
export function parseAiJson(text: string): { reply?: string; actions?: DawAction[] } | null {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    const j = JSON.parse(text.slice(s, e + 1));
    return { reply: typeof j.reply === "string" ? j.reply : undefined, actions: Array.isArray(j.actions) ? j.actions : [] };
  } catch {
    return null;
  }
}

/** Polecenie przez AI (tryb „daw” w /api/assistant); błąd lub brak akcji → lokalny parser. */
export async function askDawAssistant(text: string, state: DawState): Promise<AssistantResult> {
  try {
    const r = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "daw", message: `STAN PROJEKTU: ${JSON.stringify(state)}\nPOLECENIE: ${text}` }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
    const raw = await r.text();
    let content = "";
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (d === "[DONE]") continue;
      try { content += JSON.parse(d)?.choices?.[0]?.delta?.content ?? ""; } catch { /* fragment bez JSON */ }
    }
    const parsed = parseAiJson(content);
    if (parsed?.actions?.length) return { reply: parsed.reply || "Gotowe.", actions: parsed.actions, source: "ai" };
    if (parsed?.reply && !parseCommandLocally(text, state).actions.length) return { reply: parsed.reply, actions: [], source: "ai" };
  } catch { /* AI niedostępne — parser lokalny */ }
  return parseCommandLocally(text, state);
}

/** Podpowiedzi zależne od tego, co się dzieje w projekcie (najważniejsze pierwsze). */
export function tipsFor(s: DawState): { id: string; text: string }[] {
  const tips: { id: string; text: string }[] = [];
  const withClips = s.tracks.filter((t) => t.clips > 0);
  if (s.clipping) tips.push({ id: "clip", text: "Miks przesterowuje (czerwony miernik) — ścisz master albo napisz w asystencie „ciszej”." });
  if (s.micOn && s.monitor && s.speakers) tips.push({ id: "speakers", text: "Odsłuch przez głośniki: trzymaj mikrofon z dala od głośników. Ochrona przed sprzężeniem jest włączona — w słuchawkach brzmi najlepiej." });
  if (s.micOn && !s.armed) tips.push({ id: "arm", text: "Uzbrój ścieżkę przyciskiem R — na nią nagra się głos." });
  const rec = s.tracks.find((t) => t.recorded && !t.processed);
  if (rec) tips.push({ id: `smart-${rec.name}`, text: `Masz nagranie na „${rec.name}” — kliknij „Inteligentna obróbka” albo napisz „popraw mój głos”.` });
  const notTuned = s.tracks.find((t) => t.recorded && !t.autotuned);
  if (notTuned) tips.push({ id: `tune-${notTuned.name}`, text: "Fałszuje? Napisz „autotune w C-dur” (albo w tonacji podkładu) — korekta działa na nagraniu, bez opóźnień." });
  if (!withClips.length) tips.push({ id: "start", text: "Zacznij od opisu w asystencie, np. „dodaj perkusję hip-hop i bas w A-moll, tempo 90”, albo nagraj głos: R przy ścieżce i ●." });
  else if (!s.saved && withClips.length >= 1) tips.push({ id: "save", text: "Zapisz projekt, żeby wrócić do niego później (przycisk „Zapisz projekt”)." });
  if (withClips.length >= 2 && !s.micOn) tips.push({ id: "export", text: "Gotowe? W zakładce „Eksport” zapiszesz utwór w swoich — przejdzie mastering pod Spotify." });
  return tips;
}

export const DAW_EXAMPLES = [
  "Głos cieplejszy i więcej pogłosu",
  "Popraw mój głos jak w studiu",
  "Dodaj perkusję hip-hop na 8 taktów, tempo 90",
  "Bas i akordy w A-moll",
  "Autotune w C-dur",
  "Mniej syczenia, ciszej wokal",
];

export { FLAT_FX, PROGRESSIONS };
