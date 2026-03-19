import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  shape: "square" | "circle" | "star";
}

const COLORS = [
  "hsl(var(--primary))",
  "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
  "#ff69b4", "#a855f7", "#06d6a0", "#ff8800",
];

const createParticles = (count: number): Particle[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 10,
    y: 40,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 10,
    rotation: Math.random() * 360,
    shape: (["square", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
  }));

export const WelcomeConfetti = ({ show, onComplete }: { show: boolean; onComplete: () => void }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (show) {
      setParticles(createParticles(80));
      const timer = setTimeout(onComplete, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
        >
          {/* Glow background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0.1, 0] }}
            transition={{ duration: 3.5 }}
            className="absolute inset-0"
            style={{
              background: "radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.4), transparent 70%)",
            }}
          />

          {/* Welcome text */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1, 0.9], y: [20, 0, 0, -30] }}
            transition={{ duration: 3.5, times: [0, 0.2, 0.7, 1] }}
            className="text-center z-10 pointer-events-auto"
          >
            <motion.div
              className="text-5xl md:text-7xl mb-4"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              🎉
            </motion.div>
            <h1
              className="font-display text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
              style={{ textShadow: "0 0 40px hsl(var(--primary) / 0.5)" }}
            >
              Witaj w GrouAI!
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 3, delay: 0.5 }}
              className="text-muted-foreground text-lg mt-3"
            >
              Twoja muzyczna podróż zaczyna się teraz ✨
            </motion.p>
          </motion.div>

          {/* Confetti particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                opacity: 1,
                scale: 0,
                rotate: 0,
              }}
              animate={{
                left: `${p.x + (Math.random() - 0.5) * 80}%`,
                top: `${p.y + 30 + Math.random() * 50}%`,
                opacity: [0, 1, 1, 0],
                scale: [0, 1.2, 1, 0.5],
                rotate: p.rotation + Math.random() * 720 - 360,
              }}
              transition={{
                duration: 2.5 + Math.random() * 1.5,
                delay: Math.random() * 0.6,
                ease: "easeOut",
              }}
              className="absolute"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.shape === "circle" ? "50%" : p.shape === "star" ? "2px" : "2px",
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
