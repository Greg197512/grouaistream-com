import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { HQCover } from "@/components/ui/HQCover";
import { motion } from "framer-motion";
import { 
  DollarSign, TrendingUp, Music, BarChart3, 
  Wallet, ArrowUpRight, LogIn, Eye, Rocket,
  ShieldCheck, Lock, BadgeCheck, Globe, Clock,
  Download, Heart, Percent
} from "lucide-react";
import { BoostPurchaseModal } from "@/components/boost/BoostPurchaseModal";
import { TrackBadges } from "@/components/ui/TrackBadges";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface MonetizedTrack {
  id: string;
  title: string;
  artist: string;
  genre: string | null;
  cover_url: string | null;
  is_monetized: boolean;
  total_streams: number;
  total_earnings: number;
  audio_url: string | null;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
}

const CreatorEarnings = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<MonetizedTrack[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [totalStreams, setTotalStreams] = useState(0);
  const [tipEarnings, setTipEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [boostTrack, setBoostTrack] = useState<{ id: string; title: string } | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: tracksData } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, cover_url, is_monetized, total_streams, total_earnings, audio_url")
      .eq("user_id", user.id)
      .order("total_streams", { ascending: false });

    if (tracksData) {
      setTracks(tracksData as MonetizedTrack[]);
      setTotalEarnings(tracksData.reduce((sum, t) => sum + Number(t.total_earnings), 0));
      setTotalStreams(tracksData.reduce((sum, t) => sum + Number(t.total_streams), 0));
    }

    // Monthly earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthData } = await supabase
      .from("creator_earnings")
      .select("amount")
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    if (monthData) {
      setMonthlyEarnings(monthData.reduce((sum, e) => sum + Number(e.amount), 0));
    }

    // Tip earnings total
    const { data: tipData } = await supabase
      .from("creator_earnings")
      .select("amount")
      .eq("user_id", user.id)
      .eq("earning_type", "tip");

    if (tipData) {
      setTipEarnings(tipData.reduce((sum, e) => sum + Number(e.amount), 0));
    }

    // Payout requests
    const { data: payoutData } = await supabase
      .from("payout_requests")
      .select("id, amount, status, requested_at, processed_at")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false });

    if (payoutData) {
      setPayouts(payoutData as PayoutRequest[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleMonetization = async (trackId: string, enabled: boolean) => {
    const { error } = await supabase
      .from("tracks")
      .update({ 
        is_monetized: enabled,
        monetization_enabled_at: enabled ? new Date().toISOString() : null 
      })
      .eq("id", trackId)
      .eq("user_id", user!.id);

    if (error) {
      toast.error("Błąd aktualizacji monetyzacji");
      return;
    }

    setTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, is_monetized: enabled } : t
    ));
    toast.success(enabled ? t("earnings.monetizationOn") : t("earnings.monetizationOff"));
  };

  const handleRequestPayout = async () => {
    if (!user) return;
    if (totalEarnings < 12) {
      toast.error(t("earnings.minPayout"));
      return;
    }

    // Check pending payouts
    const paidOut = payouts
      .filter(p => p.status === "pending" || p.status === "processing")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const available = totalEarnings - paidOut;
    if (available < 12) {
      toast.error(t("earnings.minPayout"));
      return;
    }

    setRequestingPayout(true);
    try {
      const { error } = await supabase.from("payout_requests").insert({
        user_id: user.id,
        amount: available,
      });

      if (error) throw error;
      toast.success(t("earnings.payoutRequested"));
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setRequestingPayout(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <LogIn className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-3">{t("earnings.loginTitle")}</h1>
          <p className="text-muted-foreground mb-6">{t("earnings.loginDesc")}</p>
          <Button onClick={() => navigate("/auth")}>{t("earnings.loginTitle")}</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            {t("earnings.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("earnings.subtitle")}</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("earnings.totalEarnings"), value: `${totalEarnings.toFixed(2)} €`, icon: DollarSign, color: "text-primary" },
            { label: t("earnings.thisMonth"), value: `${monthlyEarnings.toFixed(2)} €`, icon: TrendingUp, color: "text-accent" },
            { label: t("earnings.totalStreams"), value: totalStreams.toLocaleString(), icon: BarChart3, color: "text-muted-foreground" },
            { label: t("earnings.tipsTotal"), value: `${tipEarnings.toFixed(2)} €`, icon: Heart, color: "text-pink-400" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="bg-card/50 backdrop-blur border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                      <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                    </div>
                    <stat.icon className={cn("h-6 w-6 opacity-40", stat.color)} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Revenue Split Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card/50 backdrop-blur border-white/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-3">
                <Percent className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("earnings.revenueSplit")}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
                  <p className="text-lg font-bold text-emerald-400">65%</p>
                  <p className="text-[10px] text-muted-foreground">{t("earnings.fromStreams")}</p>
                </div>
                <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/15">
                  <p className="text-lg font-bold text-pink-400">90%</p>
                  <p className="text-[10px] text-muted-foreground">{t("earnings.fromTips")}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/15">
                  <p className="text-lg font-bold text-amber-400">70%</p>
                  <p className="text-[10px] text-muted-foreground">{t("earnings.fromBoost")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Trust Bar */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 py-3 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15"
        >
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Lock className="h-3.5 w-3.5" />
            <span>{t("security.ssl")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{t("security.stripe")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" />
            <span>{t("security.gdpr")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Globe className="h-3.5 w-3.5" />
            <span>{t("security.euServers")}</span>
          </div>
        </motion.div>

        {/* Payout Section */}
        <Card className="bg-card/50 backdrop-blur border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5 text-primary" />
              {t("earnings.payouts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("earnings.availableForPayout")}</p>
                <p className="text-xl font-bold text-primary">
                  {Math.max(0, totalEarnings - payouts.filter(p => p.status !== "rejected").reduce((s, p) => s + Number(p.amount), 0)).toFixed(2)} €
                </p>
                <p className="text-[10px] text-muted-foreground">{t("earnings.minPayoutInfo")}</p>
              </div>
              <Button 
                onClick={handleRequestPayout}
                disabled={requestingPayout || totalEarnings < 50}
                className="bg-gradient-to-r from-emerald-500 to-green-600 text-white gap-2"
              >
                <Wallet className="h-4 w-4" />
                {t("earnings.requestPayout")}
              </Button>
            </div>

            {payouts.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">{t("earnings.payoutHistory")}</p>
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{new Date(p.requested_at).toLocaleDateString()}</span>
                    </div>
                    <span className="text-sm font-semibold">{Number(p.amount).toFixed(2)} €</span>
                    <Badge className={cn(
                      "text-[10px]",
                      p.status === "completed" ? "bg-green-500/15 text-green-400 border-green-500/25" :
                      p.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
                      "bg-red-500/15 text-red-400 border-red-500/25"
                    )}>
                      {p.status === "completed" ? t("earnings.paid") : 
                       p.status === "pending" ? t("earnings.pending") : t("earnings.rejected")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="bg-white/10" />

        {/* Tracks List */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Music className="h-5 w-5" />
            {t("earnings.yourTracks")} ({tracks.length})
          </h2>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">{t("earnings.loading")}</div>
          ) : tracks.length === 0 ? (
            <Card className="bg-card/50 border-white/10">
              <CardContent className="py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t("earnings.noTracks")}</p>
                <Button onClick={() => navigate("/upload")} className="mt-4">
                  {t("earnings.addFirst")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tracks.map((track, i) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="bg-card/30 backdrop-blur border-white/5 hover:border-white/15 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                        <HQCover src={track.cover_url} alt={track.title} genre={track.genre} artist={track.artist} className="h-full w-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{track.title}</p>
                          <TrackBadges
                            isMonetized={track.is_monetized}
                            isBoosted={(track as any).is_boosted}
                            isAIAssisted={track.audio_url?.includes("suno")}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("earnings.streams")}</p>
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {Number(track.total_streams).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("earnings.earned")}</p>
                          <p className="text-sm font-semibold text-primary">{Number(track.total_earnings).toFixed(2)} €</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-400 hover:text-amber-300 hidden sm:flex"
                          onClick={() => setBoostTrack({ id: track.id, title: track.title })}
                        >
                          <Rocket className="h-3.5 w-3.5 mr-1" />
                          {t("earnings.boost")}
                        </Button>
                        <span className="text-[10px] text-muted-foreground hidden md:inline">
                          {track.is_monetized ? "ON" : "OFF"}
                        </span>
                        <Switch
                          checked={track.is_monetized}
                          onCheckedChange={(v) => toggleMonetization(track.id, v)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      {boostTrack && (
        <BoostPurchaseModal
          isOpen={!!boostTrack}
          onClose={() => setBoostTrack(null)}
          trackId={boostTrack.id}
          trackTitle={boostTrack.title}
        />
      )}
    </MainLayout>
  );
};

export default CreatorEarnings;
