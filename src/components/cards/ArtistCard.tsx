import { motion } from "framer-motion";
import { Play, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtistCardProps {
  name: string;
  followers: string;
  imageUrl?: string;
  gradient?: string;
  onClick?: () => void;
}

export const ArtistCard = ({
  name,
  followers,
  imageUrl,
  gradient = "from-primary to-accent",
  onClick
}: ArtistCardProps) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className="groove-card group cursor-pointer p-4 text-center relative overflow-hidden"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br blur-2xl opacity-20",
          gradient
        )} />
      </div>

      {/* Image */}
      <div className="relative mx-auto mb-4 h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-full shadow-lg ring-2 ring-border/30 group-hover:ring-primary/50 transition-all duration-500">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className={cn(
            "h-full w-full bg-gradient-to-br relative",
            gradient,
            "flex items-center justify-center"
          )}>
            {/* Animated rings */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/10"
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border border-white/10"
              animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.05, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
            <div className="relative flex flex-col items-center gap-1">
              <Music2 className="h-6 w-6 text-white/60" />
              <span className="text-2xl font-bold text-white/90 drop-shadow-lg">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
        
        {/* Play Button - premium floating style */}
        <motion.button
          initial={{ opacity: 0, scale: 0.6, y: 8 }}
          whileHover={{ scale: 1.15 }}
          className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_hsl(var(--primary)/0.5)] opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 backdrop-blur-sm"
        >
          <Play className="h-4 w-4 fill-current ml-0.5" />
        </motion.button>
      </div>

      {/* Info */}
      <h3 className="font-semibold text-sm truncate mb-1 group-hover:text-primary transition-colors duration-300 relative z-10">
        {name}
      </h3>
      <p className="text-xs text-muted-foreground relative z-10">
        {followers}
      </p>
    </motion.div>
  );
};
