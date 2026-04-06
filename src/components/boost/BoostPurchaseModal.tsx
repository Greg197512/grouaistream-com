import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Zap, Crown, Star, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BoostPackage {
  id: string;
  name: string;
  impressions: number;
  price: number;
  icon: typeof Rocket;
  color: string;
  features: string[];
}

const PACKAGES: BoostPackage[] = [
  {
    id: "basic",
    name: "Starter",
    impressions: 5000,
    price: 4.99,
    icon: Zap,
    color: "text-blue-400",
    features: ["5 000 wyświetleń", "7 dni promocji", "Badge 'Promowany'"],
  },
  {
    id: "pro",
    name: "Pro",
    impressions: 25000,
    price: 11.99,
    icon: Rocket,
    color: "text-amber-400",
    features: ["25 000 wyświetleń", "14 dni promocji", "Badge 'Promowany'", "Sekcja 'Promowane' na głównej"],
  },
  {
    id: "ultra",
    name: "Ultra",
    impressions: 100000,
    price: 34.99,
    icon: Crown,
    color: "text-primary",
    features: ["100 000 wyświetleń", "30 dni promocji", "Badge 'Promowany'", "Sekcja 'Promowane' na głównej", "Priorytet w rekomendacjach AI"],
  },
];

interface BoostPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
}

export const BoostPurchaseModal = ({ isOpen, onClose, trackId, trackTitle }: BoostPurchaseModalProps) => {
  const { user } = useAuth();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePurchase = async (pkg: BoostPackage) => {
    if (!user) {
      toast.error("Zaloguj się, aby kupić pakiet Boost");
      return;
    }

    setPurchasing(pkg.id);

    try {
      const daysMap: Record<string, number> = { basic: 7, pro: 14, ultra: 30 };
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (daysMap[pkg.id] || 30));

      // Insert boost record
      const { error: boostError } = await supabase.from("track_boosts").insert({
        track_id: trackId,
        user_id: user.id,
        package_type: pkg.id,
        impressions_total: pkg.impressions,
        amount_paid: pkg.price,
        expires_at: expiresAt.toISOString(),
      } as any);

      if (boostError) throw boostError;

      // Update track boost status
      await supabase.from("tracks").update({
        is_boosted: true,
        boost_expires_at: expiresAt.toISOString(),
      } as any).eq("id", trackId).eq("user_id", user.id);

      toast.success(`🚀 Pakiet ${pkg.name} aktywowany dla "${trackTitle}"!`);
      onClose();
    } catch (err: any) {
      console.error("Boost purchase error:", err);
      toast.error("Błąd zakupu: " + (err.message || ""));
    } finally {
      setPurchasing(null);
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
          className="w-full max-w-3xl"
        >
          <Card className="bg-card/95 backdrop-blur border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Boost: {trackTitle}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Promuj swój utwór — więcej wyświetleń, wyższe pozycje
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PACKAGES.map((pkg) => {
                  const Icon = pkg.icon;
                  return (
                    <motion.div
                      key={pkg.id}
                      whileHover={{ scale: 1.03 }}
                      className={cn(
                        "relative rounded-xl border p-5 flex flex-col",
                        pkg.id === "pro"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-white/10 bg-white/5"
                      )}
                    >
                      {pkg.id === "pro" && (
                        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px]">
                          Najpopularniejszy
                        </Badge>
                      )}
                      <Icon className={cn("h-8 w-8 mb-3", pkg.color)} />
                      <h3 className="font-bold text-lg">{pkg.name}</h3>
                      <p className="text-2xl font-bold mt-1">
                        {pkg.price} <span className="text-sm font-normal text-muted-foreground">€</span>
                      </p>
                      <ul className="mt-4 space-y-2 flex-1">
                        {pkg.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Check className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="mt-4 w-full"
                        variant={pkg.id === "pro" ? "default" : "outline"}
                        disabled={purchasing !== null}
                        onClick={() => handlePurchase(pkg)}
                      >
                        {purchasing === pkg.id ? "Przetwarzanie..." : "Kup pakiet"}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                💳 Płatności Stripe wkrótce. Obecnie pakiety są aktywowane natychmiast (tryb testowy).
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
