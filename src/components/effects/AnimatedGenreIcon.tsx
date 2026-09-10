// Animowane ikony gatunków — ten sam czytelny symbol (Material Icons), ale ożywiony
// inną mikro-animacją dopasowaną do gatunku. Wyjątek: "graphic_eq" renderowany jako
// prawdziwy, pulsujący equalizer. Czysty CSS (transform/opacity — tanie dla GPU).
// Animacje GASNĄ przy prefers-reduced-motion i <html data-lowpower> → statyczna ikona.
import { useEffect } from "react";
import { cn } from "@/lib/utils";

let injected = false;
function inject() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const css = `
@keyframes gi-twinkle { 0%,100%{transform:scale(1) rotate(-6deg);opacity:.82} 50%{transform:scale(1.18) rotate(6deg);opacity:1} }
@keyframes gi-flicker { 0%,100%{opacity:1;transform:scale(1)} 15%{opacity:.35} 30%{opacity:1;transform:scale(1.12)} 45%{opacity:.6} 60%{opacity:1} }
@keyframes gi-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2.5px)} }
@keyframes gi-beat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.22)} 30%{transform:scale(1)} 45%{transform:scale(1.14)} 60%{transform:scale(1)} }
@keyframes gi-spin { to{transform:rotate(360deg)} }
@keyframes gi-sway { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(6deg)} }
@keyframes gi-pulse { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.12);opacity:1} }
@keyframes gi-eq { 0%,100%{transform:scaleY(.35)} 50%{transform:scaleY(1)} }
.gi-anim{ display:inline-block; transform-origin:center; will-change:transform,opacity; }
.gi-eqbar{ transform-origin:bottom; will-change:transform; }
:root[data-lowpower] .gi-anim, :root[data-lowpower] .gi-eqbar{ animation:none !important; transform:none !important; }
@media (prefers-reduced-motion: reduce){ .gi-anim,.gi-eqbar{ animation:none !important; transform:none !important; } }`;
  const el = document.createElement("style");
  el.setAttribute("data-genre-icon", "");
  el.textContent = css;
  document.head.appendChild(el);
}

// Gatunek/ikona → animacja (czas + kształt ruchu).
const ANIM: Record<string, string> = {
  star: "gi-twinkle 2.2s ease-in-out infinite",           // Pop
  electric_bolt: "gi-flicker 2.6s ease-in-out infinite",  // Rock
  mic: "gi-bob 1.8s ease-in-out infinite",                // Hip-Hop
  headphones: "gi-bob 2.4s ease-in-out infinite",         // EDM
  favorite: "gi-beat 1.6s ease-in-out infinite",          // R&B
  nightlife: "gi-spin 6s linear infinite",                // Disco
  forest: "gi-sway 3.4s ease-in-out infinite",            // Folk
  agriculture: "gi-sway 3.8s ease-in-out infinite",       // Country
  explore: "gi-spin 9s linear infinite",                  // Inne
};

interface Props { icon: string; className?: string }

export function AnimatedGenreIcon({ icon, className }: Props) {
  useEffect(() => { inject(); }, []);

  // Equalizer — najbardziej „muzyczny" ruch: 4 słupki pulsujące w rytmie.
  if (icon === "graphic_eq") {
    const bars = [0, 0.18, 0.36, 0.12];
    return (
      <span aria-hidden className={cn("inline-flex items-end justify-center gap-[2px] align-middle", className)} style={{ height: "1.4em", width: "1.4em" }}>
        {bars.map((d, i) => (
          <span key={i} className="gi-eqbar" style={{
            width: "18%", height: "100%", borderRadius: "2px", background: "currentColor",
            animation: `gi-eq ${0.7 + i * 0.12}s ease-in-out ${d}s infinite`,
          }} />
        ))}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn("material-icons gi-anim", className)}
      style={{ animation: ANIM[icon] || "gi-pulse 2.4s ease-in-out infinite" }}
    >
      {icon}
    </span>
  );
}
