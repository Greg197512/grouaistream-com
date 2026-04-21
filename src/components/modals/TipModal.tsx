import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTipWallet } from "@/hooks/useTipWallet";
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
  const { wallet, refresh } = useTipWallet();
  const [selected, setSelected] = useState<number>(5);
  const [sending, setSending] = useState(false);

  const balance = wallet?.balance ?? 0;
  const insufficientFunds = balance < selected;

  // Auto-select najwyższą dostępną kwotę gdy modal się otwiera
  useEffect(() => {
    if (!isOpen || !wallet) return;
    const affordable = TIP_AMOUNTS.filter(a => a <= balance);
    if (affordable.length > 0) {
      setSelected(affordable[affordable.length - 1]);
    }
  }, [isOpen, wallet, balance]);

  const handleSendTip = async () => {
    if (!user) {
      toast.error(t("tip.loginRequired") || "Zaloguj się aby wysłać tip");
      return;
    }
    if (insufficientFunds) {
      toast.error(`Brak środków. Saldo: ${balance.toFixed(2)}€`);
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.rpc("send_tip", {
        _track_id: trackId,
        _amount: selected,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        const errMap: Record<string, string> = {
          insufficient_balance: `Brak środków. Saldo: ${result.balance?.toFixed(2)}€`,
          cannot_self_tip: "Nie możesz wysłać tipa na własny utwór 😉",
          track_no_owner: "Ten utwór nie ma właściciela",
          invalid_amount: "Nieprawidłowa kwota",
          unauthorized: "Zaloguj się aby wysłać tip",
        };
        toast.error(errMap[result?.error] || "Nie udało się wysłać tipu");
        return;
      }

      toast.success(`Wysłano ${selected}€ ❤️ → artysta dostał ${result.artist_received.toFixed(2)}€`);
      // Brain event
      supabase.rpc("emit_agent_event", {
        _event_type: "tip.sent",
        _source: "tip-modal",
        _actor_user_id: user.id,
        _target_type: "track",
        _target_id: trackId,
        _payload: { amount: selected, artist_received: result.artist_received },
        _priority: 4,
      }).then(() => {}, () => {});
      await refresh();
      onClose();
    } catch (err: any) {
      console.error("Tip error:", err);
      toast.error(t("tip.error") || "Błąd wysyłania");
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

              {/* Saldo portfela */}
              <div className="flex items-center justify-between bg-pink-500/10 border border-pink-500/30 rounded-lg p-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <Wallet className="h-3.5 w-3.5 text-pink-300" />
                  <span className="text-muted-foreground">Twoje saldo tipów:</span>
                </div>
                <span className="font-bold text-pink-300">{balance.toFixed(2)} €</span>
              </div>

              {/* Amount buttons */}
              <div className="grid grid-cols-4 gap-2">
                {TIP_AMOUNTS.map((amount) => {
                  const tooExpensive = amount > balance;
                  return (
                    <motion.button
                      key={amount}
                      whileHover={!tooExpensive ? { scale: 1.05 } : {}}
                      whileTap={!tooExpensive ? { scale: 0.95 } : {}}
                      onClick={() => !tooExpensive && setSelected(amount)}
                      disabled={tooExpensive}
                      className={cn(
                        "rounded-xl py-3 text-center font-bold text-lg border transition-all",
                        tooExpensive
                          ? "border-white/5 text-muted-foreground/30 cursor-not-allowed bg-muted/20"
                          : selected === amount
                            ? "bg-pink-500/20 border-pink-500/50 text-pink-400 shadow-lg shadow-pink-500/10"
                            : "border-white/10 text-muted-foreground hover:border-white/20"
                      )}
                    >
                      {amount}
                      <span className="text-xs font-normal block">€</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg p-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Artysta dostaje 90% (= {(selected * 0.9).toFixed(2)} €). Tipy nie do wypłaty.</span>
              </div>

              {/* Brak środków — komunikat */}
              {insufficientFunds && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-center">
                  Brak środków na tip {selected} €. Poczekaj na doładowanie od admina.
                </div>
              )}

              {/* Send button */}
              <Button
                onClick={handleSendTip}
                disabled={sending || insufficientFunds || !user}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
                {sending ? "Wysyłanie..." : `Wyślij ${selected} €`}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
