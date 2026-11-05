import { motion } from "framer-motion";
import { isTouchDevice } from "@/lib/perf";

// showFace zostaje w API dla zgodności, twarz nie jest już rysowana.
export const AuroraBackground = ({ lite = false }: { showFace?: boolean; lite?: boolean }) => {

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

  // Bez plam, wstęg i twarzy (prośba właściciela) — tylko spokojne, statyczne tło i drobne cząstki na komputerze.
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(268_100%_62%/0.10),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(331_100%_60%/0.08),transparent_55%)]" />

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
