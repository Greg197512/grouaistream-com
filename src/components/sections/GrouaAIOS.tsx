import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  BrainCircuit,
  Mic,
  Radio,
  Sparkles,
  Wand2,
  Play,
  ArrowRight,
  Activity,
  Disc3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useDJMode } from "@/hooks/useDJMode";
import { toast } from "sonner";

type TrackRow = {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration?: number | null;
  cover_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  genre?: string | null;
  mood?: string | null;
};

const QUICK_COMMANDS = [
  { label: "Nocny rock", command: "Groua, puść mi nocny rock" },
  { label: "Coś nowego", command: "Groua, pokaż mi coś czego jeszcze nie znam" },
  { label: "Mocny set", command: "Groua, zrób mocny set" },
  { label: "Odkryj artystę", command: "Groua, odkryj dla mnie nowego artystę" },
];

const GENRE_ALIASES: Record<string, string> = {
  rock: "Rock",
  punk: "Punk",
  metal: "Metal",
  jazz: "Jazz",
  pop: "Pop",
  hiphop: "Hip-Hop",
  "hip-hop": "Hip-Hop",
  rap: "Rap",
  electronic: "Electronic",
  elektronika: "Electronic",
  techno: "Electronic",
  house: "House",
  disco: "Disco",
  blues: "Blues",
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectGenre(text: string) {
  const normalized = normalize(text);
  return Object.entries(GENRE_ALIASES).find(([key]) => normalized.includes(key))?.[1] ?? null;
}

function detectMood(text: string) {
  const normalized = normalize(text);
  if (/spokoj|relaks|chill|calm/.test(normalized)) return "Relaxed";
  if (/smutn|melanch|nostalg/.test(normalized)) return "Nostalgic";
  if (/wkur|agres|mocn|energi|hard|ostry/.test(normalized)) return "Energetic";
  if (/szczes|happy|wesol/.test(normalized)) return "Happy";
  return null;
}

export const GrouaAIOS = () => {
  const { playPlaylist } = usePlayer();
  const { startDJSession } = useDJMode();
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState("SYSTEM ONLINE");

  const statusItems = useMemo(
    () => [
      { label: "AI CORE", value: "ONLINE", icon: BrainCircuit },
      { label: "RADIO", value: "24/7", icon: Radio },
      { label: "DISCOVERY", value: "ACTIVE", icon: Wand2 },
      { label: "VOICE", value: "READY", icon: Mic },
    ],
    [],
  );

  const openAssistant = useCallback(() => {
    window.dispatchEvent(new Event("toggle-chat-assistant"));
  }, []);

  const playTracks = useCallback(
    (tracks: TrackRow[], reason: string) => {
      const playable = tracks
        .filter((t) => t.audio_url)
        .map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album || undefined,
          duration: t.duration || undefined,
          cover_url: t.cover_url || undefined,
          audio_url: t.audio_url || undefined,
          video_url: t.video_url || undefined,
          genre: t.genre || undefined,
          mood: t.mood || undefined,
        }));

      if (!playable.length) {
        toast.error("Nie znalazłem odtwarzalnych utworów.");
        return;
      }

      playPlaylist(playable);
      setLastAction(reason);
      toast.success(`Groua wybrał ${playable.length} utworów`);
    },
    [playPlaylist],
  );

  const executeCommand = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      setBusy(true);
      setLastAction("GROUA ANALYZING…");

      try {
        const normalized = normalize(text);
        const wantsDJ =
          /dj|set|domowk|imprez|party|rozkre|mocny set|zrob set/.test(normalized);

        if (wantsDJ) {
          const genre = detectGenre(text);
          await startDJSession({
            genres: genre ? [genre] : [],
            partyType: /klub|club|peak/.test(normalized) ? "club" : "party",
            trackCount: 20,
            customPrompt: text,
          });
          setLastAction("DJ SESSION ACTIVE");
          return;
        }

        const genre = detectGenre(text);
        const mood = detectMood(text);

        let query = supabase
          .from("tracks")
          .select("id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood")
          .not("audio_url", "is", null)
          .limit(40);

        if (genre) query = query.ilike("genre", `%${genre}%`);
        else if (mood) query = query.ilike("mood", `%${mood}%`);

        const { data, error } = await query;

        if (error) throw error;

        if (data?.length) {
          const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 12);
          playTracks(shuffled, genre ? `GENRE: ${genre.toUpperCase()}` : mood ? `MOOD: ${mood.toUpperCase()}` : "DISCOVERY MODE");
          return;
        }

        setLastAction("OPENING AI AGENT");
        openAssistant();
      } catch (error) {
        console.error("Groua AI OS command error:", error);
        setLastAction("FALLBACK TO AI AGENT");
        openAssistant();
      } finally {
        setBusy(false);
      }
    },
    [busy, openAssistant, playTracks, startDJSession],
  );

  return (
    <section className="relative overflow-hidden px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-black/70 p-5 shadow-[0_0_80px_hsl(var(--primary)/0.12)] backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />
          </div>

          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                  <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.35em] text-primary">GROUA AI OS</div>
                  <div className="text-sm text-muted-foreground">Music intelligence layer</div>
                </div>
              </div>

              <h2 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                Nie szukaj muzyki.
                <span className="block bg-gradient-to-r from-primary via-white to-accent bg-clip-text text-transparent">
                  Powiedz Groua, czego potrzebujesz.
                </span>
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Jeden interfejs dla radia, odkrywania, AI DJ-a i rozmowy z Groua.
                Z czasem ta warstwa może stać się mózgiem całego ekosystemu artystów i słuchaczy.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void executeCommand(command);
                    }}
                    placeholder='np. „Groua, daj mi mocny rock na noc”'
                    className="h-12 border-white/10 bg-white/5 pl-11 pr-4 text-sm"
                  />
                </div>
                <Button
                  className="h-12 gap-2 px-5"
                  disabled={busy || !command.trim()}
                  onClick={() => void executeCommand(command)}
                >
                  {busy ? <Activity className="h-4 w-4 animate-pulse" /> : <ArrowRight className="h-4 w-4" />}
                  Wykonaj
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_COMMANDS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setCommand(item.command);
                      void executeCommand(item.command);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03]" onClick={openAssistant}>
                  <Bot className="h-4 w-4" />
                  Rozmawiaj z Groua
                </Button>
                <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03]" onClick={() => void startDJSession({ trackCount: 20, partyType: "party" })}>
                  <Play className="h-4 w-4" />
                  Uruchom AI DJ
                </Button>
              </div>

              <div className="mt-5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <Disc3 className="h-3.5 w-3.5 text-primary" />
                {lastAction}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 self-start">
              {statusItems.map(({ label, value, icon: Icon }, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <Icon className="mb-7 h-5 w-5 text-primary" />
                  <div className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">{label}</div>
                  <div className="mt-1 text-lg font-black">{value}</div>
                </motion.div>
              ))}

              <div className="col-span-2 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5">
                <div className="text-[10px] font-bold tracking-[0.25em] text-primary">NEXT EVOLUTION</div>
                <div className="mt-2 text-lg font-bold">Groua AI pamięta Twój gust.</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Kolejna warstwa: pamięć użytkownika, Music DNA, Discovery Agent,
                  głos, AI manager artysty i agenci pracujący razem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
