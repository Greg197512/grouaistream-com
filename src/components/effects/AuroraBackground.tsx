import { motion } from "framer-motion";

export const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Deep base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.12),transparent_55%)]" />

      {/* Aurora blobs — bigger & more vivid */}
      <motion.div
        animate={{
          x: [0, 140, -60, 0],
          y: [0, -100, 60, 0],
          scale: [1, 1.25, 0.9, 1],
          opacity: [0.35, 0.55, 0.25, 0.35],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-48 -left-48 h-[700px] w-[700px] rounded-full bg-primary/40 blur-[140px]"
      />
      <motion.div
        animate={{
          x: [0, -160, 80, 0],
          y: [0, 80, -60, 0],
          scale: [1, 0.85, 1.35, 1],
          opacity: [0.3, 0.5, 0.2, 0.3],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/4 -right-32 h-[620px] w-[620px] rounded-full bg-accent/35 blur-[130px]"
      />
      <motion.div
        animate={{
          x: [0, 100, -100, 0],
          y: [0, -80, 100, 0],
          opacity: [0.25, 0.45, 0.2, 0.25],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 7 }}
        className="absolute bottom-10 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/30 blur-[150px]"
      />
      <motion.div
        animate={{
          x: [0, -80, 120, 0],
          y: [0, 100, -50, 0],
          opacity: [0.2, 0.4, 0.15, 0.2],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-1/2 left-1/2 h-[450px] w-[450px] rounded-full bg-accent/30 blur-[120px]"
      />

      {/* Aurora ribbons — flowing waves like northern lights */}
      <motion.div
        animate={{
          x: ["-20%", "10%", "-20%"],
          rotate: [-8, 4, -8],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[15%] left-0 right-0 h-[180px] blur-[60px]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.5) 40%, hsl(var(--accent)/0.45) 60%, transparent 100%)",
        }}
      />
      <motion.div
        animate={{
          x: ["10%", "-15%", "10%"],
          rotate: [6, -4, 6],
          opacity: [0.35, 0.6, 0.35],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute top-[55%] left-0 right-0 h-[160px] blur-[70px]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(var(--accent)/0.5) 35%, hsl(var(--primary)/0.45) 65%, transparent 100%)",
        }}
      />
      <motion.div
        animate={{
          x: ["-10%", "15%", "-10%"],
          rotate: [-3, 6, -3],
          opacity: [0.3, 0.55, 0.3],
        }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut", delay: 9 }}
        className="absolute top-[80%] left-0 right-0 h-[140px] blur-[80px]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.4) 50%, transparent 100%)",
        }}
      />

      {/* Shimmer flash effect */}
      <motion.div
        animate={{
          opacity: [0, 0, 0, 0.12, 0, 0, 0, 0, 0.08, 0, 0, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-transparent to-accent/15"
      />

      {/* Floating particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -800],
            x: [0, Math.sin(i) * 120],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 10 + i * 1.5,
            repeat: Infinity,
            delay: i * 1.2,
            ease: "linear",
          }}
          className="absolute rounded-full"
          style={{
            left: `${(i / 12) * 100}%`,
            bottom: `-${i * 5}px`,
            width: `${1 + (i % 3)}px`,
            height: `${1 + (i % 3)}px`,
            background: i % 2 === 0
              ? 'hsl(var(--primary))'
              : 'hsl(var(--accent))',
            boxShadow: i % 2 === 0
              ? '0 0 8px hsl(var(--primary))'
              : '0 0 8px hsl(var(--accent))',
          }}
        />
      ))}

      {/* Scan line effect */}
      <motion.div
        animate={{ y: ["-100%", "200%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />

      {/* Subtle vignette to keep content readable */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background)/0.6)_100%)]" />
    </div>
  );
};
