import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Zap, Star, Sparkles, X, Infinity, Music, Radio, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans: {
  id: string;
  name: string;
  price: string;
  period: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  features: string[];
  current?: boolean;
  popular?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "forever",
    icon: Music,
    color: "text-muted-foreground",
    features: [
      "Basic streaming",
      "Limited skips",
      "Ads between songs",
      "Standard quality",
    ],
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "9.99",
    period: "/month",
    icon: Zap,
    color: "text-primary",
    popular: true,
    features: [
      "Unlimited streaming",
      "No ads",
      "HQ Audio (320kbps)",
      "AI DJ & Mood Detection",
      "Offline downloads",
      "5 AI playlists/day",
    ],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "19.99",
    period: "/month",
    icon: Crown,
    color: "text-accent",
    features: [
      "Everything in Pro",
      "Lossless Audio (FLAC)",
      "Unlimited AI playlists",
      "AI Psychologist reports",
      "Priority support",
      "Early access to features",
      "Custom AI DJ personality",
    ],
  },
];

export const UpgradeModal = ({ open, onOpenChange }: UpgradeModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = async () => {
    if (selectedPlan === "free") {
      toast.info("You're already on the Free plan!");
      return;
    }
    
    setIsProcessing(true);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    
    toast.success(`🎉 Welcome to GrouAI ${selectedPlan === "pro" ? "Pro" : "Ultimate"}! Enjoy premium features.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-border bg-card">
        {/* Header with gradient */}
        <div className="relative overflow-hidden px-6 pt-8 pb-6">
          <div className="absolute inset-0 groove-gradient-bg opacity-10" />
          <motion.div
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
            className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10"
          />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              >
                <Crown className="h-8 w-8 text-accent" />
              </motion.div>
              <DialogTitle className="text-2xl font-display groove-gradient-text">
                Upgrade GrouAI Stream
              </DialogTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              Odblokuj pełen potencjał AI muzyki
            </p>
          </DialogHeader>
        </div>

        {/* Plans */}
        <div className="px-6 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {plans.map((plan) => (
              <motion.button
                key={plan.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  "relative flex flex-col rounded-xl p-5 text-left transition-all border",
                  selectedPlan === plan.id
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-secondary/30 hover:border-muted-foreground/30"
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 groove-gradient-bg text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
                    POPULAR
                  </span>
                )}
                
                <div className="flex items-center gap-2 mb-3">
                  <plan.icon className={cn("h-5 w-5", plan.color)} />
                  <span className="font-display font-semibold">{plan.name}</span>
                </div>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold font-display">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                
                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs">
                      <Check className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", plan.color)} />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {selectedPlan === plan.id && (
                  <motion.div
                    layoutId="plan-ring"
                    className="absolute inset-0 rounded-xl border-2 border-primary pointer-events-none"
                  />
                )}
              </motion.button>
            ))}
          </div>

          {/* CTA */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              onClick={handleUpgrade}
              disabled={isProcessing || selectedPlan === "free"}
              className="w-full h-12 groove-gradient-bg text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 gap-2"
            >
              {isProcessing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                  Processing...
                </>
              ) : selectedPlan === "free" ? (
                "Current Plan"
              ) : (
                <>
                  <Crown className="h-5 w-5" />
                  Upgrade to {plans.find(p => p.id === selectedPlan)?.name}
                </>
              )}
            </Button>
          </motion.div>
          
          <p className="text-center text-xs text-muted-foreground mt-3">
            Cancel anytime • 7-day free trial • No credit card required
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
