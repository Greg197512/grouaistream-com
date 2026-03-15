import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { HQCover } from "@/components/ui/HQCover";

interface PlaylistCardProps {
  id?: string;
  title: string;
  description: string;
  imageUrl?: string;
  isAI?: boolean;
  gradient?: string;
  onClick?: () => void;
}

export const PlaylistCard = ({ 
  id,
  title, 
  description, 
  imageUrl, 
  isAI,
  gradient = "from-groove-orange via-groove-amber to-groove-fire",
  onClick 
}: PlaylistCardProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (id) {
      navigate(`/playlist/${id}`);
    }
  };

  return (
    <motion.div
      onClick={handleClick}
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
            {isAI && <span className="material-icons text-white/80 text-5xl">smart_toy</span>}
          </div>
        )}
        
        {/* Play Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ scale: 1.1 }}
          className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300"
        >
          <span className="material-icons">play_arrow</span>
        </motion.button>

        {/* AI Badge */}
        {isAI && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-accent/90 px-2 py-1">
            <span className="material-icons text-accent-foreground text-xs">smart_toy</span>
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
