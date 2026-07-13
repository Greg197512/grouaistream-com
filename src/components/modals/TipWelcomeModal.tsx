import { motion, AnimatePresence } from "framer-motion";
import { Heart, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTipWallet } from "@/hooks/useTipWallet";
import { useAuth } from "@/contexts/AuthContext";

export const TipWelcomeModal = () => {
  const { user } = useAuth();
  const { wallet, markWelcomeSeen, loading } = useTipWallet();

  if (loading || !user || !wallet) return null;
  if (wallet.welcome_seen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", damping: 18 }}
          className="w-full max-w-md"
        >
          <Card className="border-2 border-pink-500/50 bg-gradient-to-br from-pink-950/60 via-rose-950/40 to-amber-950/30 backdrop-blur-xl shadow-2xl shadow-pink-500/20">
            <CardContent className="p-6 text-center space-y-5">
              <motion.div
                initial={{ rotate: -15, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.15, type: "spring" }}
                className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/40"
              >
                <Gift className="h-10 w-10 text-white" />
              </motion.div>

              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span className="text-xs uppercase tracking-widest text-amber-300 font-bold">Prezent powitalny</span>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </div>
                <h2 className="text-3xl font-extrabold bg-gradient-to-r from-pink-300 via-rose-200 to-amber-200 bg-clip-text text-transparent">
                  Masz 5 $ na tipy 🎁
                </h2>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Otrzymujesz <span className="text-pink-300 font-bold">5 $ startowych credit&apos;ów</span> do wsparcia ulubionych artystów.
                <br />
                Klikaj <Heart className="inline h-3.5 w-3.5 text-pink-400 fill-pink-400 mx-0.5" /> przy utworach i wybieraj kwotę: <span className="font-bold text-foreground">1 $ · 2 $ · 5 $ · 10 $</span>
              </p>

              <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3 text-xs text-pink-200/90">
                💡 <span className="font-semibold">90 %</span> każdego tipu trafia bezpośrednio do artysty.
                <br />
                Po wykorzystaniu credit&apos;ów poczekaj na doładowanie od admina.
              </div>

              <Button
                onClick={markWelcomeSeen}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold gap-2 h-11"
              >
                <Heart className="h-4 w-4 fill-white" />
                Świetnie, zaczynam wspierać!
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
