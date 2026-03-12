import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOS_INSTALL_KEY = "grouai_ios_install_dismissed";
const PWA_INSTALL_KEY = "grouai_pwa_install_dismissed";

export const PWAInstallPrompt = () => {
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running as PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Detect iOS
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    if (ios) {
      // Show iOS-specific prompt after delay if not dismissed
      const dismissed = localStorage.getItem(IOS_INSTALL_KEY);
      if (!dismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 3000);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Chrome/Edge/Firefox - listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem(PWA_INSTALL_KEY);
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(isIOS ? IOS_INSTALL_KEY : PWA_INSTALL_KEY, "1");
  };

  if (isStandalone || !showPrompt) return null;

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
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="shrink-0 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground mb-0.5">
                Zainstaluj GrouAI DJ
              </h3>
              {isIOS ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kliknij{" "}
                  <span className="inline-flex items-center">
                    <svg className="h-3.5 w-3.5 mx-0.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7-7 7 7" />
                      <rect x="4" y="18" width="16" height="2" rx="1" />
                    </svg>
                  </span>{" "}
                  <strong>Udostępnij</strong> → <strong>Dodaj do ekranu początkowego</strong>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dodaj na pulpit — działa jak natywna aplikacja, offline i błyskawicznie!
                </p>
              )}
            </div>
          </div>

          {!isIOS && deferredPrompt && (
            <div className="mt-3 flex gap-2">
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="flex-1 text-xs"
              >
                Nie teraz
              </Button>
              <Button
                onClick={handleInstall}
                size="sm"
                className="flex-1 text-xs gap-1.5 bg-primary hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" />
                Zainstaluj
              </Button>
            </div>
          )}

          {isIOS && (
            <div className="mt-3">
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="w-full text-xs"
              >
                Rozumiem
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
