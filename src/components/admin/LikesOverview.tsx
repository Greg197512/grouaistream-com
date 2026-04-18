import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Heart, Loader2, RefreshCw, Trophy, Music, Users } from "lucide-react";
import { toast } from "sonner";

interface Summary {
  total_likes: number;
  unique_fans: number;
  unique_tracks_liked: number;
  likes_today: number;
  likes_week: number;
}
interface Fan { user_id: string; likes_given: number; email: string | null; display_name: string | null }
interface TrackRow { id: string; title: string; artist: string; owner_name: string | null; likes_count: number }
interface ArtistRow { user_id: string; display_name: string | null; email: string | null; total_likes_received: number; tracks_with_likes: number }

export const LikesOverview = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fans, setFans] = useState<Fan[]>([]);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_likes_overview");
    if (error) {
      toast.error("Błąd: " + error.message);
    } else {
      const d = data as any;
      setSummary(d?.summary || null);
      setFans(d?.top_fans || []);
      setTracks(d?.top_tracks || []);
      setArtists(d?.top_artists || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Heart className="h-3 w-3" />Wszystkie ❤️</div>
            <div className="text-xl font-bold text-pink-300">{summary.total_likes}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" />Fani</div>
            <div className="text-xl font-bold text-blue-300">{summary.unique_fans}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Music className="h-3 w-3" />Lubiane utwory</div>
            <div className="text-xl font-bold text-emerald-300">{summary.unique_tracks_liked}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Dziś</div>
            <div className="text-xl font-bold text-amber-300">+{summary.likes_today}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Ten tydzień</div>
            <div className="text-xl font-bold text-amber-300">+{summary.likes_week}</div>
          </CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" />Rankingi polubień</CardTitle>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3 w-3 mr-1" />Odśwież</Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="artists">
            <TabsList>
              <TabsTrigger value="artists">Top artyści</TabsTrigger>
              <TabsTrigger value="tracks">Top utwory</TabsTrigger>
              <TabsTrigger value="fans">Top fani</TabsTrigger>
            </TabsList>

            <TabsContent value="artists" className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Artysta</TableHead>
                  <TableHead className="text-right">Lajki otrzymane</TableHead>
                  <TableHead className="text-right">Utwory z ❤️</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {artists.map((a, i) => (
                    <TableRow key={a.user_id}>
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold">{a.display_name || "—"}</div>
                        <div className="text-muted-foreground">{a.email}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-pink-300">{a.total_likes_received}</TableCell>
                      <TableCell className="text-right text-xs">{a.tracks_with_likes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="tracks" className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Utwór</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead className="text-right">Lajki</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {tracks.map((t, i) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="text-xs font-semibold max-w-[260px] truncate">{t.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.owner_name || t.artist}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30">❤️ {t.likes_count}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="fans" className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Fan</TableHead>
                  <TableHead className="text-right">Lajki dane</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fans.map((f, i) => (
                    <TableRow key={f.user_id}>
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold">{f.display_name || "—"}</div>
                        <div className="text-muted-foreground">{f.email}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-pink-300">{f.likes_given}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
