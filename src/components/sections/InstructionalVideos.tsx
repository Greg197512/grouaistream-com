import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Cloud, Play, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HOME_GUIDE, type GuideLang } from "@/lib/homeGuide";
import { useLanguage } from "@/contexts/LanguageContext";

// Etykieta przycisku przywracającego sekcję, w języku strony.
const RESTORE_LABEL = {
  pl: "Instrukcja użytkowania · film",
  en: "User guide · video",
  nl: "Gebruikershandleiding · video",
  ua: "Інструкція користувача · відео",
} as const;

// Język wybrany na stronie głównej pokazuje instrukcję i film informacyjny.
// Pliki leżą w public/videos/GrouAI_Stream_{KOD}.mp4.
const LANGS: { code: GuideLang; label: string }[] = [
  { code: "PL", label: "Polski" },
  { code: "EN", label: "English" },
  { code: "NL", label: "Nederlands" },
  { code: "UA", label: "Українська" },
];

// Wyłączenie sekcji zapisujemy lokalnie (per przeglądarka). Bez dostępu do storage sekcja po prostu zostaje.
const HIDDEN_KEY = "instructionalVideosHidden";

const readHidden = () => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
};

const writeHidden = (value: boolean) => {
  try {
    if (value) localStorage.setItem(HIDDEN_KEY, "1");
    else localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // brak dostępu do storage: ignorujemy
  }
};

// Po obejrzeniu filmu do końca sekcja znika na stałe (per przeglądarka).
const WATCHED_KEY = "instructionalVideoWatched";

const readWatched = () => {
  try {
    return localStorage.getItem(WATCHED_KEY) === "1";
  } catch {
    return false;
  }
};

const writeWatched = () => {
  try {
    localStorage.setItem(WATCHED_KEY, "1");
  } catch {
    // brak dostępu do storage: ignorujemy
  }
};

export const InstructionalVideos = () => {
  const [lang, setLang] = useState<GuideLang | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(readHidden);
  const [watched, setWatched] = useState<boolean>(readWatched);
  const { language } = useLanguage();

  if (watched) return null;

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          writeHidden(false);
          setHidden(false);
        }}
        className="inline-flex items-center gap-2 rounded-full px-4 h-10 text-sm font-semibold text-white border border-white/30 bg-white/[0.06] hover:bg-white/[0.14] hover:border-white/60"
      >
        <motion.span
          aria-hidden
          animate={{ x: [0, 5, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="text-base leading-none"
        >
          👉
        </motion.span>
        <motion.span
          animate={{ opacity: [1, 0.25, 1], scale: [1, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex"
        >
          <BookOpen className="h-5 w-5 text-accent" />
        </motion.span>
        <span>{RESTORE_LABEL[language]}</span>
      </button>
    );
  }

  const guide = lang ? HOME_GUIDE[lang] : null;

  return (
    <section className="w-full max-w-3xl rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">
          {guide ? guide.title : "Wybierz język · Choose a language"}
        </h2>
        <button
          type="button"
          aria-label="Wyłącz sekcję instrukcji"
          title="Wyłącz sekcję"
          onClick={() => {
            writeHidden(true);
            setHidden(true);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] text-white/70 hover:text-white hover:border-white/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={lang === l.code}
            className={
              "rounded-full px-4 h-9 text-sm font-semibold border transition-colors " +
              (lang === l.code
                ? "bg-accent text-black border-accent"
                : "bg-white/[0.06] text-white border-white/25 hover:border-white/60")
            }
          >
            {l.label}
          </button>
        ))}
      </div>

      {guide && lang && (
        <>
          <ol className="space-y-3">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm sm:text-base text-white/85">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-black">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full px-5 h-11 font-semibold text-sm text-white border border-white/35 bg-white/[0.08] hover:bg-white/[0.16]"
          >
            <Cloud className="h-5 w-5 text-accent" />
            <span>{guide.film}</span>
            <Play className="h-4 w-4 text-accent" />
          </button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl w-[calc(100%-2rem)]">
              <DialogHeader>
                <DialogTitle>{guide.filmTitle}</DialogTitle>
              </DialogHeader>
              <video
                key={lang}
                src={`/videos/GrouAI_Stream_${lang}.mp4`}
                controls
                autoPlay
                playsInline
                preload="metadata"
                onEnded={() => {
                  writeWatched();
                  setWatched(true);
                  setOpen(false);
                }}
                className="w-full rounded-lg bg-black aspect-video"
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
};
