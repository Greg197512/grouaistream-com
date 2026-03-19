import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Permanent key — set only when user installs or clicks "Rozumiem" on iOS
const PWA_INSTALLED_KEY = "grouai_pwa_installed";

export const PWAInstallPrompt = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Capture the beforeinstallprompt event (Chrome/Edge/Firefox)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Detect platform once
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
  }, []);

  // Show prompt after login on mobile — only if not already installed
  useEffect(() => {
    if (!user || !isMobile || isStandalone) return;
    if (localStorage.getItem(PWA_INSTALLED_KEY)) return;

    const timer = setTimeout(() => setShowPrompt(true), 2000);
    return () => clearTimeout(timer);
  }, [user, isMobile, isStandalone]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(PWA_INSTALLED_KEY, "1");
      }
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  }, [deferredPrompt]);

  const handleIOSConfirm = useCallback(() => {
    // User acknowledged iOS instructions — mark as "installed" permanently
    localStorage.setItem(PWA_INSTALLED_KEY, "1");
    setShowPrompt(false);
  }, []);

  const handleDismiss = useCallback(() => {
    // Just close for this session — will show again on next login
    setShowPrompt(false);
  }, []);

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
                onClick={handleIOSConfirm}
                size="sm"
                className="flex-1 text-xs gap-1.5 bg-primary hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" />
                Rozumiem, zainstaluję
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
