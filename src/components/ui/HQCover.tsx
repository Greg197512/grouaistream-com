import { useState } from "react";
import { cn } from "@/lib/utils";
import { MonitorSpeaker } from "lucide-react";

interface HQCoverProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  showFallbackIcon?: boolean;
}

/**
 * High-Quality Cover Image component
 * Renders album artwork at photographic 8K quality with sharp rendering,
 * eager loading, and graceful fallback.
 */
export const HQCover = ({ src, alt, className, fallbackClassName, showFallbackIcon = true }: HQCoverProps) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={cn("flex items-center justify-center bg-muted/30", fallbackClassName || className)}>
        {showFallbackIcon && <MonitorSpeaker className="h-1/3 w-1/3 text-muted-foreground/40" />}
        {!showFallbackIcon && <div className="absolute inset-0 groove-gradient-bg opacity-60" />}
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
        WebkitImageSmoothing: "high" as any,
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
