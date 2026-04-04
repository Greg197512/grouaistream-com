import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface HQCoverProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  showFallbackIcon?: boolean;
  genre?: string | null;
  animated?: boolean;
  artist?: string | null;
}

/* ── In-memory cache + rate limiter ── */
const coverCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();

// Queue system to avoid flooding edge function
const requestQueue: Array<{ key: string; artist: string; title: string; resolve: (url: string | null) => void }> = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    const batch = requestQueue.splice(0, 3); // Process 3 at a time
    
    await Promise.all(batch.map(async (item) => {
      try {
        const { data, error } = await supabase.functions.invoke("cover-search", {
          body: { artist: item.artist, title: item.title },
        });
        const url = (!error && data?.cover_url) ? data.cover_url : null;
        coverCache.set(item.key, url);
        item.resolve(url);
      } catch {
        coverCache.set(item.key, null);
        item.resolve(null);
      }
    }));
    
    // Small delay between batches to not overwhelm the function
    if (requestQueue.length > 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  isProcessing = false;
}

function fetchCoverArt(artist: string, title: string): Promise<string | null> {
  const cacheKey = `${artist}||${title}`.toLowerCase();
  
  if (coverCache.has(cacheKey)) return Promise.resolve(coverCache.get(cacheKey)!);
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)!;
  
  const promise = new Promise<string | null>((resolve) => {
    requestQueue.push({ key: cacheKey, artist, title, resolve });
    processQueue();
  });
  
  pendingRequests.set(cacheKey, promise);
  promise.finally(() => pendingRequests.delete(cacheKey));
  
  return promise;
}

/* ── Deterministic hash ── */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

/* ── Genre → palette mapping ── */
const GENRE_PALETTES: Record<string, { bg: string[]; accent: string; icon: string }> = {
  rock:        { bg: ["#1a0a0a", "#2d1111", "#441818"], accent: "#ff4444", icon: "🎸" },
  metal:       { bg: ["#0a0a0a", "#1a1a1a", "#0d0d0d"], accent: "#888888", icon: "🤘" },
  punk:        { bg: ["#1a0f00", "#2d1a00", "#442800"], accent: "#ff8800", icon: "⚡" },
  pop:         { bg: ["#1a0020", "#2d0040", "#440060"], accent: "#ff44cc", icon: "🎤" },
  "hip-hop":   { bg: ["#0a0014", "#1a0028", "#2d0044"], accent: "#aa44ff", icon: "🎧" },
  rap:         { bg: ["#0f0020", "#1a0035", "#2d005a"], accent: "#cc66ff", icon: "🎙️" },
  electronic:  { bg: ["#000a1a", "#001a2d", "#002844"], accent: "#00ccff", icon: "🎹" },
  jazz:        { bg: ["#1a1400", "#2d2200", "#443300"], accent: "#ffaa00", icon: "🎷" },
  blues:       { bg: ["#000a1a", "#00142d", "#001e44"], accent: "#4488ff", icon: "🎺" },
  classical:   { bg: ["#0a1a0a", "#112d11", "#184418"], accent: "#44cc44", icon: "🎻" },
  "r&b":       { bg: ["#1a0014", "#2d0028", "#440040"], accent: "#ff44aa", icon: "💜" },
  rnb:         { bg: ["#1a0014", "#2d0028", "#440040"], accent: "#ff44aa", icon: "💜" },
  indie:       { bg: ["#0a1a14", "#112d22", "#184433"], accent: "#44ccaa", icon: "🌿" },
  alternative: { bg: ["#0a0a1a", "#14142d", "#1e1e44"], accent: "#6688ff", icon: "🔮" },
  reggae:      { bg: ["#0a1a00", "#142d00", "#1e4400"], accent: "#44cc00", icon: "🌴" },
  country:     { bg: ["#1a1000", "#2d1c00", "#442a00"], accent: "#ffbb44", icon: "🤠" },
  soul:        { bg: ["#1a0a14", "#2d1122", "#441833"], accent: "#ff6688", icon: "🎵" },
  funk:        { bg: ["#1a0a00", "#2d1400", "#441e00"], accent: "#ff6600", icon: "🕺" },
  latin:       { bg: ["#1a0800", "#2d1000", "#441800"], accent: "#ff5522", icon: "💃" },
};

function getPalette(genre: string | null | undefined, title: string) {
  if (genre) {
    const key = genre.toLowerCase().trim();
    if (GENRE_PALETTES[key]) return GENRE_PALETTES[key];
    for (const [k, v] of Object.entries(GENRE_PALETTES)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
  }
  const h = hashStr(title);
  const hue = h % 360;
  return {
    bg: [
      `hsl(${hue}, 40%, 8%)`,
      `hsl(${(hue + 20) % 360}, 35%, 14%)`,
      `hsl(${(hue + 40) % 360}, 30%, 10%)`,
    ],
    accent: `hsl(${hue}, 70%, 55%)`,
    icon: "🎵",
  };
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-&,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function isPlaceholder(url: string): boolean {
  return (
    url.includes("picsum.photos") ||
    url.includes("placeholder") ||
    url.includes("via.placeholder")
  );
}

/* ── Loading shimmer ── */
const CoverShimmer = ({ className }: { className?: string }) => (
  <div className={cn("relative overflow-hidden bg-secondary/50", className)}>
    <motion.div
      className="absolute inset-0"
      style={{
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
      }}
      animate={{ x: ["-100%", "100%"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

/* ── Animated Music Cover Fallback ── */
const AnimatedCover = ({
  title,
  genre,
  className,
}: {
  title: string;
  genre?: string | null;
  className?: string;
}) => {
  const palette = useMemo(() => getPalette(genre, title), [genre, title]);
  const initials = useMemo(() => getInitials(title || "?"), [title]);
  const h = useMemo(() => hashStr(title), [title]);
  const variant = h % 5;

  const bgGradient = `radial-gradient(ellipse at 30% 20%, ${palette.bg[1]} 0%, ${palette.bg[0]} 50%, ${palette.bg[2]} 100%)`;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden select-none",
        className
      )}
      style={{ background: bgGradient }}
    >
      {variant === 0 && <VinylDisc accent={palette.accent} />}
      {variant === 1 && <SoundWaves accent={palette.accent} />}
      {variant === 2 && <PulsingRings accent={palette.accent} />}
      {variant === 3 && <FloatingNotes accent={palette.accent} seed={h} />}
      {variant === 4 && <EqualizerBars accent={palette.accent} seed={h} />}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${30 + (h % 40)}% ${20 + (h % 30)}%, ${palette.accent}15 0%, transparent 50%)`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-1 px-2">
        <span className="text-lg sm:text-xl drop-shadow-lg" style={{ filter: "drop-shadow(0 0 8px rgba(0,0,0,0.5))" }}>
          {palette.icon}
        </span>
        <span
          className="font-bold text-white/90 text-center leading-tight drop-shadow-lg"
          style={{
            fontSize: "clamp(0.45rem, 28%, 1.1rem)",
            letterSpacing: "0.08em",
            textShadow: `0 2px 12px rgba(0,0,0,0.6), 0 0 20px ${palette.accent}40`,
            maxWidth: "90%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {initials}
        </span>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${palette.accent}80, transparent)`,
        }}
      />
    </div>
  );
};

/* ── Visual variants ── */

const VinylDisc = ({ accent }: { accent: string }) => (
  <div className="absolute inset-0 flex items-center justify-center">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      className="rounded-full"
      style={{
        width: "75%",
        height: "75%",
        background: `conic-gradient(from 0deg, ${accent}10, ${accent}05, ${accent}15, ${accent}05, ${accent}10)`,
        boxShadow: `0 0 30px ${accent}15`,
      }}
    >
      <div className="absolute inset-0 rounded-full" style={{
        background: `repeating-radial-gradient(circle at center, transparent 0px, transparent 3px, ${accent}08 4px, transparent 5px)`,
      }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "20%", height: "20%",
          background: `radial-gradient(circle, ${accent}40, ${accent}15)`,
          boxShadow: `0 0 15px ${accent}30`,
        }}
      />
    </motion.div>
  </div>
);

const SoundWaves = ({ accent }: { accent: string }) => (
  <div className="absolute inset-0 flex items-center justify-center">
    {[0, 1, 2, 3].map((i) => (
      <motion.div
        key={i}
        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }}
        className="absolute rounded-full border"
        style={{
          width: `${30 + i * 18}%`,
          height: `${30 + i * 18}%`,
          borderColor: `${accent}30`,
        }}
      />
    ))}
  </div>
);

const PulsingRings = ({ accent }: { accent: string }) => (
  <div className="absolute inset-0 flex items-center justify-center">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{
          scale: [0.8, 1.2, 0.8],
          rotate: [0, 120, 240, 360],
        }}
        transition={{
          duration: 6 + i * 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute rounded-full"
        style={{
          width: `${50 + i * 20}%`,
          height: `${50 + i * 20}%`,
          border: `1px solid ${accent}${20 - i * 5}`,
          boxShadow: `inset 0 0 20px ${accent}08`,
        }}
      />
    ))}
  </div>
);

const FloatingNotes = ({ accent, seed }: { accent: string; seed: number }) => {
  const notes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: (seed * (i + 1) * 17) % 80 + 10,
        y: (seed * (i + 1) * 23) % 80 + 10,
        size: 10 + ((seed * (i + 1)) % 8),
        delay: i * 0.5,
        symbol: ["♪", "♫", "♬", "♩", "🎵", "🎶"][i],
      })),
    [seed]
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {notes.map((n, i) => (
        <motion.span
          key={i}
          animate={{
            y: [0, -15, 0],
            opacity: [0.15, 0.35, 0.15],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4 + (i % 3),
            repeat: Infinity,
            delay: n.delay,
            ease: "easeInOut",
          }}
          className="absolute"
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            fontSize: n.size,
            color: accent,
            filter: `drop-shadow(0 0 6px ${accent}60)`,
          }}
        >
          {n.symbol}
        </motion.span>
      ))}
    </div>
  );
};

const EqualizerBars = ({ accent, seed }: { accent: string; seed: number }) => {
  const bars = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({
      height: 20 + ((seed * (i + 1) * 13) % 50),
      delay: i * 0.12,
    })),
    [seed]
  );

  return (
    <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
      {bars.map((b, i) => (
        <motion.div
          key={i}
          animate={{ height: [`${b.height * 0.3}%`, `${b.height}%`, `${b.height * 0.5}%`] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: b.delay, ease: "easeInOut" }}
          style={{
            width: 3,
            borderRadius: 2,
            background: `linear-gradient(to top, ${accent}90, ${accent}30)`,
            boxShadow: `0 0 6px ${accent}40`,
          }}
        />
      ))}
    </div>
  );
};

/* ── Upgrade CDN URLs ── */
function upgradeToMaxRes(url: string): string {
  if (url.includes("mzstatic.com")) return url.replace(/\d+x\d+bb/, "3000x3000bb");
  if (url.includes("cdns-images.dzcdn.net")) return url.replace(/\/\d+x\d+/, "/1800x1800");
  return url;
}

/* ── Main component ── */
export const HQCover = ({
  src,
  alt,
  className,
  fallbackClassName,
  showFallbackIcon = true,
  genre,
  animated = true,
  artist,
}: HQCoverProps) => {
  const [error, setError] = useState(false);
  const [fetchedCover, setFetchedCover] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const mountedRef = useRef(true);

  const isLowQuality = src ? isPlaceholder(src) : true;
  const normalizedArtist = (artist || "").trim().toLowerCase();
  const shouldSkipExternalFetch = normalizedArtist === "unknown artist" || normalizedArtist === "unknown";
  const needsFetch = !shouldSkipExternalFetch && ((!src || error || isLowQuality) && !fetchAttempted);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!needsFetch) return;
    
    const effectiveArtist = artist || "";
    const effectiveTitle = alt || "";
    
    if (!effectiveTitle) {
      setFetchAttempted(true);
      return;
    }

    setFetchAttempted(true);
    setIsLoading(true);
    
    fetchCoverArt(effectiveArtist, effectiveTitle).then((url) => {
      if (mountedRef.current) {
        setFetchedCover(url);
        setIsLoading(false);
      }
    });
  }, [needsFetch, artist, alt]);

  const effectiveSrc = (!src || error || isLowQuality) ? fetchedCover : src;

  // Show shimmer while loading
  if (isLoading && !effectiveSrc) {
    return <CoverShimmer className={fallbackClassName || className} />;
  }

  if (!effectiveSrc) {
    return (
      <AnimatedCover
        title={alt}
        genre={genre}
        className={fallbackClassName || className}
      />
    );
  }

  const hqSrc = upgradeToMaxRes(effectiveSrc);

  return (
    <img
      src={hqSrc}
      alt={alt}
        loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        if (effectiveSrc === fetchedCover) {
          setFetchedCover(null);
        } else {
          setError(true);
        }
      }}
      className={cn("object-cover", className)}
      style={{ imageRendering: "auto" }}
    />
  );
};
