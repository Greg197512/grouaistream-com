// Żywy, animowany płomień zamiast statycznej ikonki „Flame". Czysty CSS
// (ostry w małym rozmiarze, tani dla GPU — tylko transform/opacity). Migotanie
// automatycznie GAŚNIE przy prefers-reduced-motion i <html data-lowpower>
// (wtedy pokazuje spokojny, statyczny płomień). Rozmiar sterowany propem.
import { useEffect } from "react";

let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const css = `
@keyframes flame-flicker {
  0%,100% { transform: translate(-50%, 0) scale(1, 1) rotate(-1deg); opacity: .95; }
  25%     { transform: translate(-50%, -4%) scale(1.06, 1.12) rotate(1deg); opacity: 1; }
  50%     { transform: translate(-50%, 1%) scale(.94, .96) rotate(-2deg); opacity: .9; }
  75%     { transform: translate(-50%, -2%) scale(1.03, 1.08) rotate(1.5deg); opacity: 1; }
}
@keyframes flame-flicker2 {
  0%,100% { transform: translate(-50%, 0) scale(1, 1); opacity: .9; }
  33%     { transform: translate(-50%, -6%) scale(1.1, 1.15); opacity: 1; }
  66%     { transform: translate(-50%, 2%) scale(.9, .92); opacity: .85; }
}
@keyframes flame-core {
  0%,100% { transform: translate(-50%, 10%) scale(1); opacity: .95; }
  50%     { transform: translate(-50%, 4%) scale(1.15); opacity: 1; }
}
@keyframes flame-glow {
  0%,100% { opacity: .35; transform: translate(-50%,-50%) scale(1); }
  50%     { opacity: .6;  transform: translate(-50%,-50%) scale(1.18); }
}
.flame-lyr { position:absolute; bottom:0; left:50%; border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;
  transform-origin:50% 100%; will-change:transform,opacity; }
:root[data-lowpower] .flame-anim, .flame-anim.flame-static { animation:none !important; }
@media (prefers-reduced-motion: reduce){ .flame-anim { animation:none !important; } }`;
  const el = document.createElement("style");
  el.setAttribute("data-flame", "");
  el.textContent = css;
  document.head.appendChild(el);
}

interface Props { size?: number; className?: string }

export function FlameIcon({ size = 22, className }: Props) {
  useEffect(() => { injectKeyframes(); }, []);
  const w = size, h = size * 1.15;
  return (
    <span
      aria-hidden
      className={className}
      style={{ position: "relative", display: "inline-block", width: w, height: h, verticalAlign: "middle" }}
    >
      {/* poświata */}
      <span style={{
        position: "absolute", top: "55%", left: "50%", width: w * 1.5, height: w * 1.5,
        background: "radial-gradient(circle, rgba(255,140,20,0.55), transparent 65%)",
        borderRadius: "50%", filter: "blur(4px)",
        animation: "flame-glow 1.6s ease-in-out infinite",
      }} className="flame-anim" />
      {/* płomień zewnętrzny (pomarańcz) */}
      <span className="flame-lyr flame-anim" style={{
        width: w * 0.7, height: h * 0.92,
        background: "linear-gradient(to top, #ff7a1a 0%, #ff9b1f 45%, #ffd24d 100%)",
        boxShadow: "0 0 8px rgba(255,120,26,0.7)",
        animation: "flame-flicker 0.9s ease-in-out infinite",
      }} />
      {/* płomień wewnętrzny (żółty) */}
      <span className="flame-lyr flame-anim" style={{
        width: w * 0.42, height: h * 0.62,
        background: "linear-gradient(to top, #ffb020 0%, #ffe27a 60%, #fff1c2 100%)",
        animation: "flame-flicker2 0.7s ease-in-out infinite",
      }} />
      {/* rdzeń (biel) */}
      <span className="flame-lyr flame-anim" style={{
        width: w * 0.22, height: h * 0.34,
        background: "linear-gradient(to top, #ffd24d, #ffffff)",
        borderRadius: "50%",
        animation: "flame-core 0.6s ease-in-out infinite",
      }} />
    </span>
  );
}
