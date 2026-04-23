import { useState } from "react";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoffeeDialog } from "./CoffeeDialog";

interface BuyCoffeeButtonProps {
  recipientUserId?: string;
  recipientTrackId?: string;
  recipientName?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function BuyCoffeeButton({
  recipientUserId,
  recipientTrackId,
  recipientName,
  variant = "outline",
  size = "sm",
  className,
  label,
}: BuyCoffeeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn("gap-1.5", className)}
      >
        <Coffee className="h-4 w-4" />
        <span>{label || "Kup nam kawę"}</span>
      </Button>

      <CoffeeDialog
        open={open}
        onOpenChange={setOpen}
        recipientUserId={recipientUserId}
        recipientTrackId={recipientTrackId}
        recipientName={recipientName}
      />
    </>
  );
}
