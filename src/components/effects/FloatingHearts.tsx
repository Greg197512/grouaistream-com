import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

const HEART_COLORS = ["#ff6b6b", "#ff8787", "#e64980", "#f06595", "#ff69b4", "#ff1493"];

export const useFloatingHearts = () => {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const spawnHearts = useCallback((e?: React.MouseEvent) => {
    const rect = e?.currentTarget?.getBoundingClientRect();
    const baseX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const baseY = rect ? rect.top : window.innerHeight / 2;

    const newHearts: FloatingHeart[] = [];
    const count = 12 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      newHearts.push({
        id: Date.now() + i + Math.random(),
        x: baseX + (Math.random() - 0.5) * 80,
        y: baseY + (Math.random() - 0.5) * 20,
        size: 12 + Math.random() * 16,
        color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      });
    }
    setHearts((prev) => [...prev, ...newHearts]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => !newHearts.find((nh) => nh.id === h.id)));
    }, 3500);
  }, []);

  return { hearts, spawnHearts };
};

export const FloatingHeartsOverlay = ({ hearts }: { hearts: FloatingHeart[] }) => (
  <div className="fixed inset-0 pointer-events-none z-[100]">
    <AnimatePresence>
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          initial={{ 
            x: heart.x, 
            y: heart.y, 
            opacity: 1, 
            scale: 0.3,
            rotate: Math.random() * 40 - 20 
          }}
          animate={{
            y: heart.y - 200 - Math.random() * 200,
            x: heart.x + (Math.random() - 0.5) * 120,
            opacity: 0,
            scale: 1 + Math.random() * 0.5,
            rotate: Math.random() * 60 - 30,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 + Math.random() * 1.5, ease: "easeOut" }}
          style={{ position: "fixed", fontSize: heart.size }}
          className="select-none"
        >
          <span style={{ color: heart.color }}>❤</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);
