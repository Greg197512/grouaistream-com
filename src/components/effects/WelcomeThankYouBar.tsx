import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Heart, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Pasek z podziękowaniem dla NOWEGO członka — pojawia się przy pierwszym logowaniu
 * (isFirstLogin), na górze ekranu, w stylu paska „Live" z admina. Personalizowany
 * imieniem, ciepłe słowa od GrouaRock & GrouAI Stream. Znika sam po ~18 s albo po X.
 */
export const WelcomeThankYouBar = () => {
  const { isFirstLogin, user, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isFirstLogin) return;
    const display =
      (profile as any)?.display_name ||
      (user?.user_metadata as any)?.display_name ||
      (user?.email ? user.email.split("@")[0] : "") ||
      "Twórco";
    setName(display);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 18000);
    return () => clearTimeout(t);
  }, [isFirstLogin, user, profile]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -70, opacity: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 26 }}
          className="fixed inset-x-0 top-0 z-[60] px-3 pt-2 sm:px-6"
        >
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-full border border-primary/30 bg-gradient-to-r from-primary/15 via-background/90 to-accent/15 shadow-[0_8px_30px_hsl(var(--primary)/0.35)] backdrop-blur-md">
            <div className="flex items-center gap-3 py-2 pl-3 pr-2">
              <div className="flex shrink-0 items-center gap-2 border-r border-primary/30 pr-3">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="hidden text-xs font-bold uppercase tracking-wider text-primary sm:inline">Witamy</span>
              </div>
              <p className="flex-1 truncate text-sm font-medium text-foreground/90">
                <span className="font-bold text-primary">{name}</span>, dziękujemy, że jesteś z nami! 🎶
                <span className="hidden sm:inline"> Twoja muzyka ma tu dom — tworzymy to razem.</span>
                <span className="ml-1 text-muted-foreground">— GrouaRock &amp; GrouAI Stream</span>
              </p>
              <Heart className="hidden h-4 w-4 shrink-0 text-rose-400 sm:block" />
              <button
                onClick={() => setVisible(false)}
                aria-label="Zamknij"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
