import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Challenge {
  active: boolean;
  id?: string;
  title?: string;
  description?: string;
  activity_type?: string;
  target_count?: number;
  reward_amount?: number;
  ends_at?: string;
  progress?: number;
  claimed?: boolean;
  eligible?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  uploads: "uploadów",
  ratings: "ocen ★",
  mood_sessions: "sesji nastroju",
  studio_tracks: "utworów Studio",
  listens: "odsłuchań",
};

export const WeekendChallengeCard = () => {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_active_weekend_challenge");
    if (!error && data) setChallenge(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClaim = async () => {
    if (!challenge?.id) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_weekend_challenge", { _challenge_id: challenge.id });
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || "Nie udało się odebrać");
    } else {
      toast.success(`🎉 +${(data as any).amount}$ trafiło do portfela!`);
      load();
    }
    setClaiming(false);
  };

  if (loading || !challenge?.active) return null;

  const pct = Math.min(100, ((challenge.progress || 0) / (challenge.target_count || 1)) * 100);
  const endsIn = challenge.ends_at ? new Date(challenge.ends_at) : null;
  const hoursLeft = endsIn ? Math.max(0, Math.floor((endsIn.getTime() - Date.now()) / 3_600_000)) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-300">
            <Sparkles className="h-5 w-5 animate-pulse" />
            Wyzwanie weekendowe AI
            <Badge variant="outline" className="ml-auto text-xs border-amber-500/40">
              <Calendar className="h-3 w-3 mr-1" />{hoursLeft}h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="font-bold text-lg">{challenge.title}</div>
            <div className="text-sm text-muted-foreground">{challenge.description}</div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {challenge.progress}/{challenge.target_count} {TYPE_LABELS[challenge.activity_type!] || ""}
              </span>
              <span className="font-bold text-amber-300">+{challenge.reward_amount} $</span>
            </div>
            <Progress value={pct} className="h-2 [&>div]:bg-amber-400" />
          </div>
          {challenge.claimed ? (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 w-full justify-center py-2">
              ✅ Bonus odebrany — w portfelu
            </Badge>
          ) : challenge.eligible ? (
            <Button onClick={handleClaim} disabled={claiming} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold">
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trophy className="h-4 w-4 mr-2" />Odbierz +{challenge.reward_amount}$</>}
            </Button>
          ) : (
            <div className="text-xs text-center text-muted-foreground">
              Jeszcze {(challenge.target_count || 0) - (challenge.progress || 0)} do nagrody
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
