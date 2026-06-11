import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Copy, Check, Gift, TrendingUp, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ReferralStats {
  referral_code: string | null;
  referred_count: number;
  total_commission: number;
  this_month_commission: number;
}

/**
 * Panel programu poleceń — jednopoziomowy program afiliacyjny.
 * Użytkownik udostępnia swój link; gdy polecona osoba wykupi abonament,
 * dostaje 20% prowizji od każdej jej płatności przez 12 miesięcy.
 */
export const ReferralPanel = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase.rpc as any)("get_my_referral_stats")
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && data?.ok) {
          setStats({
            referral_code: data.referral_code,
            referred_count: data.referred_count ?? 0,
            total_commission: Number(data.total_commission ?? 0),
            this_month_commission: Number(data.this_month_commission ?? 0),
          });
        }
      })
      .catch(() => {});
  }, [user]);

  if (!user || !stats?.referral_code) return null;

  const referralLink = `https://www.grouaistream.com/?ref=${stats.referral_code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link skopiowany! Udostępnij go znajomym 🎉");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "GrouAI Stream",
          text: "Dołącz do GrouAI Stream — uczciwy streaming muzyki z AI! 🎵",
          url: referralLink,
        });
      } catch { /* anulowane */ }
    } else {
      copyLink();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-5 w-5 text-primary" />
            Program poleceń — zarabiaj 20% z każdego abonamentu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Udostępnij swój link. Gdy polecona osoba wykupi abonament (Pro lub
            Ultimate), dostajesz <strong className="text-foreground">20% prowizji od każdej jej
            płatności przez 12 miesięcy</strong>. Prowizje wpadają do Twoich zarobków
            i wypłacasz je razem z resztą (od 50 PLN).
          </p>

          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono truncate">
              {referralLink}
            </div>
            <Button size="icon" variant="outline" onClick={copyLink} title="Kopiuj link">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="icon" onClick={shareLink} title="Udostępnij">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold">{stats.referred_count}</div>
              <div className="text-[11px] text-muted-foreground">poleconych osób</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold">{stats.this_month_commission.toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground">prowizja w tym mies.</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <Gift className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold">{stats.total_commission.toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground">prowizja łącznie</div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            Program jednopoziomowy: prowizja przysługuje wyłącznie za abonamenty
            osób poleconych bezpośrednio przez Ciebie. Brak wynagrodzenia za samą
            rekrutację — zarabiasz tylko od realnych płatności.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};
