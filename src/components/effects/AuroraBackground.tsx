import { motion } from "framer-motion";

export const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Solid base */}
      <div className="absolute inset-0 bg-background" />

      {/* Subtle blue radial accents */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(210_90%_55%/0.06),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(220_85%_60%/0.05),transparent_55%)]" />

      {/* Aurora blobs — blue, very transparent */}
      <motion.div
        animate={{
          x: [0, 120, -40, 0],
          y: [0, -80, 40, 0],
          scale: [1, 1.15, 0.95, 1],
          opacity: [0.08, 0.14, 0.06, 0.08],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[120px]"
        style={{ background: "hsl(210 90% 55% / 0.35)" }}
      />
      <motion.div
        animate={{
          x: [0, -120, 60, 0],
          y: [0, 60, -40, 0],
          scale: [1, 0.9, 1.2, 1],
          opacity: [0.06, 0.12, 0.05, 0.06],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/3 -right-32 h-[450px] w-[450px] rounded-full blur-[120px]"
        style={{ background: "hsl(195 85% 55% / 0.3)" }}
      />
      <motion.div
        animate={{
          x: [0, 80, -80, 0],
          y: [0, -60, 80, 0],
          opacity: [0.05, 0.1, 0.04, 0.05],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 7 }}
        className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full blur-[130px]"
        style={{ background: "hsl(220 90% 60% / 0.28)" }}
      />

      {/* Aurora ribbons — gentle blue waves */}
      <motion.div
        animate={{
          x: ["-20%", "10%", "-20%"],
          rotate: [-6, 3, -6],
          opacity: [0.08, 0.16, 0.08],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-0 right-0 h-[140px] blur-[60px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(210 90% 55% / 0.3) 45%, hsl(195 85% 60% / 0.25) 60%, transparent 100%)",
        }}
      />
      <motion.div
        animate={{
          x: ["10%", "-15%", "10%"],
          rotate: [4, -4, 4],
          opacity: [0.06, 0.14, 0.06],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-[65%] left-0 right-0 h-[120px] blur-[70px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(220 85% 60% / 0.28) 40%, hsl(210 90% 55% / 0.25) 65%, transparent 100%)",
        }}
      />

      {/* Floating blue particles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -700],
            x: [0, Math.sin(i) * 80],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 12 + i * 1.8,
            repeat: Infinity,
            delay: i * 1.6,
            ease: "linear",
          }}
          className="absolute rounded-full"
          style={{
            left: `${(i / 8) * 100}%`,
            bottom: `-${i * 5}px`,
            width: `${1 + (i % 2)}px`,
            height: `${1 + (i % 2)}px`,
            background: i % 2 === 0 ? "hsl(210 90% 65%)" : "hsl(195 85% 65%)",
            boxShadow:
              i % 2 === 0
                ? "0 0 6px hsl(210 90% 65%)"
                : "0 0 6px hsl(195 85% 65%)",
          }}
        />
      ))}

      {/* Light vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background)/0.4)_100%)]" />
    </div>
  );
};
