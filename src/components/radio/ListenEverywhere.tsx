import { useState } from "react";
import { motion } from "framer-motion";
import { Car, Copy, Check, ExternalLink, Radio, Smartphone, Speaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Publiczny, ciągły strumień radia (HLS) — działa w Tesli, CarPlay/Android Auto,
// aplikacjach radiowych i każdej przeglądarce.
const STREAM_BASE = "https://bvstvawnigyczvofzhps.supabase.co/functions/v1/radio-stream";
const HLS_URL = `${STREAM_BASE}?f=m3u8`;
const PLS_URL = "https://grouaistream.com/radio.pls";
const LISTEN_URL = "https://grouaistream.com/listen.html";

const HOWTO = [
  {
    icon: Car,
    title: "Tesla i auta z przeglądarką",
    steps: [
      "W aucie otwórz przeglądarkę (Tesla: Theater / Browser).",
      "Wejdź na grouaistream.com/listen.html",
      "Dotknij dużego przycisku ▶ — radio gra na głośnikach auta.",
    ],
  },
  {
    icon: Speaker,
    title: "CarPlay / Android Auto / aplikacje radiowe",
    steps: [
      "W aplikacji radiowej (np. „Radio”, VLC, TuneIn po dodaniu) wybierz „Dodaj stację / URL”.",
      "Wklej adres strumienia HLS (przycisk „Kopiuj adres” poniżej).",
      "Albo zaimportuj plik grouaistream.com/radio.pls",
    ],
  },
  {
    icon: Smartphone,
    title: "Telefon / głośnik / komputer",
    steps: [
      "Otwórz grouaistream.com/listen.html w dowolnej przeglądarce.",
      "Działa w tle z ekranem blokady (tytuł utworu na ekranie).",
    ],
  },
];

export const ListenEverywhere = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast({ title: "Skopiowano", description: label });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "Nie udało się skopiować", variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-cyan-500/5 p-5"
    >
      <div className="flex items-center gap-2 mb-1">
        <Car className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm">Słuchaj wszędzie — także w aucie 🚗</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Jeden adres, który zagra w Tesli, telefonie, na głośniku i w aplikacjach radiowych.
        Wszyscy słuchają tego samego, zsynchronizowanego programu na żywo.
      </p>

      {/* Główny przycisk — otwórz odtwarzacz (działa w przeglądarce auta) */}
      <Button
        onClick={() => window.open(LISTEN_URL, "_blank")}
        className="w-full gap-2 h-11 groove-gradient-bg text-primary-foreground font-bold mb-3"
      >
        <Radio className="h-4 w-4" /> Otwórz odtwarzacz radia
      </Button>

      {/* Adresy strumienia */}
      <div className="space-y-2 mb-4">
        <button
          onClick={() => copy(HLS_URL, "Adres strumienia (HLS)")}
          className="w-full flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-left hover:border-primary/40 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Adres strumienia (HLS)</p>
            <p className="text-xs truncate font-mono">{HLS_URL}</p>
          </div>
          {copied === "Adres strumienia (HLS)" ? <Check className="h-4 w-4 text-green-500 shrink-0" /> : <Copy className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
            <a href={PLS_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" /> Plik .pls do auta
            </a>
          </Button>
          <Button onClick={() => copy(PLS_URL, "Adres pliku .pls")} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
            {copied === "Adres pliku .pls" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />} Kopiuj .pls
          </Button>
        </div>
      </div>

      {/* Instrukcje */}
      <div className="space-y-3">
        {HOWTO.map((h) => {
          const Icon = h.icon;
          return (
            <div key={h.title} className="rounded-lg border border-border/40 bg-card/40 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs font-semibold">{h.title}</p>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-muted-foreground">
                {h.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
