import { useState } from "react";
import { Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Dotychczasowe filmy instruktażowe GrouAI Studio (v3), przeniesione do Studio.
const LANGS = [
  { code: "PL", label: "Polski" },
  { code: "EN", label: "English" },
  { code: "NL", label: "Nederlands" },
  { code: "UA", label: "Українська" },
] as const;

type LangCode = (typeof LANGS)[number]["code"];

type Props = {
  L: (pl: string, en: string, nl: string, ua: string) => string;
};

export const StudioTutorialButton = ({ L }: Props) => {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>("PL");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start rounded-full px-4 h-9 text-sm font-semibold text-white border border-white/25 bg-white/[0.06] hover:border-white/60"
      >
        <Film className="h-4 w-4 text-[#FF9500]" />
        <span>{L("Filmy instruktażowe Studio", "Studio tutorial videos", "Studio-instructiefilms", "Навчальні відео Studio")}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>GrouAI Studio: przewodnik</DialogTitle>
            <DialogDescription>{L("Wybierz język. Film zaczyna się od krótkiego pilota.", "Choose a language. The video starts with a short pilot.", "Kies een taal. De video begint met een korte pilot.", "Оберіть мову. Відео починається з короткого пілота.")}</DialogDescription>
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
