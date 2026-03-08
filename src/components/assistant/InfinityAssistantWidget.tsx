import { useState, useEffect } from "react";
import { motion, useDragControls } from "framer-motion";
import { Mic, MicOff, MessageCircle, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import aiAssistantAvatar from "@/assets/ai-assistant-avatar.jpg";

/**
 * Infinity-shaped (∞) draggable widget that unifies:
 *  - Left lobe: Voice assistant (mic)
 *  - Right lobe: Text chat assistant
 * Both trigger their respective components via custom events.
 */
export const InfinityAssistantWidget = () => {
  const dragControls = useDragControls();
  const [micActive, setMicActive] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

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
    window.dispatchEvent(new CustomEvent("toggle-voice-mic"));
  };

  const toggleChat = () => {
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
      className="fixed bottom-28 md:bottom-32 right-3 z-40 select-none touch-none"
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
        <motion.button
          onClick={toggleMic}
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

          {/* Pulse rings when listening */}
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

        {/* Center bridge - infinity crossing */}
        <div
          className="w-4 h-6 -mx-2 z-20 flex items-center justify-center relative"
          style={{
            background: "linear-gradient(90deg, rgba(10,10,15,0.6), rgba(10,10,15,0.8), rgba(10,10,15,0.6))",
          }}
        >
          <div className="w-full h-px bg-gradient-to-r from-primary/30 via-accent/50 to-primary/30" />
          {/* Glow dot at center */}
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
        <motion.button
          onClick={toggleChat}
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

          {/* Online indicator */}
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
    </motion.div>
  );
};
