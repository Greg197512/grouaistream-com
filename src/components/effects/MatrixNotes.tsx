import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NOTE_CHARS = ["♩", "♪", "♫", "♬", "𝄞", "♭", "♯"];

interface FallingNote {
  id: number;
  x: number;
  char: string;
  hue: number;
  size: number;
  duration: number;
  delay: number;
}

let noteId = 0;

interface MatrixNotesProps {
  enabled: boolean;
  width?: number;
  height?: number;
}

export const MatrixNotes = ({ enabled }: MatrixNotesProps) => {
  const [notes, setNotes] = useState<FallingNote[]>([]);

  const spawnNote = useCallback(() => {
    const note: FallingNote = {
      id: ++noteId,
      x: 5 + Math.random() * 90, // % position
      char: NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
      hue: 15 + Math.random() * 30,
      size: 10 + Math.random() * 8,
      duration: 3 + Math.random() * 3,
      delay: 0,
    };
    setNotes((prev) => [...prev.slice(-20), note]); // keep max 20
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNotes([]);
      return;
    }
    // Spawn notes at intervals
    const interval = setInterval(spawnNote, 400 + Math.random() * 300);
    // Spawn a few immediately
    for (let i = 0; i < 5; i++) {
      setTimeout(spawnNote, i * 200);
    }
    return () => clearInterval(interval);
  }, [enabled, spawnNote]);

  const handleComplete = useCallback((id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <AnimatePresence>
        {notes.map((note) => (
          <motion.span
            key={note.id}
            initial={{ y: "-20%", opacity: 0, scale: 0.5 }}
            animate={{ 
              y: "120%", 
              opacity: [0, 0.9, 0.8, 0.6, 0],
              scale: [0.5, 1, 1, 0.8],
              rotate: [0, -5, 5, -3, 0],
            }}
            transition={{ 
              duration: note.duration, 
              ease: "linear",
              opacity: { duration: note.duration, times: [0, 0.1, 0.5, 0.8, 1] },
            }}
            onAnimationComplete={() => handleComplete(note.id)}
            className="absolute font-bold select-none"
            style={{
              left: `${note.x}%`,
              fontSize: note.size,
              color: `hsl(${note.hue}, 95%, 58%)`,
              textShadow: `0 0 8px hsl(${note.hue}, 100%, 50%), 0 0 16px hsl(${note.hue}, 90%, 40%)`,
              filter: `brightness(1.2)`,
            }}
          >
            {note.char}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};
