import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Loader2, Sparkles } from "lucide-react";

interface TopTrack { id: string; title: string; cover_url: string | null; likes: number }
interface RecentFan { liked_at: string; track_title: string; fan_name: string | null; fan_avatar: string | null }

export const MyLikesCard = () => {
  const [given, setGiven] = useState(0);
  const [received, setReceived] = useState(0);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [recentFans, setRecentFans] = useState<RecentFan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_my_likes_stats");
      const d = data as any;
      if (d && !d.error) {
        setGiven(d.likes_given || 0);
        setReceived(d.likes_received || 0);
        setTopTracks(d.top_tracks || []);
        setRecentFans(d.recent_fans || []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <Card className="border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-purple-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4 text-pink-400" fill="currentColor" />
          Twoje polubienia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
            <div className="text-xs text-muted-foreground">Otrzymane ❤️</div>
            <div className="text-2xl font-bold text-pink-300">{received}</div>
            <div className="text-[10px] text-muted-foreground">od innych userów</div>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="text-xs text-muted-foreground">Dane ❤️</div>
            <div className="text-2xl font-bold text-purple-300">{given}</div>
            <div className="text-[10px] text-muted-foreground">innym artystom</div>
          </div>
        </div>

        {topTracks.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />Twoje top utwory wg ❤️
            </div>
            <div className="space-y-1.5">
              {topTracks.slice(0, 5).map((t, i) => (
                <div key={t.id} className="flex items-center gap-2 text-xs p-2 rounded bg-secondary/30">
                  <span className="text-muted-foreground w-4">{i + 1}.</span>
                  <span className="flex-1 truncate font-medium">{t.title}</span>
                  <span className="text-pink-300 font-bold">❤️ {t.likes}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentFans.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">Ostatni fani</div>
            <div className="space-y-1.5">
              {recentFans.slice(0, 5).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={f.fan_avatar || undefined} />
                    <AvatarFallback className="text-[10px]">{(f.fan_name || "?")[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{f.fan_name || "Anonim"}</span>
                  <span className="text-muted-foreground">polubił/a</span>
                  <span className="truncate flex-1 text-pink-300">{f.track_title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {given === 0 && received === 0 && (
          <div className="text-center text-xs text-muted-foreground py-4">
            Brak aktywności. Polub utwory innych artystów lub wgraj swoje, aby zacząć!
          </div>
        )}
      </CardContent>
    </Card>
  );
};
