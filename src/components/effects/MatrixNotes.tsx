import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";

const NOTE_CHARS = ["♩", "♪", "♫", "♬", "𝄞", "♭", "♯"];
const COLUMN_COUNT = 12;
const NOTES_PER_COLUMN = 6;
const TOTAL = COLUMN_COUNT * NOTES_PER_COLUMN;

interface NoteData {
  x: number;
  z: number;
  speed: number;
  char: string;
  columnIndex: number;
  offset: number;
}

function FallingNotes({ bass, mid, treble, overall }: { bass: number; mid: number; treble: number; overall: number }) {
  const meshRefs = useRef<(THREE.Group | null)[]>([]);
  const opacityRefs = useRef<Float32Array>(new Float32Array(TOTAL).fill(0.3));
  const yPositions = useRef<Float32Array>(new Float32Array(TOTAL));

  const notes = useMemo<NoteData[]>(() => {
    const arr: NoteData[] = [];
    for (let col = 0; col < COLUMN_COUNT; col++) {
      for (let row = 0; row < NOTES_PER_COLUMN; row++) {
        const x = (col / COLUMN_COUNT) * 6 - 3 + (Math.random() - 0.5) * 0.3;
        const z = (Math.random() - 0.5) * 2;
        const offset = -(row / NOTES_PER_COLUMN) * 12 - Math.random() * 4;
        yPositions.current[arr.length] = 5 + offset;
        arr.push({
          x,
          z,
          speed: 0.8 + Math.random() * 0.6,
          char: NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
          columnIndex: col,
          offset,
        });
      }
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const speedMult = 0.5 + overall * 2.5;
    const clampedDelta = Math.min(delta, 0.05);

    for (let i = 0; i < TOTAL; i++) {
      const note = notes[i];
      const group = meshRefs.current[i];
      if (!group) continue;

      // Fall speed reacts to music
      let bandIntensity: number;
      if (note.columnIndex < 4) bandIntensity = bass;
      else if (note.columnIndex < 8) bandIntensity = mid;
      else bandIntensity = treble;

      const fallSpeed = note.speed * speedMult * (0.6 + bandIntensity * 1.8);
      yPositions.current[i] -= fallSpeed * clampedDelta * 3;

      // Reset when below view
      if (yPositions.current[i] < -7) {
        yPositions.current[i] = 5 + Math.random() * 3;
        note.char = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
      }

      group.position.y = yPositions.current[i];
      group.position.x = note.x + Math.sin(Date.now() * 0.001 + i) * 0.05 * bandIntensity;

      // Scale pulse on beat
      const scale = 0.8 + bandIntensity * 0.6;
      group.scale.setScalar(scale);

      // Opacity: brighter when music is intense
      opacityRefs.current[i] = 0.15 + bandIntensity * 0.7;
    }
  });

  return (
    <>
      {notes.map((note, i) => {
        const isBass = note.columnIndex < 4;
        const isMid = note.columnIndex >= 4 && note.columnIndex < 8;
        const hue = isBass ? 15 : isMid ? 30 : 45;
        const color = new THREE.Color().setHSL(hue / 360, 0.85, 0.55);

        return (
          <group
            key={i}
            ref={(el) => { meshRefs.current[i] = el; }}
            position={[note.x, 5 + note.offset, note.z]}
          >
            <Text
              fontSize={0.4}
              color={color}
              anchorX="center"
              anchorY="middle"
              fillOpacity={0.4}
              font={undefined}
            >
              {note.char}
            </Text>
            {/* Glow point light per note */}
            <pointLight
              color={color}
              intensity={0.03}
              distance={1.5}
              decay={2}
            />
          </group>
        );
      })}
      {/* Ambient glow */}
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 3, 2]} intensity={0.2 + overall * 0.8} color="#ff6a00" distance={10} />
    </>
  );
}

interface MatrixNotesProps {
  enabled: boolean;
}

export const MatrixNotes = ({ enabled }: MatrixNotesProps) => {
  const { isPlaying, audioElement, isVideoMode } = usePlayer();
  const levels = useAudioAnalyser(audioElement, isPlaying, isVideoMode);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.6 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <FallingNotes
          bass={levels.bass}
          mid={levels.mid}
          treble={levels.treble}
          overall={levels.overall}
        />
      </Canvas>
    </div>
  );
};
