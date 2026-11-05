// „Stworzone dla Ciebie” — playlisty nastroju dobierane ŻYWYM ALGORYTMEM z katalogu (bez płatnego AI):
// gatunek + nastrój + pora dnia → utwory z grającym plikiem, z rozdzielaniem artystów i świeżym losowaniem.
import { useState } from "react";
import { PlaylistCard } from "@/components/cards/PlaylistCard";
import { usePlayer, type Track } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { omitRadioOnlyTracks } from "@/lib/catalogTracks";
import { asHomeLang, homeTxt } from "@/lib/homeI18n";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface PlaylistGridProps {
  title: string;
  subtitle?: string;
  showAll?: boolean;
}

type Mix = { id: string; gradient: string; genres: string[]; moods: string[] };

const MIXES: Mix[] = [
  { id: "morning", gradient: "from-yellow-400 via-orange-500 to-red-500", genres: ["pop", "dance", "funk", "disco"], moods: ["happy", "energetic", "upbeat"] },
  { id: "focus", gradient: "from-blue-400 via-indigo-500 to-purple-500", genres: ["electronic", "ambient", "lo-fi", "lofi", "piano"], moods: ["calm", "focused", "chill"] },
  { id: "evening", gradient: "from-purple-400 via-pink-500 to-rose-500", genres: ["r&b", "soul", "jazz", "acoustic", "folk"], moods: ["relaxed", "romantic", "calm", "sad"] },
  { id: "workout", gradient: "from-green-400 via-cyan-500 to-blue-500", genres: ["rock", "hip-hop", "rap", "trap", "edm", "techno", "house"], moods: ["energetic", "angry", "powerful"] },
];

const NAMES: Record<string, Record<string, [string, string]>> = {
  pl: { morning: ["Poranna energia", "Pop i taneczne rytmy na dobry start"], focus: ["Skupienie", "Elektronika i spokojne tła do pracy"], evening: ["Wieczorny relaks", "R&B, soul i akustyka na wyciszenie"], workout: ["Trening", "Rock, hip-hop i klubowe bity"] },
  en: { morning: ["Morning energy", "Pop and dance rhythms to start the day"], focus: ["Focus", "Electronic and calm backgrounds for work"], evening: ["Evening unwind", "R&B, soul and acoustic to slow down"], workout: ["Workout", "Rock, hip-hop and club beats"] },
  nl: { morning: ["Ochtendenergie", "Pop en dansritmes voor een goede start"], focus: ["Focus", "Elektronisch en rustig om te werken"], evening: ["Avondrust", "R&B, soul en akoestisch om te ontspannen"], workout: ["Workout", "Rock, hiphop en clubbeats"] },
  ua: { morning: ["Ранкова енергія", "Поп і танцювальні ритми для доброго старту"], focus: ["Фокус", "Електроніка та спокійний фон для роботи"], evening: ["Вечірній релакс", "R&B, соул і акустика"], workout: ["Тренування", "Рок, хіп-хоп і клубні біти"] },
};

const matches = (v: string | null | undefined, kws: string[]) => !!v && kws.some((k) => v.toLowerCase().includes(k));

/** Żywy algorytm: pasujące gatunkiem/nastrojem → losowo, bez dwóch utworów tego samego artysty pod rząd. */
function pick(pool: Track[], mix: Mix, n = 20): Track[] {
  const scored = pool
    .map((t) => ({ t, s: (matches(t.genre, mix.genres) ? 2 : 0) + (matches(t.mood, mix.moods) ? 1 : 0) + Math.random() }))
    .sort((a, b) => b.s - a.s);
  const good = scored.filter((x) => x.s >= 1).map((x) => x.t);
  const base = good.length >= 8 ? good : scored.map((x) => x.t);
  const out: Track[] = [];
  const rest = [...base];
  while (out.length < n && rest.length) {
    const i = rest.findIndex((t) => t.artist !== out[out.length - 1]?.artist);
    out.push(rest.splice(i >= 0 ? i : 0, 1)[0]);
  }
  return out;
}

export const PlaylistGrid = ({ title, subtitle }: PlaylistGridProps) => {
  const { playPlaylist } = usePlayer();
  const { language } = useLanguage();
  const L = asHomeLang(language);
  const [busy, setBusy] = useState<string | null>(null);

  const play = async (mix: Mix) => {
    if (busy) return;
    setBusy(mix.id);
    try {
      const { data } = await supabase
        .from("tracks")
        .select("id,title,artist,album,duration,audio_url,video_url,cover_url,genre,mood")
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(400);
      const music = omitRadioOnlyTracks((data ?? []) as Track[]);
      const list = pick(music, mix);
      if (!list.length) { toast.error("Brak utworów w katalogu"); return; }
      playPlaylist(list, 0, `mix-${mix.id}`);
      toast.success(`🎵 ${NAMES[L][mix.id][0]} · ${list.length}`);
    } catch {
      toast.error("Nie udało się ułożyć playlisty");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="groove-gradient-bg flex h-8 w-8 items-center justify-center rounded-lg">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? homeTxt(language).forYouHint}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {MIXES.map((mix) => (
          <div key={mix.id} className="relative">
            {busy === mix.id && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <PlaylistCard
              title={NAMES[L][mix.id][0]}
              description={NAMES[L][mix.id][1]}
              isAI
              gradient={mix.gradient}
              onClick={() => void play(mix)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
