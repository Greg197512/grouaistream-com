import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Flame, Zap, Music, ThumbsUp, Volume2, ChevronUp, Headphones, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REACTIONS = [
  { emoji: "🔥", label: "Fire", value: "fire" },
  { emoji: "💀", label: "Hard", value: "skull" },
  { emoji: "⚡", label: "Energy", value: "energy" },
  { emoji: "🖤", label: "Dark", value: "dark" },
  { emoji: "🚀", label: "Harder!", value: "harder" },
  { emoji: "👏", label: "Drop!", value: "drop" },
];

const GENRE_VOTES = [
  "Hard Techno", "Driving House", "Industrial", "Acid", 
  "Dark Techno", "Peak-Time", "Hardcore", "Trance"
];

export default function PartyPulpit() {
  const { code } = useParams<{ code: string }>();
  const [session, setSession] = useState<any>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [recentReactions, setRecentReactions] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState("");

  // Fetch session by code
  useEffect(() => {
    if (!code) return;
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from("dj_sessions")
        .select("*")
        .eq("session_code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        toast.error("Sesja nie znaleziona lub nieaktywna");
      } else {
        setSession(data);
      }
      setLoading(false);
    };
    fetchSession();
  }, [code]);

  // Realtime subscriptions
  useEffect(() => {
    if (!session) return;

    const guestsChannel = supabase
      .channel(`party-guests-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dj_session_guests", filter: `session_id=eq.${session.id}` }, (payload) => {
        fetchGuestCount();
        if (payload.eventType === "UPDATE" && payload.new.last_reaction) {
          setRecentReactions(prev => [payload.new.last_reaction, ...prev].slice(0, 20));
        }
      })
      .subscribe();

    const votesChannel = supabase
      .channel(`party-votes-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dj_session_votes", filter: `session_id=eq.${session.id}` }, () => {
        fetchVotes();
      })
      .subscribe();

    fetchGuestCount();
    fetchVotes();

    return () => {
      supabase.removeChannel(guestsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [session?.id]);

  const fetchGuestCount = async () => {
    if (!session) return;
    const { count } = await supabase
      .from("dj_session_guests")
      .select("*", { count: "exact", head: true })
      .eq("session_id", session.id);
    setGuestCount(count || 0);
  };

  const fetchVotes = async () => {
    if (!session) return;
    const { data } = await supabase
      .from("dj_session_votes")
      .select("vote_value")
      .eq("session_id", session.id)
      .eq("vote_type", "genre_request");

    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(v => { counts[v.vote_value] = (counts[v.vote_value] || 0) + 1; });
      setVotes(counts);
    }
  };

  const joinSession = async () => {
    if (!session) return;
    const name = nameInput.trim() || "Anonim";
    const { data, error } = await supabase
      .from("dj_session_guests")
      .insert({ session_id: session.id, guest_name: name })
      .select()
      .single();

    if (error) {
      toast.error("Nie udało się dołączyć");
    } else {
      setGuestId(data.id);
      setGuestName(name);
      setIsJoined(true);
      toast.success(`💀 ${name} na parkiecie!`);
    }
  };

  const sendReaction = async (reaction: string) => {
    if (!guestId) return;
    await supabase
      .from("dj_session_guests")
      .update({ last_reaction: reaction, last_reaction_at: new Date().toISOString() })
      .eq("id", guestId);
  };

  const voteGenre = async (genre: string) => {
    if (!guestId || !session) return;
    await supabase
      .from("dj_session_votes")
      .insert({ session_id: session.id, guest_id: guestId, vote_type: "genre_request", vote_value: genre });
    toast.success(`Głos: ${genre} 💀`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Headphones className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">💀</div>
        <h1 className="text-2xl font-bold mb-2">Sesja nieaktywna</h1>
        <p className="text-muted-foreground">Ta sesja DJ już się zakończyła lub nie istnieje.</p>
      </div>
    );
  }

  // Join screen
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 via-transparent to-purple-900/20 pointer-events-none" />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 max-w-sm w-full text-center"
        >
          <div className="text-6xl mb-4">🎧</div>
          <h1 className="text-3xl font-bold mb-1">DJ GrooveAI</h1>
          <p className="text-primary font-mono text-sm mb-6">ROTTERDAM PEAK-TIME 2026</p>

          <div className="groove-card p-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Twoje imię na parkiecie</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Anonim"
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-center font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={20}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <Music className="h-4 w-4" />
              <span>{session.session_name}</span>
              <span>•</span>
              <span>{guestCount} osób</span>
            </div>

            <Button onClick={joinSession} className="w-full text-lg py-6 gap-2" size="lg">
              <Zap className="h-5 w-5" />
              Dołącz na parkiet!
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Party pulpit
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/15 via-background to-purple-900/10 pointer-events-none" />

      {/* Floating reactions */}
      <AnimatePresence>
        {recentReactions.slice(0, 8).map((r, i) => (
          <motion.div
            key={`${r}-${i}-${Date.now()}`}
            initial={{ opacity: 1, y: 0, x: Math.random() * 300 + 30 }}
            animate={{ opacity: 0, y: -200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
            className="absolute bottom-32 text-3xl pointer-events-none z-20"
          >
            {r}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="relative z-10 p-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <p className="text-xs text-primary font-mono tracking-widest uppercase">Live Session</p>
          <h1 className="text-2xl font-bold">{session.session_name}</h1>
          <div className="flex items-center justify-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
            <span>{guestCount} na parkiecie</span>
            <span>{guestName}</span>
          </div>
        </div>

        {/* Quick Reactions */}
        <div className="mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 text-center">Reakcje</p>
          <div className="grid grid-cols-3 gap-2">
            {REACTIONS.map((r) => (
              <motion.button
                key={r.value}
                whileTap={{ scale: 0.85 }}
                onClick={() => sendReaction(r.emoji)}
                className="bg-secondary/80 hover:bg-secondary rounded-xl py-4 text-center transition-colors active:bg-primary/20"
              >
                <span className="text-3xl block">{r.emoji}</span>
                <span className="text-xs text-muted-foreground mt-1 block">{r.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Genre Vote */}
        <div className="mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 text-center">
            Głosuj na gatunek
          </p>
          <div className="grid grid-cols-2 gap-2">
            {GENRE_VOTES.map((genre) => {
              const voteCount = votes[genre] || 0;
              return (
                <motion.button
                  key={genre}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => voteGenre(genre)}
                  className="bg-secondary/60 hover:bg-secondary rounded-xl px-3 py-3 text-left transition-colors relative overflow-hidden"
                >
                  {/* Vote bar */}
                  {voteCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(voteCount * 15, 100)}%` }}
                      className="absolute inset-y-0 left-0 bg-primary/15 rounded-xl"
                    />
                  )}
                  <span className="relative z-10 text-sm font-medium">{genre}</span>
                  {voteCount > 0 && (
                    <span className="relative z-10 text-xs text-primary ml-2">{voteCount}</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Energy meter */}
        <div className="groove-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Energia parkietu</p>
          <div className="flex items-center justify-center gap-1">
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  height: [12, 12 + Math.random() * 24, 12],
                  backgroundColor: i < Math.min(guestCount, 10)
                    ? ["hsl(0,80%,50%)", "hsl(0,90%,60%)", "hsl(0,80%,50%)"]
                    : "hsl(var(--secondary))",
                }}
                transition={{ repeat: Infinity, duration: 0.5 + Math.random() * 0.5, delay: i * 0.05 }}
                className="w-3 rounded-full"
                style={{ minHeight: 12 }}
              />
            ))}
          </div>
          <p className="text-2xl font-bold mt-2">{guestCount}</p>
          <p className="text-xs text-muted-foreground">osób na parkiecie</p>
        </div>
      </div>
    </div>
  );
}
