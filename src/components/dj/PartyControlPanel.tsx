import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Share2, Users, X, Clock, Zap, Volume2, TrendingUp, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PartyCommand {
  id: string;
  guest_label: string;
  command: string;
  command_type: string;
  created_at: string;
}

interface PartyControlPanelProps {
  onClose: () => void;
}

export const PartyControlPanel = ({ onClose }: PartyControlPanelProps) => {
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [commands, setCommands] = useState<PartyCommand[]>([]);
  const [voteSummary, setVoteSummary] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState("");
  const [isCreating, setIsCreating] = useState(true);

  const baseUrl = window.location.origin;

  // Create room on mount
  useEffect(() => {
    if (!user) return;
    createRoom();
  }, [user]);

  // Countdown timer
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(() => {
      const expires = new Date(room.expires_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, expires - now);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`);
      if (diff <= 0) endParty();
    }, 1000);
    return () => clearInterval(interval);
  }, [room]);

  // Realtime commands
  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`party-cmd-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "party_commands",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const cmd = payload.new as PartyCommand;
        setCommands(prev => [cmd, ...prev].slice(0, 50));
        // Vibrate on new command
        if (navigator.vibrate) navigator.vibrate(100);
      })
      .subscribe();

    fetchCommands();
    return () => { supabase.removeChannel(channel); };
  }, [room?.id]);

  // Aggregate votes whenever commands change
  useEffect(() => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recent = commands.filter(c => new Date(c.created_at).getTime() > fiveMinAgo);
    const counts: Record<string, number> = {};
    recent.forEach(c => { counts[c.command] = (counts[c.command] || 0) + 1; });
    setVoteSummary(counts);
  }, [commands]);

  const createRoom = async () => {
    if (!user) return;
    // Check existing active room
    const { data: existing } = await supabase
      .from("party_rooms")
      .select("*")
      .eq("host_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      setRoom(existing);
      setIsCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("party_rooms")
      .insert({ host_user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Nie udało się utworzyć pokoju");
      console.error(error);
    } else {
      setRoom(data);
      toast.success("💀 Pokój imprezowy otwarty!");
    }
    setIsCreating(false);
  };

  const fetchCommands = async () => {
    if (!room) return;
    const { data } = await supabase
      .from("party_commands")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setCommands(data as PartyCommand[]);
  };

  const endParty = async () => {
    if (!room) return;
    await supabase.from("party_rooms").update({ is_active: false }).eq("id", room.id);
    // Clean up commands
    await supabase.from("party_commands").delete().eq("room_id", room.id);
    toast.info("🔒 Pokój zamknięty — impreza zakończona");
    onClose();
  };

  const partyUrl = room ? `${baseUrl}/party/${room.room_code}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(partyUrl);
    toast.success("🔗 Link skopiowany!");
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({ title: "🎧 GrouAI Stream — Dołącz na parkiet!", url: partyUrl });
    } else copyLink();
  };

  const totalVotes = Object.values(voteSummary).reduce((a, b) => a + b, 0);
  const topCommand = Object.entries(voteSummary).sort((a, b) => b[1] - a[1])[0];
  const majorityReached = topCommand && totalVotes > 0 && topCommand[1] / totalVotes > 0.5;

  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#050510] flex items-center justify-center"
      >
        <div className="text-center p-8">
          <Zap className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Zaloguj się</h2>
          <p className="text-muted-foreground mb-4">Musisz być zalogowany, żeby uruchomić sesję QR Parkiet.</p>
          <Button onClick={onClose} variant="outline">Zamknij</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#050510] overflow-auto"
    >
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-bold">Parkiet Control & QR</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-mono">{timeLeft || "..."}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {isCreating ? (
          <div className="flex items-center justify-center h-64">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <Zap className="h-12 w-12 text-red-500" />
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: QR Code Section */}
            <div className="flex flex-col items-center gap-5">
              {/* QR with neon border */}
              <div className="relative p-1 rounded-3xl bg-gradient-to-br from-red-500/60 via-purple-500/40 to-red-500/60 shadow-2xl shadow-red-500/20">
                <div className="bg-white p-5 rounded-[22px]">
                  <QRCodeSVG
                    value={partyUrl}
                    size={300}
                    level="H"
                    bgColor="#FFFFFF"
                    fgColor="#0a0a15"
                    imageSettings={{
                      src: "/logo-icon.png",
                      height: 44,
                      width: 44,
                      excavate: true,
                    }}
                  />
                </div>
              </div>

              {/* Room code */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Kod pokoju</p>
                <p className="font-mono text-3xl font-bold tracking-[0.3em] text-red-400">{room?.room_code}</p>
              </div>

              {/* Link + actions */}
              <div className="w-full max-w-xs space-y-3">
                <div className="flex gap-2">
                  <Button onClick={copyLink} variant="outline" className="flex-1 gap-2 border-red-500/20 hover:border-red-500/40">
                    <Copy className="h-4 w-4" /> Kopiuj
                  </Button>
                  <Button onClick={shareLink} className="flex-1 gap-2 bg-gradient-to-r from-red-600 to-purple-700 border-0">
                    <Share2 className="h-4 w-4" /> Udostępnij
                  </Button>
                </div>

                {/* Timer bar */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Clock className="h-3 w-3" />
                  <span>QR ważny: {timeLeft}</span>
                </div>
              </div>

              {/* End party button */}
              <Button
                onClick={endParty}
                variant="outline"
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2 mt-4"
              >
                <X className="h-4 w-4" />
                Zamknij pokój / End Party
              </Button>
            </div>

            {/* RIGHT: Live Parkiet View (HOST ONLY) */}
            <div className="space-y-4">
              {/* Guest count */}
              <div className="rounded-xl border border-red-500/20 bg-black/40 p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-red-400" />
                <span className="font-bold text-lg">Na parkiecie: {commands.length > 0 ? new Set(commands.map(c => c.guest_label)).size : 0} osób</span>
                <div className="ml-auto h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              </div>

              {/* Vote summary */}
              {totalVotes > 0 && (
                <div className="rounded-xl border border-purple-500/20 bg-black/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <span>Głosy (ostatnie 5 min)</span>
                  </div>
                  {Object.entries(voteSummary)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([cmd, count]) => (
                      <div key={cmd} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{cmd}</span>
                          <span className="text-muted-foreground">{count}/{totalVotes}</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/60 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(count / totalVotes) * 100}%` }}
                            className={`h-full rounded-full ${
                              cmd === topCommand?.[0] && majorityReached
                                ? "bg-gradient-to-r from-red-500 to-purple-500"
                                : "bg-muted-foreground/40"
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Majority applied indicator */}
              <AnimatePresence>
                {majorityReached && topCommand && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3"
                  >
                    <Zap className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="text-sm font-bold text-green-300">Ekipa chce: {topCommand[0]}</p>
                      <p className="text-xs text-green-400/70">{topCommand[1]}/{totalVotes} głosów → większość!</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Live command feed */}
              <div className="rounded-xl border border-red-500/10 bg-black/40 p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Radio className="h-4 w-4 text-red-400" />
                  <span>Live Feed</span>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                  {commands.length === 0 ? (
                    <p className="text-sm text-muted-foreground/50 text-center py-6">
                      Czekam na komendy z parkietu...
                    </p>
                  ) : (
                    commands.slice(0, 25).map((cmd) => (
                      <motion.div
                        key={cmd.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2 text-sm py-1.5 border-b border-white/5 last:border-0"
                      >
                        <span className="text-red-400 font-mono text-xs shrink-0">
                          {new Date(cmd.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-muted-foreground">{cmd.guest_label}:</span>
                        <span className="font-medium">{cmd.command}</span>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Energy meter */}
              <div className="rounded-xl border border-red-500/10 bg-black/40 p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 text-center">Energia parkietu</p>
                <div className="flex items-center justify-center gap-1">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: [8, 8 + Math.random() * (commands.length > 0 ? 32 : 8), 8],
                        backgroundColor: commands.length > i
                          ? ["hsl(0,80%,50%)", "hsl(280,70%,50%)", "hsl(0,80%,50%)"]
                          : "hsl(var(--secondary))",
                      }}
                      transition={{ repeat: Infinity, duration: 0.4 + Math.random() * 0.4, delay: i * 0.04 }}
                      className="w-2.5 rounded-full"
                      style={{ minHeight: 8 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
