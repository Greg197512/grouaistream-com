import { useState } from "react";
import { motion } from "framer-motion";
import { Cloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Filmy instruktażowe (pilot + pełny przewodnik) w czterech językach.
// Pliki leżą w public/videos/ i są generowane poza repozytorium.
const LANGS = [
  { code: "PL", label: "Polski" },
  { code: "EN", label: "English" },
  { code: "NL", label: "Nederlands" },
  { code: "UA", label: "Українська" },
] as const;

type LangCode = (typeof LANGS)[number]["code"];

export const InstructionalVideos = () => {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>("PL");

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        animate={{
          boxShadow: [
            "0 0 18px -4px hsl(331 100% 62% / 0.45)",
            "0 0 38px 4px hsl(331 100% 62% / 0.95)",
            "0 0 18px -4px hsl(331 100% 62% / 0.45)",
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-6 h-12 sm:h-14 font-semibold text-sm sm:text-base text-white border border-white/35 bg-white/[0.08] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.16] hover:border-white/70 hover:-translate-y-0.5"
      >
        <Cloud className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
        <span>Filmy instruktażowe</span>
        <span className="text-xs font-normal text-white/70 hidden sm:inline">· PL · EN · NL · UA</span>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>GrouAI Studio: przewodnik</DialogTitle>
            <DialogDescription>Wybierz język. Film zaczyna się od krótkiego pilota.</DialogDescription>
          </DialogHeader>

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

          <video
            key={lang}
            src={`/videos/GrouAI_Studio_v3_${lang}.mp4`}
            poster={`/videos/GrouAI_Studio_ikona_${lang}.png`}
            controls
            playsInline
            preload="none"
            className="w-full rounded-lg bg-black aspect-video"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
