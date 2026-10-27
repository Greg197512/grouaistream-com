import { lazy, Suspense, useMemo, useState } from "react";
import { AudioLines, Camera, Clock, Sparkles, Wand2 } from "lucide-react";
import { useAISafe } from "@/contexts/AIContext";
import { analyzeMood, MOOD_META, MOOD_STYLE, moodFromDetector, timeOfDayMood, type StudioMoodId } from "@/lib/moodDetect";

const QuickMoodDetector = lazy(() => import("@/components/mood/QuickMoodDetector").then((m) => ({ default: m.QuickMoodDetector })));

export type MoodSuggestion = { mood: StudioMoodId; source: "text" | "detector" | "time" };

type Props = {
  text: string;
  lang: "pl" | "en";
  L: (pl: string, en: string, nl: string, ua: string) => string;
  onApply: (s: MoodSuggestion) => void;
};

/** Analiza nastroju: z opisu (na żywo), z detektora nastroju (kamera) i z pory dnia — z przyciskiem „Zastosuj styl”. */
export function MoodAnalysisCard({ text, lang, L, onApply }: Props) {
  const ai = useAISafe();
  const [detectorOpen, setDetectorOpen] = useState(false);
  const a = useMemo(() => analyzeMood(text), [text]);
  const tod = useMemo(() => timeOfDayMood(), []);
  const detected = ai?.currentMood ? { mood: moodFromDetector(ai.currentMood.mood, ai.currentMood.genre), raw: ai.currentMood } : null;
  const name = (id: StudioMoodId) => MOOD_META[id][lang];
  const pct = a.confidence;
  const R = 34, C = 2 * Math.PI * R;

  const Suggest = ({ id, label, icon: Icon, source }: { id: StudioMoodId; label: string; icon: typeof Clock; source: MoodSuggestion["source"] }) => (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <Icon className="h-4 w-4 shrink-0" style={{ color: MOOD_META[id].color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="truncate text-xs font-semibold text-white">{name(id)} → {MOOD_STYLE[id].genre}</p>
      </div>
      <button type="button" onClick={() => onApply({ mood: id, source })} className="shrink-0 rounded-full border border-[#F5B73B]/50 px-2.5 py-1 text-[11px] font-bold text-[#F5B73B] hover:bg-[#F5B73B]/10">
        {L("Zastosuj", "Apply", "Toepassen", "Застосувати")}
      </button>
    </div>
  );

  return (
    <section className="rounded-3xl border border-[#1E2A44] bg-[#0B1020]/90 p-4" aria-label={L("Analiza nastroju", "Mood analysis", "Stemmingsanalyse", "Аналіз настрою")}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">{L("Analiza nastroju", "Mood analysis", "Stemmingsanalyse", "Аналіз настрою")}</h3>
        {a.top.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#F5B73B]/40 bg-[#F5B73B]/10 px-2 py-0.5 text-[10px] font-bold text-[#F5B73B]">
            <AudioLines className="h-3 w-3" /> {a.top.map(name).join(" · ")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <svg width={84} height={84} viewBox="0 0 84 84" className="shrink-0" role="img" aria-label={`${pct}%`}>
          <circle cx={42} cy={42} r={R} fill="none" stroke="#1E2A44" strokeWidth={8} />
          <circle cx={42} cy={42} r={R} fill="none" stroke="url(#moodRing)" strokeWidth={8} strokeLinecap="round"
            strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 42 42)" style={{ transition: "stroke-dasharray .5s ease" }} />
          <defs><linearGradient id="moodRing" x1="0" x2="1"><stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#F5B73B" /></linearGradient></defs>
          <text x={42} y={47} textAnchor="middle" fontSize={17} fontWeight={800} fill="#fff">{pct ? `${pct}%` : "—"}</text>
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">
            {!pct ? L("Opisz utwór", "Describe your track", "Beschrijf je track", "Опиши трек") : pct >= 75 ? L("Pewne dopasowanie", "Confident match", "Zekere match", "Впевнений збіг") : L("Wstępne dopasowanie", "Early match", "Voorlopige match", "Попередній збіг")}
          </p>
          <p className="text-[11px] leading-snug text-gray-400">
            {!pct ? L("Nastrój wykryję na żywo z Twojego opisu — albo z kamery.", "I detect the mood live from your description — or from your camera.", "Ik herken de stemming live uit je beschrijving.", "Визначу настрій наживо з опису або з камери.")
              : L("Dopisz więcej słów o klimacie, aby wynik był dokładniejszy.", "Add more words about the vibe for a sharper result.", "Voeg meer sfeerwoorden toe.", "Додай більше слів про настрій.")}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {a.scores.slice(0, 5).map((s) => (
          <div key={s.id} className="grid grid-cols-[92px_1fr_34px] items-center gap-2 text-[11px]">
            <span className="text-gray-300">{name(s.id)}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-[#1E2A44]">
              <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${s.pct}%`, background: `linear-gradient(90deg, #3B82F6, ${MOOD_META[s.id].color})` }} />
            </span>
            <span className="text-right tabular-nums text-gray-400">{s.pct}%</span>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {a.top[0] && <Suggest id={a.top[0]} source="text" icon={Wand2} label={L("Z Twojego opisu", "From your description", "Uit je beschrijving", "З твого опису")} />}
        {detected
          ? <Suggest id={detected.mood} source="detector" icon={Camera} label={`${L("Twój nastrój teraz", "Your mood now", "Je stemming nu", "Твій настрій зараз")} ${detected.raw.emoji ?? ""} (${detected.raw.mood})`} />
          : (
            <button type="button" onClick={() => setDetectorOpen(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[#3B82F6]/40 bg-[#3B82F6]/5 p-2.5 text-left text-xs text-[#93C5FD] hover:bg-[#3B82F6]/10">
              <Camera className="h-4 w-4 shrink-0" />
              <span>{L("Wykryj mój nastrój (kamera) — dobiorę styl utworu", "Detect my mood (camera) — I'll suggest a style", "Detecteer mijn stemming (camera)", "Визначити мій настрій (камера)")}</span>
            </button>
          )}
        <Suggest id={tod.mood} source="time" icon={Clock} label={`${L("Pasuje na", "Fits the", "Past bij", "Пасує на")} ${lang === "pl" ? tod.pl : tod.en}`} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500"><Sparkles className="h-3 w-3" />{L("„Zastosuj” ustawia gatunek, tempo i dopisuje klimat do opisu.", "“Apply” sets genre, tempo and adds the vibe to your prompt.", "„Toepassen” zet genre en tempo.", "«Застосувати» встановлює жанр і темп.")}</p>

      {detectorOpen && (
        <Suspense fallback={null}>
          <QuickMoodDetector isOpen={detectorOpen} onClose={() => setDetectorOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}
