import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, RefreshCw, Loader2, Sparkles, Zap, Clock, Heart } from "lucide-react";
import { fetchNeuroProfile, NeuroProfile } from "@/lib/neuroProfile";
import { NeuroSyncPanel } from "@/components/neuro/NeuroSyncPanel";

// „Muzyczny Mózg" — widoczny portret dopaminowy (AI z zachowań, pamięć w bazie)
// + Neuro-Sync (haptic bass + tętno Bluetooth). Odtwarzanie wg profilu jest już
// w MoodHistory — tu NIE dublujemy, dokładamy portret + realne czucie.
export function NeuroBrainPanel() {
  const [profile, setProfile] = useState<NeuroProfile | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string>("");

  const load = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    const res = await fetchNeuroProfile(force);
    if (res.ok && res.profile) {
      setProfile(res.profile);
      setSummary(res.summary || res.profile.summary || "");
      setErr("");
    } else {
      setErr(res.error || "Nie udało się zbudować profilu");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const chips = (arr?: string[], color = "#FF6B00") =>
    (arr || []).filter(Boolean).slice(0, 6).map((x, i) => (
      <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${color}22`, color }}>
        {x}
      </span>
    ));

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#12101c]/80 p-5">
        <motion.div aria-hidden className="absolute -inset-10 -z-0 opacity-40 blur-2xl"
          style={{ background: "conic-gradient(from 0deg,#FF6B00,#9333EA,#FF9500,#FF6B00)" }}
          animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: "linear" }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <motion.div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#9333EA]"
                animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
                <Brain className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <h2 className="font-bold text-white leading-none">Twój Muzyczny Mózg</h2>
                <p className="text-[11px] text-white/50 mt-0.5">Aurora uczy się z Twoich zachowań</p>
              </div>
            </div>
            <button onClick={() => load(true)} disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/80 disabled:opacity-40">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Przeanalizuj
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-white/60 text-sm py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Buduję Twój mózg…
            </div>
          ) : err ? (
            <p className="text-sm text-white/60 py-4">{err}</p>
          ) : profile?.status === "za mało danych" ? (
            <p className="text-sm text-white/70 py-3">🎧 {summary || profile.hint}</p>
          ) : (
            <div className="space-y-3">
              {summary && <p className="text-sm text-white/85 leading-relaxed">{summary}</p>}
              {profile?.top_genres?.length ? <div className="flex flex-wrap gap-1.5"><span className="text-[11px] text-white/40 self-center flex items-center gap-1"><Sparkles className="h-3 w-3"/>Gatunki:</span>{chips(profile.top_genres, "#FF6B00")}</div> : null}
              {profile?.moods?.length ? <div className="flex flex-wrap gap-1.5"><span className="text-[11px] text-white/40 self-center flex items-center gap-1"><Heart className="h-3 w-3"/>Nastroje:</span>{chips(profile.moods, "#9333EA")}</div> : null}
              {profile?.dopamine_triggers?.length ? <div className="flex flex-wrap gap-1.5"><span className="text-[11px] text-white/40 self-center flex items-center gap-1"><Zap className="h-3 w-3"/>Dopamina:</span>{chips(profile.dopamine_triggers, "#FF9500")}</div> : null}
              {profile?.listening_times?.length ? <div className="flex flex-wrap gap-1.5"><span className="text-[11px] text-white/40 self-center flex items-center gap-1"><Clock className="h-3 w-3"/>Pory:</span>{chips(profile.listening_times, "#22d3ee")}</div> : null}
              {profile?.energy && <p className="text-[12px] text-white/60">Energia: <b className="text-white/85">{profile.energy}</b></p>}
              {profile?.recommendation && <p className="text-[12px] text-white/70 italic">💡 {profile.recommendation}</p>}
            </div>
          )}
        </div>
      </div>

      <NeuroSyncPanel />
    </div>
  );
}
