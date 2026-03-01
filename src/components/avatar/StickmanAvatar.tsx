import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

type AvatarState = "entering" | "idle" | "looking" | "waving" | "thinking" | "sitting" | "talking";

const SPEECH_BUBBLES = [
  "Hej! Jestem GrouBot 🤖",
  "Potrzebujesz pomocy? 🎵",
  "Sprawdź nasze playlisty! 🎧",
  "AI dobierze muzykę do Twojego nastroju ✨",
  "Kliknij mnie po więcej! 🚀",
];

export const StickmanAvatar = () => {
  const [state, setState] = useState<AvatarState>("entering");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState(SPEECH_BUBBLES[0]);
  const [posX, setPosX] = useState(-80);
  const [headTilt, setHeadTilt] = useState(0);
  const [eyeOffsetX, setEyeOffsetX] = useState(0);
  const [eyeOffsetY, setEyeOffsetY] = useState(0);
  const [armAngle, setArmAngle] = useState({ left: 0, right: 0 });
  const [legPhase, setLegPhase] = useState(0);
  const [bodyLean, setBodyLean] = useState(0);
  const avatarRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const bubbleIndex = useRef(0);
  const isRunning = useRef(true);

  // Entry animation
  useEffect(() => {
    setState("entering");
    let frame = 0;
    const runIn = () => {
      frame++;
      setPosX(prev => {
        const target = 40;
        if (prev >= target - 1) {
          isRunning.current = false;
          setState("looking");
          return target;
        }
        return prev + 3;
      });
      setLegPhase(prev => prev + 0.4);
      if (isRunning.current) requestAnimationFrame(runIn);
    };
    const t = setTimeout(runIn, 500);
    return () => clearTimeout(t);
  }, []);

  // Mouse tracking for eyes/head
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Calculate eye/head tracking
  useEffect(() => {
    if (!avatarRef.current || state === "entering") return;
    const rect = avatarRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + 20;
    const dx = mousePos.x - cx;
    const dy = mousePos.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxEye = 2.5;
    setEyeOffsetX(Math.max(-maxEye, Math.min(maxEye, (dx / (dist || 1)) * maxEye)));
    setEyeOffsetY(Math.max(-1.5, Math.min(1.5, (dy / (dist || 1)) * 1.5)));
    setHeadTilt(Math.max(-8, Math.min(8, dx / 60)));
  }, [mousePos, state]);

  // Idle behavior cycle
  useEffect(() => {
    if (state === "entering") return;
    const cycle = () => {
      const actions: AvatarState[] = ["idle", "looking", "waving", "thinking", "idle"];
      const next = actions[Math.floor(Math.random() * actions.length)];
      setState(next);

      if (next === "waving") {
        setArmAngle({ left: 0, right: -140 });
        setTimeout(() => setArmAngle({ left: 0, right: -120 }), 300);
        setTimeout(() => setArmAngle({ left: 0, right: -140 }), 600);
        setTimeout(() => {
          setArmAngle({ left: 0, right: 0 });
          setState("idle");
        }, 1200);
      } else if (next === "thinking") {
        setArmAngle({ left: 0, right: -90 });
        setBodyLean(-3);
        setTimeout(() => {
          setArmAngle({ left: 0, right: 0 });
          setBodyLean(0);
          setState("idle");
        }, 2500);
      }

      idleTimer.current = setTimeout(cycle, 3000 + Math.random() * 4000);
    };
    idleTimer.current = setTimeout(cycle, 2000);
    return () => clearTimeout(idleTimer.current);
  }, [state === "entering"]);

  // Scroll reaction
  useEffect(() => {
    const handler = () => {
      setBodyLean(prev => {
        setTimeout(() => setBodyLean(0), 400);
        return -6;
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Click handler
  const handleClick = useCallback(() => {
    bubbleIndex.current = (bubbleIndex.current + 1) % SPEECH_BUBBLES.length;
    setBubbleText(SPEECH_BUBBLES[bubbleIndex.current]);
    setShowBubble(true);
    setState("talking");
    setArmAngle({ left: -30, right: -30 });
    setTimeout(() => {
      setShowBubble(false);
      setArmAngle({ left: 0, right: 0 });
      setState("idle");
    }, 3000);
  }, []);

  // Idle breathing animation
  const breathe = state === "idle" || state === "looking";

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
            className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-medium shadow-lg"
            style={{
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,170,0,0.3)",
              color: "#fff",
            }}
          >
            {bubbleText}
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
              style={{ background: "rgba(0,0,0,0.75)", borderRight: "1px solid rgba(255,170,0,0.3)", borderBottom: "1px solid rgba(255,170,0,0.3)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stickman SVG */}
      <motion.svg
        width="56"
        height="80"
        viewBox="0 0 56 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{
          y: breathe ? [0, -2, 0] : 0,
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ filter: "drop-shadow(0 0 6px rgba(255,170,0,0.3))" }}
      >
        {/* Glow aura */}
        <motion.circle
          cx="28"
          cy="40"
          r="34"
          fill="none"
          stroke="url(#auraGrad)"
          strokeWidth="1"
          opacity="0.3"
          animate={{ r: [32, 36, 32], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Body group with lean */}
        <g transform={`rotate(${bodyLean}, 28, 45)`}>
          {/* Head */}
          <g transform={`rotate(${headTilt}, 28, 16)`}>
            <motion.circle
              cx="28"
              cy="14"
              r="9"
              stroke="url(#neonGrad)"
              strokeWidth="2"
              fill="rgba(0,0,0,0.4)"
              animate={state === "thinking" ? { cy: [14, 12, 14] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {/* Eyes */}
            <circle cx={24 + eyeOffsetX} cy={13 + eyeOffsetY} r="1.3" fill="#00ffaa" />
            <circle cx={32 + eyeOffsetX} cy={13 + eyeOffsetY} r="1.3" fill="#00ffaa" />
            {/* Mouth */}
            {state === "talking" ? (
              <motion.ellipse
                cx="28"
                cy="18"
                rx="2.5"
                ry="1.5"
                fill="none"
                stroke="#ffaa00"
                strokeWidth="1"
                animate={{ ry: [1, 2, 1] }}
                transition={{ duration: 0.3, repeat: Infinity }}
              />
            ) : state === "thinking" ? (
              <line x1="26" y1="18" x2="30" y2="18" stroke="#ffaa00" strokeWidth="1" strokeLinecap="round" />
            ) : (
              <path d="M25 17 Q28 20 31 17" stroke="#ffaa00" strokeWidth="1" fill="none" strokeLinecap="round" />
            )}
            {/* Antenna */}
            <motion.line
              x1="28"
              y1="5"
              x2="28"
              y2="1"
              stroke="#00ffaa"
              strokeWidth="1.2"
              strokeLinecap="round"
              animate={{ x2: [27, 29, 27] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.circle
              cx="28"
              cy="1"
              r="1.5"
              fill="#00ffaa"
              animate={{ opacity: [0.5, 1, 0.5], cx: [27, 29, 27] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </g>

          {/* Torso */}
          <line x1="28" y1="23" x2="28" y2="45" stroke="url(#neonGrad)" strokeWidth="2" strokeLinecap="round" />

          {/* Left arm */}
          <motion.line
            x1="28"
            y1="28"
            x2="16"
            y2="40"
            stroke="url(#neonGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{ transformOrigin: "28px 28px" }}
            animate={{ rotate: armAngle.left }}
          />

          {/* Right arm */}
          <motion.line
            x1="28"
            y1="28"
            x2="40"
            y2="40"
            stroke="url(#neonGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{ transformOrigin: "28px 28px" }}
            animate={{ rotate: armAngle.right }}
          />

          {/* Left leg */}
          <motion.line
            x1="28"
            y1="45"
            x2="20"
            y2="65"
            stroke="url(#neonGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            animate={
              state === "entering"
                ? { x2: [18, 24, 18] }
                : {}
            }
            transition={{ duration: 0.3, repeat: Infinity }}
          />

          {/* Right leg */}
          <motion.line
            x1="28"
            y1="45"
            x2="36"
            y2="65"
            stroke="url(#neonGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            animate={
              state === "entering"
                ? { x2: [38, 32, 38] }
                : {}
            }
            transition={{ duration: 0.3, repeat: Infinity }}
          />

          {/* Feet glow */}
          <motion.circle
            cx="20"
            cy="65"
            r="2"
            fill="#ffaa00"
            opacity="0.4"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.circle
            cx="36"
            cy="65"
            r="2"
            fill="#ffaa00"
            opacity="0.4"
            animate={{ opacity: [0.2, 0.5, 0.2], }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          />
        </g>

        {/* Gradients */}
        <defs>
          <linearGradient id="neonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ffaa" />
            <stop offset="50%" stopColor="#ffaa00" />
            <stop offset="100%" stopColor="#ff6600" />
          </linearGradient>
          <radialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffaa00" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00ffaa" stopOpacity="0" />
          </radialGradient>
        </defs>
      </motion.svg>
    </div>
  );
};
