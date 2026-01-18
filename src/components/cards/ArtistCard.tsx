import { motion } from "framer-motion";
import { Play } from "lucide-react";
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
  gradient = "from-groove-green to-groove-cyan",
  onClick
}: ArtistCardProps) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="groove-card group cursor-pointer p-4 text-center"
    >
      {/* Image */}
      <div className="relative mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full shadow-lg">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={cn(
            "h-full w-full bg-gradient-to-br",
            gradient,
            "flex items-center justify-center"
          )}>
            <span className="text-3xl font-bold text-white/80">
              {name.charAt(0)}
            </span>
          </div>
        )}
        
        {/* Play Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300"
        >
          <Play className="h-4 w-4 fill-current ml-0.5" />
        </motion.button>
      </div>

      {/* Info */}
      <h3 className="font-semibold text-sm truncate mb-1 group-hover:text-primary transition-colors">
        {name}
      </h3>
      <p className="text-xs text-muted-foreground">
        {followers} followers
      </p>
    </motion.div>
  );
};
