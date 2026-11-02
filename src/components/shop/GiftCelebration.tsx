import { useEffect, useMemo, useState } from "react";
import { playFanfare } from "@/lib/fanfare";
import { toast } from "sonner";

/** Pełnoekranowa celebracja: fanfary, konfetti, animowany bilet z kodem VIP. */
export function GiftCelebration({ code, onClose, onGo }: { code: string; onClose: () => void; onGo: () => void }) {
  const [stage, setStage] = useState(0);
  const conf = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ l: Math.random() * 100, d: Math.random() * 2.2, t: 2.6 + Math.random() * 2.6, c: ["#e11d2e", "#16a34a", "#f59e0b", "#2563eb", "#ec4899", "#fff"][i % 6], r: Math.random() * 360 })), []);
  useEffect(() => { playFanfare(); const a = setTimeout(() => setStage(1), 350); const b = setTimeout(() => setStage(2), 1500); return () => { clearTimeout(a); clearTimeout(b); }; }, []);
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast.success("Kod skopiowany"); } catch { toast.error("Zaznacz kod i skopiuj ręcznie"); } };
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-neutral-950/80 backdrop-blur-sm" role="dialog" aria-label="Twój bilet podarunkowy">
      <style>{`
        @keyframes gc-fall{0%{transform:translateY(-10vh) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}
        @keyframes gc-in{0%{transform:translateY(60px) scale(.3) rotateX(70deg);opacity:0}60%{transform:translateY(-10px) scale(1.06) rotateX(0);opacity:1}100%{transform:none;opacity:1}}
        @keyframes gc-shine{0%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
        @keyframes gc-pulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}50%{box-shadow:0 0 0 18px rgba(245,158,11,0)}}
        @keyframes gc-glow{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.25);opacity:1}}
        @media (prefers-reduced-motion: reduce){.gc-a{animation:none!important}}
      `}</style>
      {conf.map((c, i) => <i key={i} aria-hidden className="gc-a absolute top-0 block h-3 w-2 rounded-sm" style={{ left: `${c.l}%`, background: c.c, animation: `gc-fall ${c.t}s linear ${c.d}s infinite`, transform: `rotate(${c.r}deg)` }} />)}
      <div className="relative w-[min(92vw,640px)] px-2 text-center text-white">
        <div className="gc-a absolute left-1/2 top-1/2 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/40 blur-3xl" style={{ animation: "gc-glow 2.4s ease-in-out infinite" }} />
        <p className="text-sm font-bold uppercase tracking-[.3em] text-amber-300" style={{ opacity: stage >= 1 ? 1 : 0, transition: "opacity .6s" }}>Dziękujemy za zakup!</p>
        <h2 className="mt-2 text-4xl font-black sm:text-5xl" style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? "none" : "translateY(20px)", transition: "all .7s" }}>🎁 Masz bilet na <span className="text-amber-300">VIP</span></h2>
        <div className="gc-a relative mx-auto mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF8F0] to-[#FFE0EC] p-1 text-neutral-900 shadow-2xl" style={{ animation: "gc-in 1.1s cubic-bezier(.2,.8,.2,1) both", perspective: 800 }}>
          <div className="grid grid-cols-[1fr_auto] items-stretch rounded-[22px] border-2 border-dashed border-orange-400">
            <div className="p-5 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Świąteczny bilet podarunkowy</p>
              <p className="text-3xl font-black leading-none sm:text-4xl">GROUAISTREAM</p>
              <p className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-lg font-black text-transparent">VIP na 30 dni za darmo</p>
              <p className="mt-3 text-xs text-neutral-500">Wklej kod w pasku wyszukiwania w Grouaistream — system sam go rozpozna.</p>
            </div>
            <div className="flex min-w-[140px] flex-col items-center justify-center bg-neutral-900 p-4 text-white">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Twój kod</span>
              <span className="gc-a mt-1 select-all rounded-lg bg-amber-400 px-3 py-2 font-mono text-lg font-black tracking-wider text-neutral-900" style={{ animation: "gc-pulse 1.8s infinite" }}>{code}</span>
            </div>
          </div>
          <span aria-hidden className="gc-a pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" style={{ animation: "gc-shine 2.6s ease-in-out 1.2s infinite" }} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3" style={{ opacity: stage >= 2 ? 1 : 0, transition: "opacity .6s" }}>
          <button type="button" onClick={copy} className="h-12 rounded-full bg-amber-400 px-6 font-bold text-neutral-900 transition hover:scale-105">Kopiuj kod</button>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(code).catch(() => {}); onGo(); }} className="h-12 rounded-full bg-white px-6 font-bold text-neutral-900 transition hover:scale-105">Wklej w Grouaistream →</button>
          <button type="button" onClick={onClose} className="h-12 rounded-full border border-white/50 px-5 text-white/90">Później</button>
        </div>
      </div>
    </div>
  );
}
