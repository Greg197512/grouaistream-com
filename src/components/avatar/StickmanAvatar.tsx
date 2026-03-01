import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import grouBotImg from "@/assets/groubot-avatar.png";

const SPEECH_BUBBLES = [
  "Hej! Jestem GrouBot 🤖",
  "Potrzebujesz pomocy? 🎵",
  "Sprawdź nasze playlisty! 🎧",
  "AI dobierze muzykę do Twojego nastroju ✨",
  "Kliknij mnie po więcej! 🚀",
];

export const StickmanAvatar = () => {
  const [entered, setEntered] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState(SPEECH_BUBBLES[0]);
  const [posX, setPosX] = useState(-120);
  const [bodyLean, setBodyLean] = useState(0);
  const avatarRef = useRef<HTMLDivElement>(null);
  const bubbleIndex = useRef(0);
  const isRunning = useRef(true);

  // Entry animation - walk in from left
  useEffect(() => {
    const runIn = () => {
      setPosX(prev => {
        const target = 16;
        if (prev >= target - 1) {
          isRunning.current = false;
          setEntered(true);
          return target;
        }
        return prev + 4;
      });
      if (isRunning.current) requestAnimationFrame(runIn);
    };
    const t = setTimeout(runIn, 500);
    return () => clearTimeout(t);
  }, []);

  // Scroll reaction
  useEffect(() => {
    const handler = () => {
      setBodyLean(-6);
      setTimeout(() => setBodyLean(0), 400);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Click handler
  const handleClick = useCallback(() => {
    bubbleIndex.current = (bubbleIndex.current + 1) % SPEECH_BUBBLES.length;
    setBubbleText(SPEECH_BUBBLES[bubbleIndex.current]);
    setShowBubble(true);
    setTimeout(() => setShowBubble(false), 3000);
  }, []);

  return (
    <div
      ref={avatarRef}
      className="fixed bottom-24 z-40 cursor-pointer select-none"
      style={{ left: `${posX}px` }}
      onClick={handleClick}
    >
      {/* Speech Bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.8 }}
            className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-medium shadow-lg"
            style={{
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(12px)",
              border: "1px solid hsl(var(--primary) / 0.3)",
              color: "#fff",
            }}
          >
            {bubbleText}
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
              style={{
                background: "rgba(0,0,0,0.8)",
                borderRight: "1px solid hsl(var(--primary) / 0.3)",
                borderBottom: "1px solid hsl(var(--primary) / 0.3)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Image */}
      <motion.div
        className="relative"
        animate={{
          y: entered ? [0, -3, 0] : 0,
          rotate: bodyLean,
        }}
        transition={{
          y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0.3 },
        }}
        style={{ filter: "drop-shadow(0 0 12px hsl(var(--primary) / 0.4))" }}
      >
        {/* Glow ring */}
        <motion.div
          className="absolute -inset-1 rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)",
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <img
          src={grouBotImg}
          alt="GrouBot AI Assistant"
          className="w-16 h-20 object-cover object-top rounded-lg"
          draggable={false}
        />
      </motion.div>
    </div>
  );
};
