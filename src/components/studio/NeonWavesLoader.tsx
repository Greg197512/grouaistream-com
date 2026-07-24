import { motion } from "framer-motion";
import { useMemo } from "react";

export const NeonWavesLoader = () => {
  const bars = Array.from({ length: 24 });

  // Generate random values ONCE during render, not during animation
  const barConfig = useMemo(() => bars.map(() => ({
    height1: 40 + Math.random() * 24,
    height2: 48 + Math.random() * 16,
    duration: 1.2 + Math.random() * 0.6,
  })), []);

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="flex items-end gap-1 h-16">
        {bars.map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-full"
            style={{
              background: `linear-gradient(to top, #FF6B00, #FF9500)`,
              boxShadow: "0 0 8px #FF6B0080",
            }}
            animate={{
              height: [8, barConfig[i].height1, 12, barConfig[i].height2, 8],
            }}
            transition={{
              duration: barConfig[i].duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.05,
            }}
          />
        ))}
      </div>
      <motion.p
        className="text-[#FF9500] font-medium text-sm"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Tworzę Twój utwór...
      </motion.p>
    </div>
  );
};
