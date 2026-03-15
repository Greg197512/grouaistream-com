import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Type, ChevronDown, ChevronUp } from "lucide-react";

interface LyricsLine {
  time: number; // seconds
  text: string;
}

interface LyricsDisplayProps {
  lyrics: LyricsLine[];
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
}

export const LyricsDisplay = ({ lyrics, currentTime, isPlaying, totalDuration }: LyricsDisplayProps) => {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Find current line index
  const currentLineIndex = lyrics.findIndex((line, i) => {
    const nextLine = lyrics[i + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && scrollRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLineIndex]);

  if (lyrics.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#FF6B00]/20 bg-[#0F0F1A]/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#FF6B00]/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-[#FF9500]" />
          <span className="text-xs font-medium text-[#FF9500]">Tekst / Lyrics</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              ref={scrollRef}
              className="px-4 pb-4 max-h-48 overflow-y-auto groove-scrollbar space-y-1"
            >
              {lyrics.map((line, i) => {
                const isActive = i === currentLineIndex;
                const isPast = currentLineIndex >= 0 && i < currentLineIndex;
                const isFuture = currentLineIndex >= 0 && i > currentLineIndex;

                return (
                  <div
                    key={i}
                    ref={isActive ? activeLineRef : undefined}
                    className="py-1 transition-all duration-300"
                  >
                    <motion.p
                      className={`text-sm leading-relaxed transition-all duration-500 ${
                        isActive
                          ? 'text-white font-semibold text-base scale-[1.02] origin-left'
                          : isPast
                          ? 'text-gray-600'
                          : isFuture
                          ? 'text-gray-500'
                          : 'text-gray-400'
                      }`}
                      animate={isActive ? { 
                        textShadow: '0 0 20px rgba(255, 107, 0, 0.5)' 
                      } : { 
                        textShadow: 'none' 
                      }}
                    >
                      {isActive && isPlaying && (
                        <motion.span
                          className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF6B00] mr-2 align-middle"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      )}
                      {line.text}
                    </motion.p>
                  </div>
                );
              })}
            </div>

            {/* Progress indicator */}
            <div className="px-4 pb-3">
              <div className="h-0.5 rounded-full bg-[#1a1a2e] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #FF6B00, #FF9500)' }}
                  animate={{ width: `${(currentTime / totalDuration) * 100}%` }}
                  transition={{ duration: 0.3, ease: 'linear' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Generate lyrics/text lines for a generated track
 * Creates atmospheric text content synced to timing
 */
export function generateLyrics(
  genre: string,
  title: string,
  durationSeconds: number,
  instrumental: boolean
): LyricsLine[] {
  const lines: LyricsLine[] = [];
  
  if (instrumental) {
    // For instrumental tracks, generate atmospheric descriptions
    const atmosphericLines = getAtmosphericLines(genre, title);
    const interval = durationSeconds / (atmosphericLines.length + 1);
    atmosphericLines.forEach((text, i) => {
      lines.push({ time: interval * (i + 0.5), text });
    });
    return lines;
  }

  // Generate genre-appropriate lyrics
  const lyricsPool = getGenreLyrics(genre, title);
  const interval = durationSeconds / (lyricsPool.length + 1);
  lyricsPool.forEach((text, i) => {
    lines.push({ time: interval * (i + 0.5), text });
  });

  return lines;
}

function getAtmosphericLines(genre: string, title: string): string[] {
  const base = [
    `♪ ${title} ♪`,
    '── ──── ── ──── ──',
  ];

  const genreVibes: Record<string, string[]> = {
    'Pop': ['🎵 Bright melodies rising', '✨ Chorus builds momentum', '🎶 Hooks that stay with you', '💫 Feel the pulse', '🌟 Outro fades...'],
    'Rock': ['🎸 Power chords ignite', '🔥 Riff intensifies', '⚡ Solo breaks through', '🎵 Raw energy flows', '🎸 Final chord rings out...'],
    'Electronic': ['🔊 Synths emerge from silence', '💠 Bass drops deep', '🌊 Waves of sound wash over', '⚡ Peak moment', '🔮 Signal fades to void...'],
    'Hip-Hop': ['🎤 Beat kicks in hard', '💎 Flow builds up', '🔥 Verse hits different', '👑 Hook resonates', '🎵 Outro vibes...'],
    'Jazz': ['🎷 Smooth notes float', '🎹 Piano improvises freely', '🥁 Brushes on snare', '🎵 Melody weaves through', '🎶 Final note lingers...'],
    'Classical': ['🎻 Strings rise gently', '🎹 Theme develops', '🎵 Counterpoint intertwines', '✨ Crescendo builds', '🎶 Resolution...'],
    'Lo-fi': ['☁️ Vinyl crackle fades in', '🌧️ Mellow keys drift', '💭 Lost in thought', '🌙 Peaceful groove', '✨ Silence returns...'],
    'Ambient': ['🌌 Space opens up', '🌊 Textures evolve slowly', '💫 Harmonic overtones shimmer', '🌙 Deep resonance', '✨ Dissolves into nothing...'],
    'Metal': ['⚡ Thunderous opening', '🔥 Double bass fury', '🎸 Shredding intensifies', '💀 Breakdown hits', '⚡ Final blast...'],
    'Trap': ['🔊 808s rumble deep', '💎 Hi-hats roll', '🔥 Drop hits hard', '👑 Bass shakes', '🎵 Fade to silence...'],
    'House': ['🏠 Four on the floor kicks', '🔊 Synth stabs rise', '🌊 Build-up intensifies', '💥 Drop!', '🎵 Groove carries you out...'],
    'Disco': ['✨ Funky bassline grooves', '🕺 Strings lift you up', '💃 Dance floor energy', '🎵 Get down tonight', '✨ Outro sparkles...'],
  };

  const vibes = genreVibes[genre] || ['🎵 Music flows', '✨ Rhythm pulses', '🎶 Melody soars', '💫 Moment of magic', '🎵 Silence...'];
  
  return [...base, ...vibes];
}

function getGenreLyrics(genre: string, title: string): string[] {
  const lyricsMap: Record<string, string[]> = {
    'Pop': [
      `♪ ${title} ♪`,
      '', 
      'Verse 1:',
      'Dancing through the city lights tonight',
      'Every heartbeat echoes in the sky',
      'We are the dreamers, we are alive',
      '',
      'Chorus:',
      `${title}, can you feel it now?`,
      'Turn it up, never coming down',
      `${title}, this is our sound`,
      '',
      'Bridge:',
      'Higher, higher, we keep climbing',
      'Nothing stops us, perfect timing',
      '',
      '♪ ♪ ♪',
    ],
    'Rock': [
      `♪ ${title} ♪`,
      '',
      'Verse 1:',
      'Thunder rolls across the broken road',
      'Fire burns inside, about to explode',
      'No chains can hold what\'s already free',
      '',
      'Chorus:',
      `${title}! Let it roar!`,
      'Louder than we were before',
      'Break the silence, shake the floor',
      '',
      'Solo:',
      '🎸 ~~~ ~~~ ~~~ 🎸',
      '',
      '♪ ♪ ♪',
    ],
    'Electronic': [
      `♪ ${title} ♪`,
      '',
      'Drop sequence initiated...',
      'Feel the bass beneath your feet',
      'Digital dreams, electric heat',
      'Synthesized emotions, pure and raw',
      '',
      'BUILD:',
      'Rising... rising... rising...',
      '',
      'DROP:',
      `${title} // ACTIVATE`,
      'Frequencies align, we transcend',
      '',
      '♪ ♪ ♪',
    ],
    'Hip-Hop': [
      `♪ ${title} ♪`,
      '',
      'Verse:',
      'Yeah, came from nothing, built it up',
      'Every bar I spit is tough enough',
      'Real recognize real, that\'s the code',
      'Walking my own path, my own road',
      '',
      'Hook:',
      `${title}, that\'s the vibe`,
      'Keep it moving, stay alive',
      `${title}, certified`,
      '',
      '♪ ♪ ♪',
    ],
  };

  // Fallback generic lyrics
  const defaultLyrics = [
    `♪ ${title} ♪`,
    '',
    'Verse:',
    'Melodies carry us through the night',
    'Every note a spark of light',
    'Music speaks what words cannot say',
    '',
    'Chorus:',
    `${title}, feel the sound`,
    'Rhythm takes us off the ground',
    '',
    '♪ ♪ ♪',
  ];

  return lyricsMap[genre] || defaultLyrics;
}
