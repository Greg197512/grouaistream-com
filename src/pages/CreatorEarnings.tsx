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
  ShieldCheck, Lock, BadgeCheck, Globe
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

const CreatorEarnings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<MonetizedTrack[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [totalStreams, setTotalStreams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [boostTrack, setBoostTrack] = useState<{ id: string; title: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Load user tracks with monetization info
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
    toast.success(enabled ? "Monetyzacja włączona ✨" : "Monetyzacja wyłączona");
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <LogIn className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-3">Zaloguj się</h1>
          <p className="text-muted-foreground mb-6">Musisz być zalogowany, aby zobaczyć swoje zarobki</p>
          <Button onClick={() => navigate("/auth")}>Zaloguj się</Button>
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
            Moje Zarobki
          </h1>
          <p className="text-muted-foreground mt-1">
            Zarządzaj monetyzacją swoich utworów i śledź zarobki
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-card/50 backdrop-blur border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Zarobki ogółem</p>
                    <p className="text-2xl font-bold text-primary">{totalEarnings.toFixed(2)} zł</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary/40" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-card/50 backdrop-blur border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Ten miesiąc</p>
                    <p className="text-2xl font-bold text-accent">{monthlyEarnings.toFixed(2)} zł</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-accent/40" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-card/50 backdrop-blur border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Streamy łącznie</p>
                    <p className="text-2xl font-bold">{totalStreams.toLocaleString()}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Security Trust Bar */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 py-3 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15"
        >
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Lock className="h-3.5 w-3.5" />
            <span>Szyfrowanie SSL/TLS</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Bezpieczne płatności Stripe</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" />
            <span>Zgodność z RODO</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Globe className="h-3.5 w-3.5" />
            <span>Serwery EU/NL</span>
          </div>
        </motion.div>

        {/* Info Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 flex items-start gap-3">
            <ArrowUpRight className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Stawka: 0.003 zł / stream (65% dla twórcy)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Każde odsłuchanie powyżej 30 sekund = 1 stream. Wypłaty przez Stripe Connect (wkrótce).
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator className="bg-white/10" />

        {/* Tracks List */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Music className="h-5 w-5" />
            Twoje utwory ({tracks.length})
          </h2>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Ładowanie...</div>
          ) : tracks.length === 0 ? (
            <Card className="bg-card/50 border-white/10">
              <CardContent className="py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nie masz jeszcze żadnych utworów</p>
                <Button onClick={() => navigate("/upload")} className="mt-4">
                  Dodaj pierwszy utwór
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
                      {/* Cover */}
                      <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                        <HQCover
                          src={track.cover_url}
                          alt={track.title}
                          genre={track.genre}
                          artist={track.artist}
                          className="h-full w-full"
                        />
                      </div>

                      {/* Info */}
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

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Streamy</p>
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {Number(track.total_streams).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Zarobek</p>
                          <p className="text-sm font-semibold text-primary">
                            {Number(track.total_earnings).toFixed(2)} zł
                          </p>
                        </div>
                      </div>

                      {/* Boost + Toggle */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-400 hover:text-amber-300 hidden sm:flex"
                          onClick={() => setBoostTrack({ id: track.id, title: track.title })}
                        >
                          <Rocket className="h-3.5 w-3.5 mr-1" />
                          Boost
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
      {/* Boost Modal */}
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
