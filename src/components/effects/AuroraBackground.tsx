import { motion } from "framer-motion";

export const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Aurora blobs */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -80, 40, 0],
          scale: [1, 1.2, 0.9, 1],
          opacity: [0.08, 0.15, 0.05, 0.08],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/30 blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, -120, 60, 0],
          y: [0, 60, -40, 0],
          scale: [1, 0.8, 1.3, 1],
          opacity: [0.06, 0.12, 0.04, 0.06],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/3 -right-20 h-[500px] w-[500px] rounded-full bg-accent/25 blur-[100px]"
      />
      <motion.div
        animate={{
          x: [0, 80, -80, 0],
          y: [0, -60, 80, 0],
          opacity: [0.04, 0.1, 0.03, 0.04],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 7 }}
        className="absolute bottom-20 left-1/3 h-[400px] w-[400px] rounded-full bg-primary/20 blur-[140px]"
      />

      {/* Shimmer flash effect */}
      <motion.div
        animate={{
          opacity: [0, 0, 0, 0.06, 0, 0, 0, 0, 0.04, 0, 0, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-accent/10"
      />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -800],
            x: [0, Math.sin(i) * 100],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 8 + Math.random() * 12,
            repeat: Infinity,
            delay: Math.random() * 10,
            ease: "linear",
          }}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            bottom: `-${Math.random() * 50}px`,
            width: `${1 + Math.random() * 3}px`,
            height: `${1 + Math.random() * 3}px`,
            background: i % 2 === 0 
              ? 'hsl(var(--primary))' 
              : 'hsl(var(--accent))',
          }}
        />
      ))}

      {/* Scan line effect */}
      <motion.div
        animate={{ y: ["-100%", "200%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
      />
    </div>
  );
};
