import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Heart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RatingLikeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  listenedSeconds: number;
  onSuccess?: () => void;
}

export const RatingLikeModal = ({
  isOpen,
  onClose,
  trackId,
  trackTitle,
  trackArtist,
  listenedSeconds,
  onSuccess,
}: RatingLikeModalProps) => {
  const [stars, setStars] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (stars < 1) {
      toast.error("Wybierz ocenę 1-5 gwiazdek");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_rating_with_like", {
        _track_id: trackId,
        _stars: stars,
        _listened_seconds: Math.floor(listenedSeconds),
      });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) {
        const errMap: Record<string, string> = {
          cannot_rate_own_track: "Nie możesz ocenić własnego utworu 🎵",
          track_not_found: "Utwór nie istnieje",
          invalid_stars: "Nieprawidłowa liczba gwiazdek",
          unauthorized: "Musisz być zalogowany",
        };
        toast.error(errMap[res?.error || ""] || res?.error || "Nie udało się zapisać oceny");
        return;
      }
      toast.success(`Oceniono ${stars}★ — dodano do polubionych ❤️`);
      onSuccess?.();
      handleClose();
    } catch (e: any) {
      toast.error(e.message || "Błąd zapisu oceny");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStars(0);
    setHover(0);
    onClose();
  };

  const labels = ["", "Słabe", "Średnie", "Dobre", "Świetne", "Genialne"];
  const tooShort = listenedSeconds < 30;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary fill-primary" />
            Oceń utwór, aby polubić
          </DialogTitle>
          <DialogDescription className="text-foreground/70">
            <span className="font-semibold">{trackTitle}</span> — {trackArtist}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.button
                key={n}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setStars(n)}
                className="p-1"
                aria-label={`${n} gwiazdek`}
              >
                <Star
                  className={cn(
                    "h-9 w-9 transition-colors",
                    (hover || stars) >= n
                      ? "fill-primary text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]"
                      : "text-muted-foreground"
                  )}
                />
              </motion.button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={hover || stars}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm font-medium text-primary h-5"
            >
              {labels[hover || stars] || "Wybierz gwiazdki"}
            </motion.p>
          </AnimatePresence>

          <div className="mt-4 text-center text-xs">
            <span className={cn("font-mono", tooShort ? "text-yellow-500" : "text-green-500")}>
              ⏱ Odsłuchano: {Math.floor(listenedSeconds)}s {tooShort && "(za krótko — admin oznaczy jako podejrzane)"}
            </span>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            <X className="h-4 w-4 mr-1" /> Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={stars < 1 || submitting}
            className="bg-primary hover:bg-primary/80"
          >
            {submitting ? "Zapisuję..." : `Polub z ${stars || "?"}★`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
