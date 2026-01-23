import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LicenseBadgeProps {
  badges: string[];
  licenseType: string;
  className?: string;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

const badgeColors: Record<string, string> = {
  BY: "bg-green-600",
  NC: "bg-yellow-600",
  SA: "bg-blue-600",
  ND: "bg-red-600",
  PD: "bg-gray-600",
};

const badgeTooltips: Record<string, string> = {
  BY: "Attribution Required",
  NC: "Non-Commercial Use Only",
  SA: "Share Alike",
  ND: "No Derivatives",
  PD: "Public Domain",
};

export const LicenseBadge = ({
  badges,
  licenseType,
  className,
  showTooltip = true,
  size = "sm",
}: LicenseBadgeProps) => {
  const sizeClasses = {
    sm: "text-[8px] px-1 py-0.5",
    md: "text-[10px] px-1.5 py-0.5",
    lg: "text-xs px-2 py-1",
  };

  const content = (
    <div className={cn("flex items-center gap-0.5", className)}>
      <span
        className={cn(
          "rounded bg-secondary/80 font-bold text-white",
          sizeClasses[size]
        )}
      >
        CC
      </span>
      {badges.map((badge) => (
        <TooltipProvider key={badge}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "rounded font-bold text-white",
                  badgeColors[badge] || "bg-gray-500",
                  sizeClasses[size]
                )}
              >
                {badge}
              </span>
            </TooltipTrigger>
            {showTooltip && (
              <TooltipContent>
                <p>{badgeTooltips[badge] || badge}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <p>{licenseType}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};

// CC Mixter source badge
export const CCMixterBadge = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-[10px] text-white font-bold",
      className
    )}
  >
    <span>CC</span>
    <span className="opacity-70">Mixter</span>
  </div>
);
