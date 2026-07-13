import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Play, Disc3, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffects3D } from "@/contexts/Effects3DContext";

interface ArtistCardProps {
  name: string;
  followers: string;
  imageUrl?: string;
  gradient?: string;
  isTrending?: boolean;
  trackCount?: number;
  onClick?: () => void;
}

export const ArtistCard = ({
  name,
  followers,
  imageUrl,
  gradient = "from-primary to-accent",
  isTrending = false,
  trackCount = 0,
  onClick,
}: ArtistCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { is3D } = useEffects3D();

  // 3D tilt motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { stiffness: 300, damping: 30 });
  const glowX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glowY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!is3D) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.96 }}
      style={is3D ? { rotateX, rotateY, transformStyle: "preserve-3d", perspective: 800 } : undefined}
      className="card-3d group cursor-pointer p-3 sm:p-4 text-center relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 hover:border-primary/40 transition-colors duration-300"
    >
      {/* Dynamic mouse-tracked highlight */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{
          background: `radial-gradient(circle at ${glowX} ${glowY}, hsl(var(--primary)/0.12) 0%, transparent 65%)`,
        }}
      />

      {/* Trending badge */}
      {isTrending && (
        <div className="absolute top-2 left-2 z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_hsl(var(--primary)/0.5)]">
          <TrendingUp className="h-3 w-3 text-primary-foreground" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
            {trackCount > 1 ? `${trackCount} tracks` : "Artist"}
          </span>
        </div>
      )}

      {/* Ambient edge glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
        <div className={cn("absolute -inset-4 bg-gradient-to-br blur-3xl opacity-15", gradient)} />
      </div>

      {/* Avatar area */}
      <div className="relative mx-auto mb-3 sm:mb-4">
        {/* Spinning vinyl record behind avatar */}
        <motion.div
          className="absolute inset-0 m-auto h-[7.5rem] w-[7.5rem] sm:h-36 sm:w-36 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <div className="h-full w-full rounded-full bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 border border-white/5">
            <div className="absolute inset-[30%] rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/5" />
            <div className="absolute inset-[15%] rounded-full border border-white/[0.03]" />
            <div className="absolute inset-[20%] rounded-full border border-white/[0.03]" />
            <div className="absolute inset-[25%] rounded-full border border-white/[0.03]" />
          </div>
        </motion.div>

        {/* Main avatar */}
        <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-[3px] ring-border/20 group-hover:ring-primary/60 transition-all duration-500 z-10">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className={cn("h-full w-full bg-gradient-to-br relative", gradient, "flex items-center justify-center")}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/10"
                animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-3 rounded-full border border-white/10"
                animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0, 0.15] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
              <div className="relative flex flex-col items-center gap-0.5">
                <Disc3 className="h-5 w-5 text-white/40" />
                <span className="text-3xl font-black text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] tracking-tight">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Shine sweep on hover */}
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            whileHover={{ x: "200%", opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none skew-x-12"
          />

          {/* Play button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            whileHover={{ scale: 1.15 }}
            className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)/0.5)] opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 z-20"
          >
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          </motion.button>
        </div>
      </div>

      {/* Info */}
      <h3 className="font-bold text-sm truncate mb-0.5 group-hover:text-primary transition-colors duration-300 relative z-10">
        {name}
      </h3>
      <p className="text-[11px] text-muted-foreground/80 relative z-10 font-medium tracking-wide uppercase">
        {followers}
      </p>
    </motion.div>
  );
};
