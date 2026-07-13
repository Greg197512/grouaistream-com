import { useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffects3D } from "@/contexts/Effects3DContext";

/**
 * Prawdziwy przechył 3D pod kursorem — kafelek/okładka wygląda jak wypukła,
 * żywa rzecz, którą oglądasz pod kątem. Działa TYLKO gdy tryb 3D jest włączony.
 * Pozycję liczymy z e.currentTarget, więc nie potrzeba refa (kompatybilne z DnD).
 */
export function useTilt3D(max = 9) {
  const { is3D } = useEffects3D();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 300, damping: 30 });
  const glowX = useTransform(mx, [-0.5, 0.5], ["0%", "100%"]);
  const glowY = useTransform(my, [-0.5, 0.5], ["0%", "100%"]);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!is3D) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return { is3D, rotateX, rotateY, glowX, glowY, onMove, onLeave };
}
