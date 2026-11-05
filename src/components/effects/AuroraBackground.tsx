import { motion } from "framer-motion";
import { useAI } from "@/contexts/AIContext";
import auroraWomanFace from "@/assets/aurora-woman-face.jpg";
import { isTouchDevice } from "@/lib/perf";

export const AuroraBackground = ({ showFace = false, lite = false }: { showFace?: boolean; lite?: boolean }) => {
  const { isProcessing, isLLMReady } = useAI();

  // Tryb oszczędny (stare/słabe urządzenia): tylko tanie, STATYCZNE tło — bez
  // animowanych, mocno rozmytych plam (blur 120px), wstęg i cząstek, które
  // najbardziej obciążają GPU. Wygląd zostaje spójny, płynność ratujemy.
  if (lite || isTouchDevice()) {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(268_100%_62%/0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(331_100%_60%/0.08),transparent_55%)]" />
      </div>
    );
  }

  // Twarz pokazywana tylko gdy showFace=true (admin, b2b)
  const faceOpacity = !showFace || !isLLMReady ? 0 : isProcessing ? 0.55 : 0.18;
  const faceBlur = !isLLMReady ? 20 : isProcessing ? 0 : 6;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Solid base */}
      <div className="absolute inset-0 bg-background" />

      {/* Subtle neon radial accents (violet / magenta) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(268_100%_62%/0.10),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(331_100%_60%/0.08),transparent_55%)]" />

      {/* Aurora WOMAN FACE — ujawnia się gdy LLM gotowy */}
      <motion.div
        animate={{
          opacity: [faceOpacity * 0.85, faceOpacity, faceOpacity * 0.85],
          scale: [1, 1.03, 1],
        }}
        transition={{
          opacity: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{ willChange: "opacity, transform" }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <img
          src={auroraWomanFace}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover mix-blend-screen"
          style={{
            // Rozmycie na statycznym obrazku (liczone raz), a nie na animowanej warstwie (co klatkę).
            filter: faceBlur ? `blur(${faceBlur}px)` : undefined,
            transition: "filter 1.8s ease-out",
            maskImage:
              "radial-gradient(ellipse 60% 70% at center, black 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 70% at center, black 30%, transparent 80%)",
          }}
        />
      </motion.div>

      {/* Aurora blobs — niebieskie, transparentne */}
      <motion.div
        animate={{
          x: [0, 120, -40, 0],
          y: [0, -80, 40, 0],
          scale: [1, 1.15, 0.95, 1],
          opacity: [0.08, 0.14, 0.06, 0.08],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-40 -left-40 h-[1000px] w-[1000px] -ml-[250px] -mt-[250px]"
        style={{ background: "radial-gradient(circle, hsl(268 100% 62% / 0.38) 0%, transparent 60%)", willChange: "transform, opacity" }}
      />
      <motion.div
        animate={{
          x: [0, -120, 60, 0],
          y: [0, 60, -40, 0],
          scale: [1, 0.9, 1.2, 1],
          opacity: [0.06, 0.12, 0.05, 0.06],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/3 -right-32 h-[900px] w-[900px] -mr-[225px] -mt-[225px]"
        style={{ background: "radial-gradient(circle, hsl(331 100% 58% / 0.32) 0%, transparent 60%)", willChange: "transform, opacity" }}
      />
      <motion.div
        animate={{
          x: [0, 80, -80, 0],
          y: [0, -60, 80, 0],
          opacity: [0.05, 0.1, 0.04, 0.05],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 7 }}
        className="absolute bottom-0 left-1/4 h-[800px] w-[800px] -mb-[200px] -ml-[200px]"
        style={{ background: "radial-gradient(circle, hsl(189 100% 58% / 0.24) 0%, transparent 60%)", willChange: "transform, opacity" }}
      />

      {/* Aurora ribbons — niebieskie wstęgi */}
      <motion.div
        animate={{
          x: ["-20%", "10%", "-20%"],
          rotate: [-6, 3, -6],
          opacity: [0.08, 0.16, 0.08],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-0 right-0 h-[280px]"
        style={{
          willChange: "transform, opacity",
          maskImage: "linear-gradient(180deg, transparent, black 50%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, black 50%, transparent)",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(268 100% 62% / 0.32) 45%, hsl(331 100% 60% / 0.26) 60%, transparent 100%)",
        }}
      />
      <motion.div
        animate={{
          x: ["10%", "-15%", "10%"],
          rotate: [4, -4, 4],
          opacity: [0.06, 0.14, 0.06],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-[65%] left-0 right-0 h-[240px]"
        style={{
          willChange: "transform, opacity",
          maskImage: "linear-gradient(180deg, transparent, black 50%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, black 50%, transparent)",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(331 100% 60% / 0.26) 40%, hsl(268 100% 62% / 0.24) 65%, transparent 100%)",
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
            background: i % 2 === 0 ? "hsl(268 100% 70%)" : "hsl(331 100% 68%)",
            boxShadow:
              i % 2 === 0
                ? "0 0 6px hsl(268 100% 70%)"
                : "0 0 6px hsl(331 100% 68%)",
          }}
        />
      ))}

      {/* Light vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background)/0.4)_100%)]" />
    </div>
  );
};
