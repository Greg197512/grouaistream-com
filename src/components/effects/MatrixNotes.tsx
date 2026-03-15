import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";

const NOTE_CHARS = ["♩", "♪", "♫", "♬", "𝄞", "♭", "♯"];

interface FallingNote {
  id: number;
  x: number;
  char: string;
  hue: number;
  size: number;
  duration: number;
  tornado: boolean; // sucked into logo center
}

let noteId = 0;

interface MatrixNotesProps {
  enabled: boolean;
}

export const MatrixNotes = ({ enabled }: MatrixNotesProps) => {
  const [notes, setNotes] = useState<FallingNote[]>([]);
  const { isPlaying, audioElement, isVideoMode } = usePlayer();
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const spawnNote = useCallback(() => {
    const l = levelsRef.current;
    const isTornado = Math.random() < 0.2; // 20% chance tornado
    const bassDuration = isPlaying ? Math.max(1.5, 4 - l.bass * 3) : 3 + Math.random() * 3;

    const note: FallingNote = {
      id: ++noteId,
      x: 5 + Math.random() * 90,
      char: NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
      hue: 15 + Math.random() * 30,
      size: 7 + Math.random() * 4,
      duration: isTornado ? 1.5 + Math.random() * 1.5 : bassDuration,
      tornado: isTornado,
    };
    setNotes((prev) => [...prev.slice(-25), note]);
  }, [isPlaying]);

  useEffect(() => {
    if (!enabled) {
      setNotes([]);
      return;
    }
    // Faster spawn when bass hits
    const getInterval = () => {
      const l = levelsRef.current;
      if (isPlaying && l.bass > 0.5) return 150 + Math.random() * 150;
      if (isPlaying) return 250 + Math.random() * 250;
      return 500 + Math.random() * 400;
    };

    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      spawnNote();
      timeout = setTimeout(tick, getInterval());
    };
    // Initial burst
    for (let i = 0; i < 4; i++) setTimeout(spawnNote, i * 150);
    timeout = setTimeout(tick, getInterval());

    return () => clearTimeout(timeout);
  }, [enabled, spawnNote, isPlaying]);

  const handleComplete = useCallback((id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  if (!enabled) return null;

  // Logo center is roughly at 50%, 50% of the container
  const centerX = 50;
  const centerY = 50;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      <AnimatePresence>
        {notes.map((note) => {
          if (note.tornado) {
            // Tornado: start from edge, spiral into logo center and vanish
            const startX = note.x;
            const midX = startX + (centerX - startX) * 0.5 + (Math.random() - 0.5) * 30;
            return (
              <motion.span
                key={note.id}
                initial={{ 
                  left: `${startX}%`,
                  top: "-10%",
                  opacity: 0, 
                  scale: 1,
                }}
                animate={{
                  left: [`${startX}%`, `${midX}%`, `${centerX}%`],
                  top: ["-10%", `${30 + Math.random() * 20}%`, `${centerY}%`],
                  opacity: [0, 0.9, 0],
                  scale: [1, 0.8, 0],
                  rotate: [0, 180 + Math.random() * 360, 720],
                }}
                transition={{
                  duration: note.duration,
                  ease: [0.4, 0, 0.2, 1],
                  times: [0, 0.5, 1],
                }}
                onAnimationComplete={() => handleComplete(note.id)}
                className="absolute font-bold select-none"
                style={{
                  fontSize: note.size,
                  color: `hsl(${note.hue}, 95%, 58%)`,
                  textShadow: `0 0 6px hsl(${note.hue}, 100%, 50%), 0 0 12px hsl(${note.hue}, 90%, 40%)`,
                }}
              >
                {note.char}
              </motion.span>
            );
          }

          // Normal falling — fade out as they reach logo area
          return (
            <motion.span
              key={note.id}
              initial={{ y: "-15%", opacity: 0, scale: 0.5 }}
              animate={{
                y: "110%",
                opacity: [0, 0.85, 0.7, 0.3, 0],
                scale: [0.5, 1, 0.9, 0.6],
                rotate: [0, -5, 5, -3, 0],
              }}
              transition={{
                duration: note.duration,
                ease: "linear",
                opacity: { duration: note.duration, times: [0, 0.1, 0.4, 0.75, 1] },
              }}
              onAnimationComplete={() => handleComplete(note.id)}
              className="absolute font-bold select-none"
              style={{
                left: `${note.x}%`,
                fontSize: note.size,
                color: `hsl(${note.hue}, 95%, 58%)`,
                textShadow: `0 0 6px hsl(${note.hue}, 100%, 50%), 0 0 12px hsl(${note.hue}, 90%, 40%)`,
              }}
            >
              {note.char}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
