import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchGameState, type GameState } from "@/lib/hubGame";

// Reklama gry „Wygraj swoją płytę" na stronie głównej — mocny, klikalny baner.
// Zawsze prowadzi na /wygraj. Pokazuje lidera, moje losy i odliczanie na żywo.
export function GameStrip() {
  const [s, setS] = useState<GameState | null>(null);
  useEffect(() => { void fetchGameState().then(setS); }, []);

  // Zawsze pokazuj baner (nawet zanim wczyta stan) — to reklama.
  const leader = s?.leaderboard?.[0];
  const daysLeft = s?.round ? Math.max(0, Math.ceil((new Date(s.round.ends_at).getTime() - Date.now()) / 86400000)) : null;

  return (
    <Link to="/wygraj" aria-label="Wygraj swoją płytę"
      className="group relative flex items-center gap-4 rounded-3xl border border-[#FF7A1A]/50 px-5 py-4 sm:px-6 sm:py-5 overflow-hidden transition hover:border-[#FF7A1A]"
      style={{ background: "linear-gradient(100deg,#2a1409,#1a0f27 60%,#160d20)", boxShadow: "0 12px 40px -16px rgba(255,122,26,.5)" }}>
      {/* przesuwający się połysk */}
      <span className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "linear-gradient(115deg,transparent 40%,rgba(255,255,255,.10) 50%,transparent 60%)", animation: "gvshimmer 4.5s linear infinite" }} />
      <style>{`@keyframes gvspin{to{transform:rotate(360deg)}}
        @keyframes gvshimmer{0%{transform:translateX(-60%)}100%{transform:translateX(60%)}}
        @media (prefers-reduced-motion:reduce){[style*=gvspin],[style*=gvshimmer]{animation:none!important}}`}</style>

      {/* realistyczne mini-CD */}
      <span className="relative h-14 w-14 sm:h-16 sm:w-16 flex-none rounded-full overflow-hidden" style={{ boxShadow: "0 6px 16px -2px #000" }}>
        <span className="absolute inset-0 rounded-full" style={{
          animation: "gvspin 5s linear infinite",
          background: [
            "radial-gradient(circle at 50% 50%, hsl(var(--background)) 0 13%, transparent 14%)",
            "radial-gradient(circle at 50% 50%, #e6e9ef 14% 23%, transparent 24%)",
            "repeating-radial-gradient(circle, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.08) 1px 2.5px)",
            "conic-gradient(from 0deg,#ff5db1,#ffd24d,#7dff9e,#5de1ff,#a98bff,#ff5db1)",
          ].join(","),
        }} />
        <span className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "linear-gradient(120deg,transparent 40%,rgba(255,255,255,.38) 48%,transparent 56%)" }} />
      </span>

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold tracking-widest text-[#ff5a4d] uppercase">● Konkurs</span>
          {daysLeft !== null && <span className="text-[10px] text-white/50 tabular-nums">zostało {daysLeft} dni</span>}
        </div>
        <div className="font-display font-extrabold text-lg sm:text-xl leading-tight text-white truncate">
          Dawaj muzykę — <span className="bg-gradient-to-r from-[#FF7A1A] via-[#FFB020] to-[#B026FF] bg-clip-text text-transparent">wygraj swoją płytę</span> 🏆
        </div>
        <div className="text-xs sm:text-sm text-white/60 truncate">
          {leader ? `Prowadzi ${leader.name}` : "Bądź pierwszy w czołówce"}
          {s?.me ? ` · masz ${s.me.tickets.toLocaleString("pl-PL")} losów` : " · graj i zbieraj losy"}
          {s?.players ? ` · ${s.players} graczy` : ""}
        </div>
      </div>

      <span className="relative flex-none rounded-full px-5 py-2.5 sm:px-7 sm:py-3 text-sm sm:text-base font-extrabold text-black group-hover:brightness-110 group-hover:scale-105 transition"
        style={{ background: "linear-gradient(135deg,#FF7A1A,#FFB020)", boxShadow: "0 6px 20px rgba(255,122,26,.5)" }}>
        Graj ▶
      </span>
    </Link>
  );
}
