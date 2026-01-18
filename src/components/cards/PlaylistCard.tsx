import { motion } from "framer-motion";
import { Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaylistCardProps {
  title: string;
  description: string;
  imageUrl?: string;
  isAI?: boolean;
  gradient?: string;
  onClick?: () => void;
}

export const PlaylistCard = ({ 
  title, 
  description, 
  imageUrl, 
  isAI,
  gradient = "from-groove-green via-groove-cyan to-groove-purple",
  onClick 
}: PlaylistCardProps) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="groove-card group cursor-pointer p-4"
    >
      {/* Image */}
      <div className="relative mb-4 aspect-square overflow-hidden rounded-md shadow-lg">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={cn(
            "h-full w-full bg-gradient-to-br",
            gradient,
            "flex items-center justify-center"
          )}>
            {isAI && <Sparkles className="h-12 w-12 text-white/80" />}
          </div>
        )}
        
        {/* Play Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300"
        >
          <Play className="h-5 w-5 fill-current ml-0.5" />
        </motion.button>

        {/* AI Badge */}
        {isAI && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-accent/90 px-2 py-1">
            <Sparkles className="h-3 w-3 text-accent-foreground" />
            <span className="text-[10px] font-semibold text-accent-foreground">AI</span>
          </div>
        )}
      </div>

      {/* Info */}
      <h3 className="font-semibold text-sm truncate mb-1 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {description}
      </p>
    </motion.div>
  );
};
