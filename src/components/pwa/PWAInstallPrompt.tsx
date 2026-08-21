import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Ustawiane, gdy user zainstaluje albo potwierdzi instrukcję iOS — wtedy nie pokazujemy ponownie.
const PWA_INSTALLED_KEY = "grouai_pwa_installed";

export const PWAInstallPrompt = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // beforeinstallprompt (Chrome/Edge — telefon, tablet, Mac/Windows)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    // Gdy user zainstaluje — schowaj i zapamiętaj.
    const installed = () => { localStorage.setItem(PWA_INSTALLED_KEY, "1"); setShowPrompt(false); };
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
  }, []);

  // Ręczne wywołanie z Ustawień („Dodaj do ekranu głównego") — pokaż prompt niezależnie
  // od tego, czy był już zamknięty. Jeśli aplikacja jest już zainstalowana, nic nie robi.
  useEffect(() => {
    const showOnDemand = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      if (standalone) return;
      if (isIOS || !deferredPrompt) setIosGuide(!deferredPrompt && !isIOS ? false : isIOS);
      setShowPrompt(true);
    };
    window.addEventListener("grouai-show-install", showOnDemand);
    return () => window.removeEventListener("grouai-show-install", showOnDemand);
  }, [isIOS, deferredPrompt]);

  // Pokaż po zalogowaniu, jeśli da się zainstalować (Chrome), albo na iOS (ręczna instrukcja).
  useEffect(() => {
    if (!user || isStandalone) return;
    if (localStorage.getItem(PWA_INSTALLED_KEY)) return;
    const canOffer = deferredPrompt !== null || isIOS || isMobile;
    if (!canOffer) return;
    const timer = setTimeout(() => setShowPrompt(true), 2500);
    return () => clearTimeout(timer);
  }, [user, isStandalone, deferredPrompt, isIOS, isMobile]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") localStorage.setItem(PWA_INSTALLED_KEY, "1");
      setDeferredPrompt(null);
      setShowPrompt(false);
      return;
    }
    // Brak natywnego prompta (np. Firefox/inne) — pokaż instrukcję ręczną.
    setIosGuide(true);
  }, [deferredPrompt]);

  const handleYes = useCallback(() => {
    if (isIOS || !deferredPrompt) { setIosGuide(true); return; }
    void handleInstall();
  }, [isIOS, deferredPrompt, handleInstall]);

  const handleAck = useCallback(() => {
    localStorage.setItem(PWA_INSTALLED_KEY, "1");
    setShowPrompt(false);
    setIosGuide(false);
  }, []);

  const handleDismiss = useCallback(() => { setShowPrompt(false); setIosGuide(false); }, []);

  if (isStandalone || !showPrompt) return null;

  const t = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`fixed z-[200] left-3 right-3 ${isMobile ? "bottom-20" : "bottom-6"} max-w-md mx-auto`}
      >
        <div className="rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/10 p-4">
          <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="shrink-0 h-12 w-12 rounded-xl overflow-hidden ring-1 ring-primary/30">
              <img src="/grouai-icon.svg" alt="GrouAI" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground mb-0.5">
                {iosGuide
                  ? t("Zainstaluj GrouAI", "Install GrouAI", "Installeer GrouAI", "Встанови GrouAI")
                  : t("Chcesz mieć GrouAI jak aplikację?", "Want GrouAI as an app?", "Wil je GrouAI als app?", "Хочеш GrouAI як застосунок?")}
              </h3>
              {iosGuide ? (
                <ol className="text-[11px] text-muted-foreground/80 leading-relaxed mt-1 space-y-0.5">
                  <li className="flex items-center gap-1.5">1. {t("Kliknij", "Tap", "Tik op", "Натисни")} <Share className="inline h-3.5 w-3.5" /> {t("(Udostępnij)", "(Share)", "(Delen)", "(Поділитися)")}</li>
                  <li className="flex items-center gap-1.5">2. {t("Wybierz", "Choose", "Kies", "Обери")} <Plus className="inline h-3.5 w-3.5" /> {t("„Do ekranu początkowego”", "“Add to Home Screen”", "“Zet op beginscherm”", "„На екран Домівки”")}</li>
                  <li>3. {t("Kliknij „Dodaj”", "Tap “Add”", "Tik op “Voeg toe”", "Натисни „Додати”")}</li>
                </ol>
              ) : (
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  {t("Na telefon, tablet i Mac — pełny ekran, szybciej, jak natywna apka.",
                     "For phone, tablet and Mac — full screen, faster, like a native app.",
                     "Voor telefoon, tablet en Mac — volledig scherm, sneller, als een echte app.",
                     "На телефон, планшет і Mac — на весь екран, швидше, як справжній застосунок.")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {iosGuide ? (
              <Button onClick={handleAck} size="sm" className="flex-1 text-xs bg-primary hover:bg-primary/90">
                {t("Rozumiem", "Got it", "Begrepen", "Зрозуміло")}
              </Button>
            ) : (
              <>
                <Button onClick={handleDismiss} variant="ghost" size="sm" className="flex-1 text-xs">
                  {t("Nie", "No", "Nee", "Ні")}
                </Button>
                <Button onClick={handleYes} size="sm" className="flex-1 text-xs bg-primary hover:bg-primary/90">
                  {t("Tak, zainstaluj", "Yes, install", "Ja, installeer", "Так, встанови")}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
