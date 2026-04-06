import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIP_AMOUNTS = [1, 2, 5, 10];

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
}

export const TipModal = ({ isOpen, onClose, trackId, trackTitle, trackArtist }: TipModalProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selected, setSelected] = useState<number>(10);
  const [sending, setSending] = useState(false);

  const handleSendTip = async () => {
    if (!user) {
      toast.error(t("tip.loginRequired"));
      return;
    }

    setSending(true);
    try {
      // Get track owner
      const { data: track } = await supabase
        .from("tracks")
        .select("user_id")
        .eq("id", trackId)
        .single();

      if (!track?.user_id) {
        toast.error(t("tip.noOwner"));
        return;
      }

      // Creator gets 90%
      const creatorAmount = selected * 0.9;

      const { error } = await supabase.from("creator_earnings").insert({
        user_id: track.user_id,
        track_id: trackId,
        amount: creatorAmount,
        earning_type: "tip",
        description: `Tip ${selected} zł from listener (90% = ${creatorAmount.toFixed(2)} zł)`,
      } as any);

      if (error) throw error;

      toast.success(`${t("tip.sent")} ${selected} zł ❤️`);
      onClose();
    } catch (err: any) {
      console.error("Tip error:", err);
      toast.error(t("tip.error"));
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm"
        >
          <Card className="bg-card/95 backdrop-blur border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-pink-400 fill-pink-400" />
                  {t("tip.title")}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[250px]">
                  {trackTitle} — {trackArtist}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("tip.desc")}
              </p>

              {/* Amount buttons */}
              <div className="grid grid-cols-4 gap-2">
                {TIP_AMOUNTS.map((amount) => (
                  <motion.button
                    key={amount}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelected(amount)}
                    className={cn(
                      "rounded-xl py-3 text-center font-bold text-lg border transition-all",
                      selected === amount
                        ? "bg-pink-500/20 border-pink-500/50 text-pink-400 shadow-lg shadow-pink-500/10"
                        : "border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                  >
                    {amount}
                    <span className="text-xs font-normal block">zł</span>
                  </motion.button>
                ))}
              </div>

              {/* Info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg p-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>{t("tip.creatorGets")}</span>
              </div>

              {/* Send button */}
              <Button
                onClick={handleSendTip}
                disabled={sending}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold gap-2"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
                {sending ? t("tip.sending") : `${t("tip.send")} ${selected} zł`}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
