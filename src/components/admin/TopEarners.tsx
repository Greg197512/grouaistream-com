import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HQCover } from "@/components/ui/HQCover";
import { Trophy, TrendingUp, BarChart3, Heart, Music, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EarnerData {
  user_id: string;
  display_name: string | null;
  total_earnings: number;
  monthly_earnings: number;
  total_streams: number;
  tip_earnings: number;
  track_count: number;
  top_track: { title: string; cover_url: string | null; genre: string | null } | null;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = [
  "border-amber-400/40 bg-amber-500/5",
  "border-zinc-300/40 bg-zinc-300/5",
  "border-orange-600/40 bg-orange-600/5",
];

export const TopEarners = () => {
  const [earners, setEarners] = useState<EarnerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopEarners();
  }, []);

  const fetchTopEarners = async () => {
    try {
      // Get all tracks grouped by user
      const { data: tracks } = await supabase
        .from("tracks")
        .select("user_id, title, cover_url, genre, total_earnings, total_streams")
        .not("user_id", "is", null)
        .order("total_earnings", { ascending: false });

      if (!tracks || tracks.length === 0) {
        setLoading(false);
        return;
      }

      // Aggregate by user
      const userMap = new Map<string, {
        total_earnings: number;
        total_streams: number;
        track_count: number;
        top_track: { title: string; cover_url: string | null; genre: string | null } | null;
      }>();

      for (const t of tracks) {
        if (!t.user_id) continue;
        const existing = userMap.get(t.user_id);
        if (existing) {
          existing.total_earnings += Number(t.total_earnings);
          existing.total_streams += Number(t.total_streams);
          existing.track_count += 1;
        } else {
          userMap.set(t.user_id, {
            total_earnings: Number(t.total_earnings),
            total_streams: Number(t.total_streams),
            track_count: 1,
            top_track: { title: t.title, cover_url: t.cover_url, genre: t.genre },
          });
        }
      }

      // Sort by earnings and take top 3
      const sortedUserIds = Array.from(userMap.entries())
        .sort((a, b) => b[1].total_earnings - a[1].total_earnings)
        .slice(0, 3);

      // Get profiles
      const userIds = sortedUserIds.map(([uid]) => uid);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      // Get monthly earnings
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyData } = await supabase
        .from("creator_earnings")
        .select("user_id, amount")
        .in("user_id", userIds)
        .gte("created_at", startOfMonth.toISOString());

      // Get tip earnings
      const { data: tipData } = await supabase
        .from("creator_earnings")
        .select("user_id, amount")
        .in("user_id", userIds)
        .eq("earning_type", "tip");

      const monthlyMap = new Map<string, number>();
      monthlyData?.forEach((e) => {
        monthlyMap.set(e.user_id, (monthlyMap.get(e.user_id) || 0) + Number(e.amount));
      });

      const tipMap = new Map<string, number>();
      tipData?.forEach((e) => {
        tipMap.set(e.user_id, (tipMap.get(e.user_id) || 0) + Number(e.amount));
      });

      const profileMap = new Map<string, string | null>();
      profiles?.forEach((p) => profileMap.set(p.user_id, p.display_name));

      const result: EarnerData[] = sortedUserIds.map(([uid, data]) => ({
        user_id: uid,
        display_name: profileMap.get(uid) || null,
        total_earnings: data.total_earnings,
        monthly_earnings: monthlyMap.get(uid) || 0,
        total_streams: data.total_streams,
        tip_earnings: tipMap.get(uid) || 0,
        track_count: data.track_count,
        top_track: data.top_track,
      }));

      setEarners(result);
    } catch (err) {
      console.error("Error fetching top earners:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="py-8 text-center text-muted-foreground">Ładowanie top twórców...</CardContent>
      </Card>
    );
  }

  if (earners.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            Top 3 — Zarobki twórców
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Brak danych o zarobkach twórców
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          Top 3 — Zarobki twórców
        </CardTitle>
        <CardDescription>Twórcy z największymi zarobkami na platformie</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {earners.map((earner, i) => (
          <motion.div
            key={earner.user_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className={cn(
              "rounded-xl border p-4 space-y-3",
              MEDAL_COLORS[i] || "border-white/10 bg-white/5"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <span className="text-2xl">{MEDALS[i]}</span>
              {earner.top_track?.cover_url && (
                <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0">
                  <HQCover
                    src={earner.top_track.cover_url}
                    alt={earner.display_name || ""}
                    genre={earner.top_track.genre}
                    artist={earner.display_name || ""}
                    className="h-full w-full"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{earner.display_name || "Anonim"}</p>
                <p className="text-xs text-muted-foreground">
                  {earner.track_count} utworów • Top: {earner.top_track?.title || "—"}
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-background/40 p-2.5 text-center">
                <DollarSign className="h-3.5 w-3.5 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Zarobki ogółem</p>
                <p className="text-sm font-bold text-primary">{earner.total_earnings.toFixed(2)} €</p>
              </div>
              <div className="rounded-lg bg-background/40 p-2.5 text-center">
                <TrendingUp className="h-3.5 w-3.5 mx-auto text-accent mb-1" />
                <p className="text-xs text-muted-foreground">Ten miesiąc</p>
                <p className="text-sm font-bold text-accent">{earner.monthly_earnings.toFixed(2)} €</p>
              </div>
              <div className="rounded-lg bg-background/40 p-2.5 text-center">
                <BarChart3 className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Streamy</p>
                <p className="text-sm font-bold">{earner.total_streams.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-background/40 p-2.5 text-center">
                <Heart className="h-3.5 w-3.5 mx-auto text-pink-400 mb-1" />
                <p className="text-xs text-muted-foreground">Tipy</p>
                <p className="text-sm font-bold text-pink-400">{earner.tip_earnings.toFixed(2)} €</p>
              </div>
            </div>

            {/* Revenue split reminder */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Streamy: 65%</span>
              <span>•</span>
              <span>Tipy: 90%</span>
              <span>•</span>
              <span>Boost: 70%</span>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
};
