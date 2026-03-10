import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones, Send, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const QUICK_COMMANDS = [
  { emoji: "🔊", label: "Więcej basu!", cmd: "Więcej basu!" },
  { emoji: "💥", label: "Drop teraz!", cmd: "Drop teraz!" },
  { emoji: "🌑", label: "Ciemniej", cmd: "Ciemniej, wolniej" },
  { emoji: "⚡", label: "Szybciej", cmd: "Szybciej!" },
  { emoji: "🔥", label: "Hardciej!", cmd: "Hardciej!" },
  { emoji: "🎵", label: "Melodia", cmd: "Więcej melodii" },
];

export default function PartyPulpit() {
  const { code } = useParams<{ code: string }>();
  const [room, setRoom] = useState<any>(null);
  const [guestLabel, setGuestLabel] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // PWA install
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBanner(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") toast.success("💀 Apka zainstalowana!");
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Fetch room by code
  useEffect(() => {
    if (!code) return;
    const fetch = async () => {
      // Try party_rooms first (new system)
      const { data: pr } = await supabase
        .from("party_rooms")
        .select("*")
        .eq("room_code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (pr) {
        setRoom({ ...pr, _type: "party_room" });
        setLoading(false);
        return;
      }

      // Fallback to legacy dj_sessions
      const { data: ds } = await supabase
        .from("dj_sessions")
        .select("*")
        .eq("session_code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (ds) {
        setRoom({ ...ds, _type: "dj_session" });
      } else {
        toast.error("Sesja nie znaleziona lub nieaktywna");
      }
      setLoading(false);
    };
    fetch();
  }, [code]);

  const joinParty = () => {
    const name = nameInput.trim() || "Anonim";
    const guestNum = Math.floor(Math.random() * 99) + 1;
    setGuestLabel(`Gość #${guestNum} (${name})`);
    setIsJoined(true);
    if (navigator.vibrate) navigator.vibrate(200);
    toast.success(`💀 ${name} na parkiecie!`);
  };

  const sendCommand = async (command: string) => {
    if (!room) return;

    if (room._type === "party_room") {
      await supabase.from("party_commands").insert({
        room_id: room.id,
        guest_label: guestLabel,
        command,
        command_type: "quick",
      });
    } else {
      // Legacy: use dj_session_votes
      await supabase.from("dj_session_votes").insert({
        session_id: room.id,
        vote_type: "command",
        vote_value: command,
      });
    }

    setSentCount(prev => prev + 1);
    if (navigator.vibrate) navigator.vibrate(50);
    toast.success("Komenda wysłana do DJ-a! 🎧");
  };

  const sendCustom = () => {
    if (!customMsg.trim()) return;
    sendCommand(customMsg.trim());
    setCustomMsg("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Headphones className="h-12 w-12 text-red-500" />
        </motion.div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">💀</div>
        <h1 className="text-2xl font-bold mb-2 text-white">Sesja nieaktywna</h1>
        <p className="text-gray-400">Ta sesja DJ już się zakończyła lub nie istnieje.</p>
      </div>
    );
  }

  // Join screen
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/15 via-transparent to-purple-900/10 pointer-events-none" />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 max-w-sm w-full text-center"
        >
          <div className="text-6xl mb-4">🎧</div>
          <h1 className="text-3xl font-bold mb-1 text-white">GrouAI Stream</h1>
          <p className="text-red-400 font-mono text-sm mb-6">ROTTERDAM UNDERGROUND DOMÓWKA</p>

          <div className="rounded-2xl border border-red-500/20 bg-black/60 p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-2">Twoje imię na parkiecie</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Anonim"
                className="w-full px-4 py-3 rounded-xl bg-black/50 border border-red-500/20 text-white text-center font-medium focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
                maxLength={20}
              />
            </div>

            <Button onClick={joinParty} className="w-full text-lg py-6 gap-2 bg-gradient-to-r from-red-600 to-purple-700 border-0" size="lg">
              <Headphones className="h-5 w-5" />
              Dołącz na parkiet!
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Party guest mode
  return (
    <div className="min-h-screen bg-[#050510] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/10 via-transparent to-purple-900/8 pointer-events-none" />

      <div className="relative z-10 p-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-mono uppercase tracking-widest">LIVE</span>
          </div>
          <h1 className="text-xl font-bold text-white">{guestLabel}</h1>
          <p className="text-xs text-gray-500 mt-1">{sentCount} komend wysłanych</p>
        </div>

        {/* Quick Commands */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">Szybkie komendy</p>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_COMMANDS.map((qc) => (
              <motion.button
                key={qc.cmd}
                whileTap={{ scale: 0.9 }}
                onClick={() => sendCommand(qc.cmd)}
                className="rounded-2xl border border-red-500/15 bg-black/50 py-5 text-center transition-all active:bg-red-500/20 hover:border-red-500/30"
              >
                <span className="text-3xl block">{qc.emoji}</span>
                <span className="text-sm text-gray-300 mt-1 block font-medium">{qc.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Custom message */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCustom()}
              placeholder="Napisz do DJ-a..."
              className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-red-500/15 text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/40"
              maxLength={100}
            />
            <Button onClick={sendCustom} size="icon" className="h-12 w-12 bg-gradient-to-r from-red-600 to-purple-700 border-0 rounded-xl shrink-0">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* PWA Install */}
        <AnimatePresence>
          {showInstallBanner && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="rounded-xl border border-red-500/20 bg-black/60 p-4 flex items-center gap-3"
            >
              <Download className="h-5 w-5 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Zainstaluj apkę</p>
                <p className="text-xs text-gray-500">Pełny ekran, zero przeglądarki</p>
              </div>
              <Button onClick={handleInstall} size="sm" className="shrink-0 bg-red-600 border-0">Instaluj</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
