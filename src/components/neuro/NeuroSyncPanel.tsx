import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, HeartPulse, Vibrate, Bluetooth } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useHapticBass } from "@/hooks/useHapticBass";
import { useHeartRate } from "@/hooks/useHeartRate";
import { toast } from "sonner";

// Panel Neuro-Sync: haptic bass (wibracja na drop) + tętno przez Web Bluetooth.
// Wszystko web-native, opt-in, bez instalacji apek.
export function NeuroSyncPanel() {
  const player = (() => { try { return usePlayer(); } catch { return null; } })();
  const [haptic, setHaptic] = useState<boolean>(() => localStorage.getItem("grouai-haptic") === "1");
  const hasVibrate = typeof navigator !== "undefined" && typeof (navigator as any).vibrate === "function";

  useHapticBass(player?.audioElement ?? null, haptic && hasVibrate);

  const hr = useHeartRate();

  useEffect(() => { localStorage.setItem("grouai-haptic", haptic ? "1" : "0"); }, [haptic]);

  const toggleHaptic = () => {
    if (!hasVibrate) {
      toast.info("Wibracje działają na telefonie z Androidem (iOS/desktop ich nie wspiera).");
      return;
    }
    const next = !haptic;
    setHaptic(next);
    if (next) navigator.vibrate?.(40); // próbka od razu
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#12101c]/70 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#9333EA]">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-white leading-none">Neuro-Sync</h3>
          <p className="text-[11px] text-white/50 mt-0.5">Poczuj muzykę ciałem — bez instalacji</p>
        </div>
      </div>

      {/* HAPTIC BASS */}
      <button
        onClick={toggleHaptic}
        className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
          haptic ? "border-[#FF6B00]/50 bg-[#FF6B00]/10" : "border-white/10 bg-white/5 hover:border-white/20"
        }`}
      >
        <Vibrate className={`h-5 w-5 ${haptic ? "text-orange-300" : "text-white/60"}`} />
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Haptic bass — poczuj drop</div>
          <div className="text-[11px] text-white/50">Telefon wibruje w rytm basu (Android)</div>
        </div>
        <span className={`text-[11px] font-bold ${haptic ? "text-orange-300" : "text-white/40"}`}>{haptic ? "WŁ" : "WYŁ"}</span>
      </button>

      {/* TĘTNO / WEB BLUETOOTH */}
      <div className={`rounded-xl border p-3 ${hr.connected ? "border-rose-400/40 bg-rose-500/10" : "border-white/10 bg-white/5"}`}>
        <div className="flex items-center gap-3">
          <motion.div
            animate={hr.connected && hr.bpm ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: hr.bpm ? 60 / hr.bpm : 1, repeat: Infinity, ease: "easeInOut" }}
          >
            <HeartPulse className={`h-5 w-5 ${hr.connected ? "text-rose-400" : "text-white/60"}`} />
          </motion.div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">
              Tętno {hr.connected && hr.bpm ? <span className="text-rose-300">· {hr.bpm} BPM</span> : ""}
            </div>
            <div className="text-[11px] text-white/50">
              {hr.connected ? "Połączono — AI dopasuje energię do serca" : "Połącz czujnik/zegarek Bluetooth (Chrome)"}
            </div>
          </div>
          {hr.connected ? (
            <button onClick={hr.disconnect} className="text-[11px] font-semibold text-white/60 hover:text-white px-2 py-1">Rozłącz</button>
          ) : (
            <button
              onClick={hr.connect}
              disabled={hr.connecting || !hr.supported}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              <Bluetooth className="h-3.5 w-3.5" />
              {hr.connecting ? "Łączę…" : "Połącz"}
            </button>
          )}
        </div>
        {hr.error && <p className="mt-2 text-[11px] text-rose-300">{hr.error}</p>}
        {!hr.supported && <p className="mt-2 text-[11px] text-white/40">Twoja przeglądarka nie wspiera Web Bluetooth — użyj Chrome (Android/PC).</p>}
      </div>
    </div>
  );
}
