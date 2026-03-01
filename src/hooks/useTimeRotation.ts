import { useState, useEffect } from "react";

// Rotates a theme index every 2 hours for subtle UI changes
const ROTATION_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface ThemeRotation {
  index: number;
  gradientSet: string[];
  accentHue: number;
  bgOverlay: string;
  particleColor: string;
}

const THEME_SETS: ThemeRotation[] = [
  {
    index: 0,
    gradientSet: ["from-orange-600/20", "via-amber-500/10", "to-red-600/20"],
    accentHue: 25,
    bgOverlay: "radial-gradient(ellipse at 30% 50%, hsl(25 90% 45% / 0.08), transparent 70%)",
    particleColor: "hsl(25 90% 55%)",
  },
  {
    index: 1,
    gradientSet: ["from-violet-600/20", "via-purple-500/10", "to-indigo-600/20"],
    accentHue: 270,
    bgOverlay: "radial-gradient(ellipse at 70% 30%, hsl(270 70% 50% / 0.08), transparent 70%)",
    particleColor: "hsl(270 70% 60%)",
  },
  {
    index: 2,
    gradientSet: ["from-emerald-600/20", "via-teal-500/10", "to-cyan-600/20"],
    accentHue: 160,
    bgOverlay: "radial-gradient(ellipse at 50% 70%, hsl(160 60% 40% / 0.08), transparent 70%)",
    particleColor: "hsl(160 60% 50%)",
  },
  {
    index: 3,
    gradientSet: ["from-rose-600/20", "via-pink-500/10", "to-fuchsia-600/20"],
    accentHue: 340,
    bgOverlay: "radial-gradient(ellipse at 20% 80%, hsl(340 80% 50% / 0.08), transparent 70%)",
    particleColor: "hsl(340 80% 55%)",
  },
  {
    index: 4,
    gradientSet: ["from-sky-600/20", "via-blue-500/10", "to-indigo-600/20"],
    accentHue: 210,
    bgOverlay: "radial-gradient(ellipse at 80% 40%, hsl(210 70% 45% / 0.08), transparent 70%)",
    particleColor: "hsl(210 70% 55%)",
  },
  {
    index: 5,
    gradientSet: ["from-amber-600/20", "via-yellow-500/10", "to-orange-600/20"],
    accentHue: 40,
    bgOverlay: "radial-gradient(ellipse at 40% 60%, hsl(40 90% 50% / 0.08), transparent 70%)",
    particleColor: "hsl(40 90% 55%)",
  },
];

function getCurrentIndex(): number {
  const hoursSinceEpoch = Math.floor(Date.now() / ROTATION_INTERVAL_MS);
  return hoursSinceEpoch % THEME_SETS.length;
}

export function useTimeRotation(): ThemeRotation {
  const [rotation, setRotation] = useState<ThemeRotation>(() => THEME_SETS[getCurrentIndex()]);

  useEffect(() => {
    const check = () => {
      const idx = getCurrentIndex();
      setRotation(prev => prev.index !== idx ? THEME_SETS[idx] : prev);
    };
    const id = setInterval(check, 60_000); // check every minute
    return () => clearInterval(id);
  }, []);

  return rotation;
}
