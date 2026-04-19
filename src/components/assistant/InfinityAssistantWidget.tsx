import { useState, useEffect, useRef } from "react";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import { Mic, MicOff, MessageCircle, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import aiAssistantAvatar from "@/assets/ai-assistant-avatar.jpg";

const TOOLTIP_KEY = "grouai_widget_tooltips_shown";

const CloudTooltip = ({ children, visible }: { children: React.ReactNode; visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none z-50 whitespace-nowrap"
      >
        <div
          className="relative px-4 py-2 rounded-2xl text-[11px] font-medium text-foreground/90"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          {children}
          {/* Cloud tail */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
              borderRight: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const InfinityAssistantWidget = () => {
  const dragControls = useDragControls();
  const [micActive, setMicActive] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hoveredLobe, setHoveredLobe] = useState<"mic" | "chat" | null>(null);
  const [showTooltips, setShowTooltips] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const prevUserId = useRef<string | null>(null);

  // Determine if tooltips should show (first time after login)
  useEffect(() => {
    if (!user) {
      prevUserId.current = null;
      setShowTooltips(false);
      return;
    }
    const key = `${TOOLTIP_KEY}_${user.id}`;
    const alreadyShown = localStorage.getItem(key);
    if (!alreadyShown) {
      setShowTooltips(true);
      localStorage.setItem(key, "true");
    }
    prevUserId.current = user.id;
  }, [user]);

  // Auto-hide tooltips after any hover interaction
  const handleHoverDone = () => {
    setHoveredLobe(null);
  };

  // Listen for state updates from child components
  useEffect(() => {
    const onMicState = (e: Event) => setMicActive((e as CustomEvent).detail);
    const onChatState = (e: Event) => setChatOpen((e as CustomEvent).detail);
    window.addEventListener("voice-mic-state", onMicState);
    window.addEventListener("chat-open-state", onChatState);
    return () => {
      window.removeEventListener("voice-mic-state", onMicState);
      window.removeEventListener("chat-open-state", onChatState);
    };
  }, []);

  const toggleMic = () => {
    setShowTooltips(false);
    window.dispatchEvent(new CustomEvent("toggle-voice-mic"));
  };

  const toggleChat = () => {
    setShowTooltips(false);
    window.dispatchEvent(new CustomEvent("toggle-chat-assistant"));
  };

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{
        left: -(window.innerWidth - 120),
        right: 0,
        top: -(window.innerHeight - 80),
        bottom: 0,
      }}
      className="fixed bottom-36 md:bottom-32 right-3 z-[60] select-none touch-none"
      style={{ cursor: "grab" }}
    >
      {/* Drag handle */}
      <motion.div
        onPointerDown={(e) => dragControls.start(e)}
        className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <div
          className="px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground/40" />
        </div>
      </motion.div>

      {/* Infinity shape container */}
      <div className="relative flex items-center">
        {/* Left lobe - Voice Mic */}
        <div className="relative">
          {showTooltips && (
            <CloudTooltip visible={hoveredLobe === "mic"}>
              🎤 {t("widget.micTooltip") || "Asystent głosowy — mów do AI"}
            </CloudTooltip>
          )}
          <motion.button
            onClick={toggleMic}
            onMouseEnter={() => showTooltips && setHoveredLobe("mic")}
            onMouseLeave={handleHoverDone}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative w-12 h-12 rounded-full flex items-center justify-center transition-all z-10",
              micActive && "shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
            )}
            style={{
              background: micActive
                ? "linear-gradient(135deg, hsl(var(--primary) / 0.7), hsl(var(--accent) / 0.5))"
                : "rgba(10, 10, 15, 0.7)",
              backdropFilter: "blur(40px) saturate(200%)",
              WebkitBackdropFilter: "blur(40px) saturate(200%)",
              border: micActive
                ? "2px solid hsl(var(--primary) / 0.4)"
                : "2px solid rgba(255,255,255,0.1)",
            }}
            title="Asystent głosowy"
          >
            {micActive ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                <Mic className="h-5 w-5 text-primary-foreground" />
              </motion.div>
            ) : (
              <MicOff className="h-5 w-5 text-muted-foreground/70" />
            )}

            {micActive && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ border: "1px solid hsl(var(--primary) / 0.3)" }}
                  animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ border: "1px solid hsl(var(--accent) / 0.2)" }}
                  animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut", delay: 0.3 }}
                />
              </>
            )}
          </motion.button>
        </div>

        {/* Center bridge */}
        <div
          className="w-4 h-6 -mx-2 z-20 flex items-center justify-center relative"
          style={{
            background: "linear-gradient(90deg, rgba(10,10,15,0.6), rgba(10,10,15,0.8), rgba(10,10,15,0.6))",
          }}
        >
          <div className="w-full h-px bg-gradient-to-r from-primary/30 via-accent/50 to-primary/30" />
          <motion.div
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
              boxShadow: "0 0 8px hsl(var(--primary) / 0.5)",
            }}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Right lobe - Text Chat */}
        <div className="relative">
          {showTooltips && (
            <CloudTooltip visible={hoveredLobe === "chat"}>
              💬 {t("widget.chatTooltip") || "Czat z AI — pisz i pytaj o wszystko"}
            </CloudTooltip>
          )}
          <motion.button
            onClick={toggleChat}
            onMouseEnter={() => showTooltips && setHoveredLobe("chat")}
            onMouseLeave={handleHoverDone}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative w-12 h-12 rounded-full flex items-center justify-center transition-all z-10 overflow-hidden",
              chatOpen && "shadow-[0_0_20px_hsl(var(--accent)/0.4)]"
            )}
            style={{
              background: chatOpen
                ? "linear-gradient(135deg, hsl(var(--accent) / 0.5), hsl(var(--primary) / 0.6))"
                : "rgba(10, 10, 15, 0.7)",
              backdropFilter: "blur(40px) saturate(200%)",
              WebkitBackdropFilter: "blur(40px) saturate(200%)",
              border: chatOpen
                ? "2px solid hsl(var(--accent) / 0.4)"
                : "2px solid rgba(255,255,255,0.1)",
            }}
            title="Asystent tekstowy"
          >
            {chatOpen ? (
              <MessageCircle className="h-5 w-5 text-primary-foreground" />
            ) : (
              <img
                src={aiAssistantAvatar}
                alt="AI"
                className="w-full h-full object-cover absolute inset-0"
              />
            )}

            {!chatOpen && (
              <motion.div
                className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 z-10"
                style={{ borderColor: "rgba(10,10,15,0.7)" }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
