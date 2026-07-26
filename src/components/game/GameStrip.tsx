import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchGameState, type GameState } from "@/lib/hubGame";

// Pasek promujący grę „Wygraj swoją płytę" na stronie głównej / w radiu.
// Kompaktowy: lider czołówki, moje losy, odliczanie i wejście do gry.
export function GameStrip() {
  const [s, setS] = useState<GameState | null>(null);
  useEffect(() => { void fetchGameState().then(setS); }, []);

  if (!s?.round) return null;
  const leader = s.leaderboard?.[0];
  const daysLeft = Math.max(0, Math.ceil((new Date(s.round.ends_at).getTime() - Date.now()) / 86400000));

  return (
    <Link to="/wygraj" aria-label="Wygraj swoją płytę"
      className="group flex items-center gap-3 rounded-2xl border border-[#FF7A1A]/40 px-4 py-3 transition hover:border-[#FF7A1A]"
      style={{ background: "linear-gradient(100deg,#26130a,#1a0f27)" }}>
      <span className="relative h-11 w-11 flex-none rounded-full"
        style={{ background: "repeating-radial-gradient(circle, #111 0 2px, #1a1820 2px 4px)", animation: "gvspin 5s linear infinite" }}>
        <span className="absolute inset-[38%] rounded-full" style={{ background: "linear-gradient(135deg,#FF7A1A,#B026FF)" }} />
      </span>
      <style>{`@keyframes gvspin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){[style*=gvspin]{animation:none!important}}`}</style>
      <div className="min-w-0 flex-1">
        <div className="font-display font-extrabold text-sm truncate">
          🏆 Wygraj swoją płytę{leader ? ` — prowadzi ${leader.name}` : ""}
        </div>
        <div className="text-xs text-muted-foreground">
          {s.me ? `Masz ${s.me.tickets.toLocaleString("pl-PL")} losów` : "Graj i zbieraj losy"} · zostało {daysLeft} dni · {s.players} graczy
        </div>
      </div>
      <span className="flex-none rounded-full px-4 py-2 text-sm font-bold text-black group-hover:brightness-110"
        style={{ background: "linear-gradient(135deg,#FF7A1A,#FFB020)" }}>Graj</span>
    </Link>
  );
}
