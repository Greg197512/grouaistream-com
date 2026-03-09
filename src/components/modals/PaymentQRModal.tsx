import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Zap, ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, SubscriptionPlan } from "@/contexts/SubscriptionContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaymentQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: "pro" | "ultimate";
}

const PLAN_CONFIG = {
  pro: {
    name: "Pro",
    price: "9,99 €",
    priceNum: 9.99,
    icon: Zap,
    color: "text-primary",
    bgGlow: "from-emerald-500/20 to-primary/20",
    revolutUrl: "https://revolut.me/grouaaistream/9.99",
    successMsg: "Pro odblokowane! Miłego korzystania 🎉",
    accentClass: "bg-emerald-500",
  },
  ultimate: {
    name: "Ultimate",
    price: "19,99 €",
    priceNum: 19.99,
    icon: Crown,
    color: "text-amber-400",
    bgGlow: "from-amber-500/20 to-yellow-500/20",
    revolutUrl: "https://revolut.me/grouaaistream/19.99",
    successMsg: "Ultimate odblokowane! Jesteś w topie 👑",
    accentClass: "bg-amber-500",
  },
};

const QR_VALIDITY_SECONDS = 300; // 5 min
const AUTO_CHECK_SECONDS = 120;

type PaymentState = "qr" | "checking" | "success" | "failed";

export const PaymentQRModal = ({ open, onOpenChange, plan }: PaymentQRModalProps) => {
  const [state, setState] = useState<PaymentState>("qr");
  const [timeLeft, setTimeLeft] = useState(QR_VALIDITY_SECONDS);
  const [autoCheckTimer, setAutoCheckTimer] = useState(AUTO_CHECK_SECONDS);
  const [qrKey, setQrKey] = useState(0);
  const { refreshSubscription } = useSubscription();

  const config = PLAN_CONFIG[plan];
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(config.revolutUrl)}&bgcolor=1a1a2e&color=ffffff&format=png`;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setState("qr");
      setTimeLeft(QR_VALIDITY_SECONDS);
      setAutoCheckTimer(AUTO_CHECK_SECONDS);
      setQrKey(prev => prev + 1);
    }
  }, [open]);

  // QR validity countdown
  useEffect(() => {
    if (!open || state !== "qr") return;
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [open, state, timeLeft]);

  // Auto-check countdown
  useEffect(() => {
    if (!open || state !== "qr") return;
    if (autoCheckTimer <= 0) {
      handleCheckPayment();
      return;
    }
    const interval = setInterval(() => setAutoCheckTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [open, state, autoCheckTimer]);

  const handleCheckPayment = useCallback(async () => {
    setState("checking");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setState("failed");
        return;
      }

      // Check if subscription was already updated (e.g. by admin or webhook)
      const { data } = await supabase
        .from("user_subscriptions")
        .select("plan, status")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (data && data.plan === plan) {
        setState("success");
        await refreshSubscription();
        toast.success(config.successMsg);
        setTimeout(() => onOpenChange(false), 3000);
        return;
      }

      // Simulate: upsert subscription (in production, verify via Revolut API)
      const { error } = await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: session.user.id,
          plan: plan as any,
          status: "active",
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;

      setState("success");
      await refreshSubscription();
      toast.success(config.successMsg);
      setTimeout(() => onOpenChange(false), 3000);
    } catch (err) {
      console.error("Payment check error:", err);
      setState("failed");
    }
  }, [plan, config, refreshSubscription, onOpenChange]);

  const handleRefreshQR = () => {
    setState("qr");
    setTimeLeft(QR_VALIDITY_SECONDS);
    setAutoCheckTimer(AUTO_CHECK_SECONDS);
    setQrKey(prev => prev + 1);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const PlanIcon = config.icon;
  const qrExpired = timeLeft <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-full max-h-[95vh] p-0 overflow-hidden border-border bg-card">
        <div className="overflow-y-auto max-h-[95vh]">
          {/* Header */}
          <div className="relative overflow-hidden px-5 pt-5 pb-4">
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", config.bgGlow)} />
            <div className="relative flex items-center gap-3">
              <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <PlanIcon className={cn("h-6 w-6", config.color)} />
              <div>
                <h2 className="text-lg font-bold font-display">{config.name} – {config.price}/mies.</h2>
                <p className="text-xs text-muted-foreground">Zapłać BLIKIEM – bez karty, bez rejestracji</p>
              </div>
            </div>
          </div>

          <div className="px-5 pb-6">
            <AnimatePresence mode="wait">
              {/* QR State */}
              {state === "qr" && (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center"
                >
                  <p className="text-center text-sm font-medium text-foreground mb-4">
                    Zeskanuj kod QR w aplikacji bankowej
                  </p>

                  {/* QR Code */}
                  <div className="relative bg-card border-2 border-border rounded-2xl p-4 mb-4">
                    {qrExpired && (
                      <div className="absolute inset-0 bg-card/90 rounded-2xl flex flex-col items-center justify-center z-10">
                        <XCircle className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Kod wygasł</p>
                        <Button size="sm" onClick={handleRefreshQR} className="mt-3 gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Wygeneruj nowy
                        </Button>
                      </div>
                    )}
                    <img
                      key={qrKey}
                      src={qrUrl}
                      alt="QR kod płatności"
                      className="w-56 h-56 sm:w-64 sm:h-64 rounded-lg"
                      loading="eager"
                    />
                  </div>

                  {/* Timer */}
                  {!qrExpired && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Kod ważny: <span className={cn("font-mono font-bold", timeLeft < 60 ? "text-destructive" : "text-foreground")}>{formatTime(timeLeft)}</span></span>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-secondary/40 rounded-xl p-3 w-full mb-4">
                    <p className="text-xs text-center text-muted-foreground leading-relaxed">
                      Otwórz apkę bankową → zeskanuj kod → wpłać kwotę
                    </p>
                  </div>

                  {/* Check button */}
                  {!qrExpired && (
                    <>
                      <Button
                        onClick={handleCheckPayment}
                        className={cn("w-full h-11 rounded-xl font-semibold gap-2", config.accentClass, "hover:opacity-90 text-white")}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Sprawdź, czy przyszło
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center mt-2">
                        Auto-sprawdzenie za {formatTime(autoCheckTimer)}
                      </p>
                    </>
                  )}

                  <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
                    Płatność powyżej 10 € – jeśli bank zapyta, potwierdź w apce
                  </p>
                </motion.div>
              )}

              {/* Checking State */}
              {state === "checking" && (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-12"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <QrCode className="h-12 w-12 text-primary" />
                  </motion.div>
                  <p className="text-sm font-medium mt-4">Sprawdzam płatność...</p>
                  <p className="text-xs text-muted-foreground mt-1">To może zająć chwilę</p>
                </motion.div>
              )}

              {/* Success State */}
              {state === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-10"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center mb-4",
                      plan === "pro" ? "bg-emerald-500/20" : "bg-amber-500/20"
                    )}
                  >
                    <CheckCircle2 className={cn("h-10 w-10", plan === "pro" ? "text-emerald-400" : "text-amber-400")} />
                  </motion.div>

                  {/* Confetti-like particles */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                      animate={{
                        opacity: 0,
                        x: (Math.random() - 0.5) * 200,
                        y: (Math.random() - 0.5) * 200,
                        scale: 0,
                      }}
                      transition={{ duration: 1.2, delay: i * 0.05 }}
                      className={cn(
                        "absolute w-2 h-2 rounded-full",
                        plan === "pro" ? "bg-emerald-400" : "bg-amber-400"
                      )}
                      style={{ top: "40%", left: "50%" }}
                    />
                  ))}

                  <h3 className="text-xl font-bold font-display mb-1">{config.name} aktywne!</h3>
                  <p className="text-sm text-muted-foreground text-center">{config.successMsg}</p>
                  <p className="text-xs text-muted-foreground mt-4">Przekierowanie za 3 sekundy...</p>
                </motion.div>
              )}

              {/* Failed State */}
              {state === "failed" && (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-10"
                >
                  <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Płatność nie dotarła</h3>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    Spróbuj ponownie lub wygeneruj nowy kod QR
                  </p>
                  <div className="flex gap-3 w-full">
                    <Button variant="outline" onClick={handleRefreshQR} className="flex-1 gap-1.5 rounded-xl">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Odśwież QR
                    </Button>
                    <Button onClick={handleCheckPayment} className="flex-1 gap-1.5 rounded-xl">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sprawdź ponownie
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
