import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TrackBadgesProps {
  isMonetized?: boolean;
  isBoosted?: boolean;
  isAIAssisted?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const TrackBadges = ({ 
  isMonetized, 
  isBoosted, 
  isAIAssisted, 
  size = "sm",
  className 
}: TrackBadgesProps) => {
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";
  const py = size === "sm" ? "py-0 px-1.5" : "py-0.5 px-2";

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {isMonetized && (
        <Badge className={cn(
          "bg-green-500/15 text-green-400 border-green-500/25 font-medium",
          textSize, py
        )}>
          💰
        </Badge>
      )}
      {isBoosted && (
        <Badge className={cn(
          "bg-amber-500/15 text-amber-400 border-amber-500/25 font-medium animate-pulse",
          textSize, py
        )}>
          🚀
        </Badge>
      )}
      {isAIAssisted && (
        <Badge className={cn(
          "bg-purple-500/15 text-purple-400 border-purple-500/25 font-medium",
          textSize, py
        )}>
          🤖
        </Badge>
      )}
    </div>
  );
};
