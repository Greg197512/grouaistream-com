const SLOGANS = ["🎄 Święta z muzyką — kup coś, dostaj miesiąc VIP gratis", "🎁 Każde zamówienie = bilet z kodem VIP na 30 dni", "❄️ Noś swój dźwięk także zimą", "🎅 Prezent, który gra: Grouarock", "🔔 Wesołych Świąt od ekipy Grouarock", "⭐ Grouarock: noś swój dźwięk"];

/** Świąteczna oprawa: lampki, Mikołaj, pasek haseł (bez śniegu — na życzenie). */
export function XmasDecor() {
  const bulbs = Array.from({ length: 18 });
  return (
    <>
      <style>{`
        @keyframes xm-tw{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes xm-fly{0%{transform:translateX(-30vw) translateY(0) rotate(-4deg)}50%{transform:translateX(50vw) translateY(-26px) rotate(3deg)}100%{transform:translateX(130vw) translateY(10px) rotate(-3deg)}}
        @keyframes xm-sway{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}
        @keyframes xm-mq{to{transform:translateX(-50%)}}
        @keyframes xm-wave{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(12deg)}}
        .xm-b{display:inline-block;width:9px;height:12px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;margin:0 11px;animation:xm-tw 1.6s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.xm-b,.xm-mq{animation:none!important}}
        html[data-lowpower="on"] .xm-b,html[data-lowpower="on"] .xm-mq{animation:none!important}
      `}</style>
      <div aria-hidden className="pointer-events-none fixed bottom-0 right-2 z-[36]">
        <span className="absolute -top-1 right-[58%] whitespace-nowrap rounded-2xl bg-white px-3 py-1.5 text-sm font-black text-red-700 shadow-lg">Ho ho ho! 🎁</span>
        <img src="/shop/santa.png" alt="" decoding="async" className="block h-[18vh] w-auto sm:h-[30vh] sm:max-h-[260px]" />
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[45] flex justify-center overflow-hidden leading-none" style={{ height: 14 }}>
        {bulbs.map((_, i) => <i key={i} className="xm-b" style={{ background: ["#e11d2e", "#16a34a", "#f59e0b", "#2563eb", "#ec4899"][i % 5], animationDelay: `${(i % 7) * .22}s`, boxShadow: "0 0 10px currentColor", color: ["#e11d2e", "#16a34a", "#f59e0b", "#2563eb", "#ec4899"][i % 5], marginTop: i % 2 ? 2 : 0 }} />)}
      </div>
      <div className="relative overflow-hidden bg-gradient-to-r from-red-700 via-red-600 to-green-700 py-2 text-white" role="marquee" aria-label="Hasła świąteczne">
        <div className="xm-mq inline-block whitespace-nowrap text-sm font-bold tracking-wide" style={{ animation: "xm-mq 36s linear infinite" }}>
          {[...SLOGANS, ...SLOGANS, ...SLOGANS, ...SLOGANS].map((s, i) => <span key={i} className="mx-8">{s}</span>)}
        </div>
      </div>
    </>
  );
}
