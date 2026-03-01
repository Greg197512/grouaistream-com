import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import rockstarWalking from "@/assets/rockstar-avatar.png";
import rockstarSitting from "@/assets/rockstar-sitting.jpg";

const SPEECH_BUBBLES = [
  "Hej! Jestem GrouBot 🤖",
  "Potrzebujesz pomocy? 🎵",
  "Sprawdź nasze playlisty! 🎧",
  "AI dobierze muzykę do Twojego nastroju ✨",
  "Kliknij mnie po więcej! 🚀",
];

type Phase = "walking" | "arriving" | "sitting" | "blinking" | "idle";

export const StickmanAvatar = () => {
  const [phase, setPhase] = useState<Phase>("walking");
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState(SPEECH_BUBBLES[0]);
  const [isBlinking, setIsBlinking] = useState(false);
  const [bubbleIdx, setBubbleIdx] = useState(0);

  // Phase sequence: walking → arriving → blinking → sitting → idle
  useEffect(() => {
    // Start walking, after walk animation ends → arrive
    const walkTimer = setTimeout(() => setPhase("arriving"), 2200);
    return () => clearTimeout(walkTimer);
  }, []);

  useEffect(() => {
    if (phase === "arriving") {
      // Brief pause then blink
      const t = setTimeout(() => setPhase("blinking"), 300);
      return () => clearTimeout(t);
    }
    if (phase === "blinking") {
      setIsBlinking(true);
      const t1 = setTimeout(() => setIsBlinking(false), 200);
      const t2 = setTimeout(() => setIsBlinking(true), 400);
      const t3 = setTimeout(() => setIsBlinking(false), 600);
      const t4 = setTimeout(() => setPhase("sitting"), 900);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
    if (phase === "sitting") {
      const t = setTimeout(() => setPhase("idle"), 600);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Idle blinking loop
  useEffect(() => {
    if (phase !== "idle") return;
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 4000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleClick = useCallback(() => {
    const next = (bubbleIdx + 1) % SPEECH_BUBBLES.length;
    setBubbleIdx(next);
    setBubbleText(SPEECH_BUBBLES[next]);
    setShowBubble(true);
    setTimeout(() => setShowBubble(false), 3000);
  }, [bubbleIdx]);

  const isSitting = phase === "sitting" || phase === "idle";
  const isWalking = phase === "walking";

  return (
    <div
      className="absolute z-20 cursor-pointer select-none"
      style={{
        // Position: sits on top of the badge, right-aligned
        top: "-60px",
        right: "-10px",
      }}
      onClick={handleClick}
    >
      {/* Speech Bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.8 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-medium shadow-lg"
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid hsl(var(--primary) / 0.3)",
              color: "#fff",
            }}
          >
            {bubbleText}
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
              style={{
                background: "rgba(0,0,0,0.85)",
                borderRight: "1px solid hsl(var(--primary) / 0.3)",
                borderBottom: "1px solid hsl(var(--primary) / 0.3)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character */}
      <motion.div
        className="relative"
        initial={{ x: 200, opacity: 0 }}
        animate={
          isWalking
            ? { x: [200, 0], opacity: 1 }
            : { x: 0, opacity: isSitting ? [1, 0, 1] : 1 }
        }
        transition={
          isWalking
            ? { x: { duration: 2, ease: "easeOut" }, opacity: { duration: 0.3 } }
            : isSitting && phase === "sitting"
            ? { opacity: { duration: 0.5, times: [0, 0.3, 1] } }
            : { duration: 0.3 }
        }
      >
        {/* Walking bob animation */}
        <motion.div
          animate={
            isWalking
              ? { y: [0, -4, 0], rotate: [0, -2, 0, 2, 0] }
              : isSitting
              ? { y: [0, -2, 0] }
              : {}
          }
          transition={
            isWalking
              ? { duration: 0.4, repeat: 5, ease: "easeInOut" }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {/* Blink overlay */}
          <div className="relative" style={{ filter: isBlinking ? "brightness(0.7)" : "none" }}>
            <AnimatePresence mode="wait">
              {isSitting ? (
                <motion.img
                  key="sitting"
                  src={rockstarSitting}
                  alt="GrouBot sitting"
                  className="h-16 w-auto object-contain"
                  style={{ 
                    filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.3))",
                    mixBlendMode: "screen",
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  draggable={false}
                />
              ) : (
                <motion.img
                  key="walking"
                  src={rockstarWalking}
                  alt="GrouBot walking"
                  className="h-16 w-auto object-contain"
                  style={{ 
                    filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.3))",
                    mixBlendMode: "screen",
                  }}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  draggable={false}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
