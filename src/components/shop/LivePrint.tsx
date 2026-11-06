// „Żywy” nadruk na zdjęciu produktu: nadruk mieni się kolorami, przesuwa się po nim błysk światła,
// a linie „korektora” płyną w górę — tylko w miejscach, gdzie jest grafika (maska z pliku nadruku, jasne = widoczne).
// Animacja działa tylko na ekranie (IntersectionObserver); „ogranicz ruch” i słaby sprzęt = bez ruchu.
import { useEffect, useRef, useState } from "react";

/** box = [x, y, szer., wys.] nadruku na kwadratowym zdjęciu, w ułamkach 0–1. */
export type PrintFx = { mask: string; box: [number, number, number, number] };

const CSS = `
@keyframes lp-sheen{0%{background-position:160% 0}100%{background-position:-60% 0}}
@keyframes lp-flow{0%{background-position:0 0}100%{background-position:200% 0}}
@keyframes lp-scan{0%{background-position:0 0}100%{background-position:0 -40px}}
@keyframes lp-pulse{0%,100%{opacity:.18}50%{opacity:.5}}
.lp{position:absolute;pointer-events:none;-webkit-mask-size:100% 100%;mask-size:100% 100%;mask-mode:luminance;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}
.lp>i{position:absolute;inset:0}
.lp .s{background:linear-gradient(110deg,transparent 38%,rgba(255,255,255,.95) 50%,transparent 62%);background-size:300% 100%;mix-blend-mode:screen;animation:lp-sheen 3.4s ease-in-out infinite}
.lp .f{background:linear-gradient(90deg,#ff2bd6,#00e5ff,#ffd166,#ff6b00,#ff2bd6);background-size:200% 100%;mix-blend-mode:overlay;animation:lp-flow 5s linear infinite,lp-pulse 2.6s ease-in-out infinite}
.lp .e{background:repeating-linear-gradient(0deg,transparent 0 14px,rgba(255,255,255,.35) 14px 18px,transparent 18px 40px);mix-blend-mode:screen;opacity:.6;animation:lp-scan .9s linear infinite}
.lp.off>i{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.lp>i{animation:none!important}.lp .s,.lp .e{display:none}}
html[data-lowpower="on"] .lp{display:none}
`;
let injected = false;

/** `aspect` = szerokość/wysokość kontenera (karta 4:5 = 0.8; kwadrat = 1) — zdjęcie jest kwadratowe (object-cover). */
export function LivePrint({ fx, aspect = 1 }: { fx: PrintFx; aspect?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!injected && typeof document !== "undefined") { const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); injected = true; }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: "60px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  let [x, y, w, h] = fx.box;
  // Kwadratowe zdjęcie w kontenerze o innych proporcjach (object-cover) — przeliczenie pola nadruku.
  if (aspect < 1) { x = (x - (1 - aspect) / 2) / aspect; w = w / aspect; }
  else if (aspect > 1) { const a = 1 / aspect; y = (y - (1 - a) / 2) / a; h = h / a; }
  const mask = `url(${fx.mask})`;
  return (
    <div ref={ref} aria-hidden className={`lp ${on ? "" : "off"}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, WebkitMaskImage: mask, maskImage: mask }}>
      <i className="f" /><i className="s" /><i className="e" />
    </div>
  );
}
