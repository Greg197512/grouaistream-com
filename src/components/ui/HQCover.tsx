import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Music2 } from "lucide-react";

interface HQCoverProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  showFallbackIcon?: boolean;
}

/** Generate a deterministic vibrant gradient from a string */
function generateGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40 + Math.abs((hash >> 8) % 60)) % 360;
  const h3 = (h2 + 30 + Math.abs((hash >> 16) % 50)) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 25%) 0%, hsl(${h2} 60% 35%) 50%, hsl(${h3} 50% 20%) 100%)`;
}

function getInitials(name: string): string {
  return name
    .split(/[\s\-&,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");
}

/** Check if URL is a low-quality placeholder */
function isPlaceholder(url: string): boolean {
  return url.includes("picsum.photos") || url.includes("placeholder") || url.includes("via.placeholder");
}

/**
 * High-Quality Cover Image component
 * Renders album artwork at photographic 8K quality with sharp rendering,
 * eager loading, and graceful fallback with artistic gradient + initials.
 */
export const HQCover = ({ src, alt, className, fallbackClassName, showFallbackIcon = true }: HQCoverProps) => {
  const [error, setError] = useState(false);
  const gradient = useMemo(() => generateGradient(alt || "music"), [alt]);
  const initials = useMemo(() => getInitials(alt || "?"), [alt]);

  const isLowQuality = src ? isPlaceholder(src) : true;

  if (!src || error || isLowQuality) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden select-none",
          fallbackClassName || className
        )}
        style={{ background: gradient }}
      >
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.1) 0%, transparent 40%)"
        }} />
        {showFallbackIcon ? (
          <div className="flex flex-col items-center gap-0.5 z-10">
            <span className="font-bold text-white/90 drop-shadow-lg" style={{
              fontSize: "clamp(0.5rem, 40%, 1.5rem)",
              letterSpacing: "0.05em",
              textShadow: "0 2px 8px rgba(0,0,0,0.4)"
            }}>
              {initials || <Music2 className="h-1/3 w-1/3 text-white/60" />}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 opacity-60" style={{ background: gradient }} />
        )}
      </div>
    );
  }

  // Upgrade known CDN URLs to max resolution
  const hqSrc = upgradeToMaxRes(src);

  return (
    <img
      src={hqSrc}
      alt={alt}
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => setError(true)}
      className={cn(
        "object-cover",
        className
      )}
      style={{
        imageRendering: "auto",
      }}
    />
  );
};

/**
 * Upgrade known CDN cover URLs to maximum available resolution
 */
function upgradeToMaxRes(url: string): string {
  // iTunes: upgrade to 3000x3000 (near-8K)
  if (url.includes("mzstatic.com")) {
    return url.replace(/\d+x\d+bb/, "3000x3000bb");
  }
  
  // Deezer: upgrade to max
  if (url.includes("cdns-images.dzcdn.net")) {
    return url.replace(/\/\d+x\d+/, "/1800x1800");
  }

  // Spotify (i.scdn.co): already max but ensure largest
  if (url.includes("i.scdn.co")) {
    return url; // Spotify doesn't support size params in URL
  }

  return url;
}
