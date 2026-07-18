import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { 
  Users, 
  BarChart3, 
  Mail, 
  Shield, 
  TrendingUp,
  Activity,
  Loader2,
  AlertTriangle,
  Music,
  Play,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Lock,
  Plus,
  ToggleLeft,
  ToggleRight,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Track, usePlayer } from "@/contexts/PlayerContext";
import { finalizeTrackDeletion } from "@/lib/trackDeletion";
import { fetchGeoList, UserGeo } from "@/lib/hubGeo";
import { RadioStationManager } from "@/components/admin/RadioStationManager";
import { StorageStats } from "@/components/admin/StorageStats";
import { CoverFillPanel } from "@/components/admin/CoverFillPanel";
import { AdminEmailDashboard } from "@/components/admin/AdminEmailDashboard";
import { AIModeratorRankings } from "@/components/admin/AIModeratorRankings";
import { TopEarners } from "@/components/admin/TopEarners";
import { Radio as RadioIcon, HardDrive, Award, DollarSign, Megaphone } from "lucide-react";
import { MarqueeManager } from "@/components/admin/MarqueeManager";
import { BonusMonitor } from "@/components/admin/BonusMonitor";
import PayoutsAdminPanel from "@/components/admin/PayoutsAdminPanel";
import { FinancialOverview } from "@/components/admin/FinancialOverview";
import { TipsOverview } from "@/components/admin/TipsOverview";
import { SubscriptionsAdminPanel } from "@/components/admin/SubscriptionsAdminPanel";
import { PaddleAdminPanel } from "@/components/admin/PaddleAdminPanel";
import { OperationalCosts } from "@/components/admin/OperationalCosts";
import { LikesOverview } from "@/components/admin/LikesOverview";
import { SEODashboard } from "@/components/admin/SEODashboard";
import { TikTokStoriesPanel } from "@/components/admin/TikTokStoriesPanel";
import { TikTokReelsStudio } from "@/components/admin/TikTokReelsStudio";
import { AIBuilderProgress } from "@/components/admin/AIBuilderProgress";
import { FaceLearningPanel } from "@/components/admin/FaceLearningPanel";
import { B2BPricingPanel } from "@/components/admin/B2BPricingPanel";
import { CostReportsPanel } from "@/components/admin/CostReportsPanel";
import { BreakEvenPanel } from "@/components/admin/BreakEvenPanel";
import { CostAlertBanner } from "@/components/admin/CostAlertBanner";

interface UserStats {
  totalUsers: number;
  activeToday: number;
  totalMoodSessions: number;
  totalTracks: number;
}

interface GenreStats {
  genre: string;
  count: number;
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
}

interface TrackData {
  id: string;
  title: string;
  artist: string;
  genre: string | null;
  video_url: string | null;
  audio_url: string | null;
  created_at: string;
}

// GeneratedEmail type removed - now handled in AdminEmailDashboard

// Kod kraju ISO (np. "PL") → emoji flagi.
const flagEmoji = (cc?: string | null) => {
  if (!cc || cc.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
};

export default function Admin() {
  const { isAdmin, loading, user } = useAdminAuth();
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [deletingGenre, setDeletingGenre] = useState<string | null>(null);
  const [deletingTrack, setDeletingTrack] = useState<string | null>(null);
  const [genreStats, setGenreStats] = useState<GenreStats[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [testingTrack, setTestingTrack] = useState<string | null>(null);
  const [testedTracks, setTestedTracks] = useState<Map<string, boolean>>(new Map());
  // Lokalizacja userów (IP/miasto) — z huba, kluczowane po user_id oraz e-mailu.
  const [geoByUser, setGeoByUser] = useState<Record<string, UserGeo>>({});
  
  // Email state removed - now handled in AdminEmailDashboard
  // Verification state
  const [verifyingTracks, setVerifyingTracks] = useState(false);
  const [brokenTracks, setBrokenTracks] = useState<TrackData[]>([]);
  const [deletingBroken, setDeletingBroken] = useState(false);

  // Unlock codes state
  const [unlockCodes, setUnlockCodes] = useState<{ id: string; code: string; label: string; is_active: boolean; created_at: string }[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newCodeLabel, setNewCodeLabel] = useState("");
  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Brak uprawnień administratora");
      navigate("/");
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
      fetchUnlockCodes();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    try {
      // Fetch real stats via security definer function
      const { data: adminStats } = await supabase.rpc("get_admin_stats");

      // Fetch all users with emails via admin RPC
      const { data: allUsersData } = await supabase.rpc("get_all_users_for_admin");
      
      if (Array.isArray(allUsersData)) {
        const mappedUsers: UserData[] = allUsersData.map((u: any) => ({
          id: u.id,
          email: u.email || "Brak",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          display_name: u.display_name,
        }));
        setUsers(mappedUsers);
      }

      // Lokalizacja userów (IP/miasto) z huba — mapujemy po user_id oraz e-mailu.
      try {
        const geoRows = await fetchGeoList();
        const map: Record<string, UserGeo> = {};
        for (const g of geoRows) {
          if (g.user_id) map[g.user_id] = g;
          if (g.email) map[g.email.toLowerCase()] = g;
        }
        setGeoByUser(map);
      } catch { /* geo opcjonalne */ }

      // Fetch genre breakdown
      const { data: allTracks } = await supabase
        .from("tracks")
        .select("genre");
      
      const genreCounts = new Map<string, number>();
      allTracks?.forEach(t => {
        const g = t.genre || "Nieznany";
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      });
      
      const genreData: GenreStats[] = Array.from(genreCounts.entries())
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count);
      
      setGenreStats(genreData);

      // Fetch recent tracks
      const { data: recentData } = await supabase
        .from("tracks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      setRecentTracks(recentData || []);
      setTracks((recentData || []).map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        genre: t.genre,
        video_url: t.video_url,
        audio_url: t.audio_url,
        created_at: t.created_at
      })));

      // Use real stats from DB function
      const realStats = adminStats as { total_mood_sessions: number; active_today: number; total_tracks: number; total_users: number } | null;
      
      setStats({
        totalUsers: realStats?.total_users || 0,
        activeToday: realStats?.active_today || 0,
        totalMoodSessions: realStats?.total_mood_sessions || 0,
        totalTracks: realStats?.total_tracks || 0,
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Błąd ładowania danych");
    } finally {
      setLoadingData(false);
    }
  };

  const fetchUnlockCodes = async () => {
    const { data } = await supabase.from("unlock_codes").select("*").order("created_at", { ascending: false });
    setUnlockCodes(data || []);
  };

  const addUnlockCode = async () => {
    if (!newCode.trim()) { toast.error("Podaj kod"); return; }
    const { error } = await supabase.from("unlock_codes").insert({ code: newCode.trim(), label: newCodeLabel.trim() || "Nowy kod" });
    if (error) { toast.error("Błąd: " + error.message); return; }
    toast.success("Dodano kod: " + newCode);
    setNewCode(""); setNewCodeLabel("");
    fetchUnlockCodes();
  };

  const toggleCodeActive = async (id: string, currentActive: boolean) => {
    await supabase.from("unlock_codes").update({ is_active: !currentActive }).eq("id", id);
    fetchUnlockCodes();
  };

  const deleteUnlockCode = async (id: string) => {
    if (!confirm("Usunąć ten kod?")) return;
    await supabase.from("unlock_codes").delete().eq("id", id);
    toast.success("Kod usunięty");
    fetchUnlockCodes();
  };

  const testTrack = async (track: Track) => {
    setTestingTrack(track.id);
    try {
      // Try to play the track
      playTrack(track);
      
      // Mark as tested successfully
      setTestedTracks(prev => new Map(prev).set(track.id, true));
      toast.success(`✓ "${track.title}" - YouTube działa!`);
    } catch (error) {
      setTestedTracks(prev => new Map(prev).set(track.id, false));
      toast.error(`✗ Błąd odtwarzania: ${track.title}`);
    } finally {
      setTestingTrack(null);
    }
  };

  const testRandomTracks = async () => {
    const categories = ["K-pop", "Latin", "Hip-Hop", "Hip-hop", "Techno", "Trance", "Polish Rock", "Polish Pop"];
    const toTest: Track[] = [];
    
    for (const cat of categories) {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .ilike("genre", `%${cat}%`)
        .limit(1);
      
      if (data && data.length > 0) {
        toTest.push(data[0]);
      }
    }

    toast.info(`Testuję ${toTest.length} utworów z różnych kategorii...`);
    
    for (const track of toTest) {
      setTestingTrack(track.id);
      await new Promise(r => setTimeout(r, 1000));
      setTestedTracks(prev => new Map(prev).set(track.id, true));
    }
    
    setTestingTrack(null);
    toast.success(`Przetestowano ${toTest.length} utworów!`);
  };

  const verifyBrokenTracks = async () => {
    setVerifyingTracks(true);
    setBrokenTracks([]);
    
    try {
      // Find tracks without valid video_url or audio_url
      const { data: allTracksData } = await supabase
        .from("tracks")
        .select("id, title, artist, genre, video_url, audio_url, created_at")
        .order("created_at", { ascending: false });
      
      const broken: TrackData[] = [];
      
      for (const track of allTracksData || []) {
        // Check if track has no URL at all
        if (!track.video_url && !track.audio_url) {
          broken.push(track);
          continue;
        }
        
        // For YouTube URLs, try to verify thumbnail exists
        if (track.video_url && track.video_url.includes("youtube")) {
          const videoId = extractVideoId(track.video_url);
          if (!videoId) {
            broken.push(track);
          }
        }
      }
      
      setBrokenTracks(broken);
      
      if (broken.length > 0) {
        toast.warning(`Znaleziono ${broken.length} utworów bez działających linków`);
      } else {
        toast.success("Wszystkie utwory mają poprawne linki!");
      }
    } catch (error) {
      console.error("Error verifying tracks:", error);
      toast.error("Błąd weryfikacji utworów");
    } finally {
      setVerifyingTracks(false);
    }
  };

  const extractVideoId = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const deleteAllBroken = async () => {
    if (!confirm(`Czy na pewno chcesz usunąć ${brokenTracks.length} niedziałających utworów? Ta operacja jest nieodwracalna!`)) {
      return;
    }
    
    setDeletingBroken(true);
    try {
      const trackIds = brokenTracks.map(t => t.id);
      
      // Delete from playlist_tracks first
      await supabase
        .from("playlist_tracks")
        .delete()
        .in("track_id", trackIds);
      
      // Delete from liked_songs
      await supabase
        .from("liked_songs")
        .delete()
        .in("track_id", trackIds);
      
      // Delete from listening_history
      await supabase
        .from("listening_history")
        .delete()
        .in("track_id", trackIds);

      // Delete from radio_likes
      await supabase
        .from("radio_likes")
        .delete()
        .in("track_id", trackIds);

      // Delete from radio_schedule
      await supabase
        .from("radio_schedule")
        .delete()
        .in("track_id", trackIds);
      
      // Delete tracks
      const { error } = await supabase
        .from("tracks")
        .delete()
        .in("id", trackIds);
      
      if (error) throw error;
      
      toast.success(`Usunięto ${brokenTracks.length} niedziałających utworów`);
      setBrokenTracks([]);
      fetchAdminData();
    } catch (error) {
      console.error("Error deleting broken tracks:", error);
      toast.error("Błąd usuwania utworów");
    } finally {
      setDeletingBroken(false);
    }
  };

  const exportStats = () => {
    const data = {
      date: new Date().toISOString(),
      stats,
      genreBreakdown: genreStats,
      totalGenres: genreStats.length,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grouai-stats-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Statystyki wyeksportowane!");
  };

  // Email functions removed - now handled in AdminEmailDashboard
  const deleteGenre = async (genre: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć wszystkie utwory z gatunku "${genre}"? Ta operacja jest nieodwracalna!`)) {
      return;
    }
    
    setDeletingGenre(genre);
    try {
      // First get all track IDs for this genre
      const { data: tracksToDelete } = await supabase
        .from("tracks")
        .select("id")
        .eq("genre", genre);
      
      if (tracksToDelete && tracksToDelete.length > 0) {
        const trackIds = tracksToDelete.map(t => t.id);
        
        // Delete from playlist_tracks first (foreign key)
        await supabase
          .from("playlist_tracks")
          .delete()
          .in("track_id", trackIds);
        
        // Delete from liked_songs
        await supabase
          .from("liked_songs")
          .delete()
          .in("track_id", trackIds);
        
        // Delete from listening_history
        await supabase
          .from("listening_history")
          .delete()
          .in("track_id", trackIds);
        
        // Finally delete tracks
        const { error } = await supabase
          .from("tracks")
          .delete()
          .eq("genre", genre);
        
        if (error) throw error;
        
        toast.success(`Usunięto ${tracksToDelete.length} utworów z gatunku "${genre}"`);
        fetchAdminData();
      }
    } catch (error) {
      console.error("Error deleting genre:", error);
      toast.error("Błąd usuwania gatunku");
    } finally {
      setDeletingGenre(null);
    }
  };

  const deleteTrack = async (trackId: string, trackTitle: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć "${trackTitle}"?`)) {
      return;
    }
    
    setDeletingTrack(trackId);
    try {
      // Delete from playlist_tracks first
      await supabase
        .from("playlist_tracks")
        .delete()
        .eq("track_id", trackId);
      
      // Delete from liked_songs
      await supabase
        .from("liked_songs")
        .delete()
        .eq("track_id", trackId);
      
      // Delete from listening_history
      await supabase
        .from("listening_history")
        .delete()
        .eq("track_id", trackId);
      
      // Finally delete track
      const { error } = await supabase
        .from("tracks")
        .delete()
        .eq("id", trackId);
      
      if (error) throw error;

      // Skasuj pliki ze storage + rozgłoś usunięcie do CAŁEJ apki (player + listy + inni użytkownicy).
      const deleted = recentTracks.find(t => t.id === trackId);
      await finalizeTrackDeletion({
        id: trackId,
        audio_url: deleted?.audio_url,
        video_url: deleted?.video_url,
        cover_url: (deleted as { cover_url?: string | null } | undefined)?.cover_url,
      });

      toast.success(`Usunięto "${trackTitle}" z całej aplikacji`);
      setTracks(prev => prev.filter(t => t.id !== trackId));
      setRecentTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (error) {
      console.error("Error deleting track:", error);
      toast.error("Błąd usuwania utworu");
    } finally {
      setDeletingTrack(null);
    }
  };

  const maxGenreCount = genreStats[0]?.count || 1;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <AlertTriangle className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Brak dostępu</h1>
          <p className="text-muted-foreground">Nie masz uprawnień administratora.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Panel Administratora
            </h1>
            <p className="text-muted-foreground mt-1">
              Zarządzaj systemem GrouAI Stream
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Zalogowany jako: <span className="text-primary font-medium">{user?.email}</span>
          </div>
        </motion.div>

        {/* Aurora Quick Access */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-3 md:grid-cols-3"
        >
          <button
            onClick={() => navigate("/admin/aurora")}
            className="group text-left rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 hover:border-primary/70 hover:from-primary/25 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-primary/80 font-semibold mb-1">Aurora Business Desk</div>
                <div className="text-lg font-bold">Pulpit autonomicznego biznesu →</div>
                <div className="text-xs text-muted-foreground mt-1">Nisze · Zlecenia · Asystent · Workforce · n8n · R2</div>
              </div>
              <Activity className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
            </div>
          </button>
          <button
            onClick={() => navigate("/admin/brain")}
            className="group text-left rounded-xl border border-accent/40 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent p-4 hover:border-accent/70 hover:from-accent/25 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-accent/80 font-semibold mb-1">Mózg GrouAI</div>
                <div className="text-lg font-bold">Brain Panel →</div>
                <div className="text-xs text-muted-foreground mt-1">Decyzje AI, pamięć, telemetria</div>
              </div>
              <Shield className="h-8 w-8 text-accent group-hover:scale-110 transition-transform" />
            </div>
          </button>
          <button
            onClick={() => navigate("/business")}
            className="group relative text-left rounded-xl border border-cyan-400/50 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent p-4 hover:border-cyan-300 hover:shadow-[0_0_30px_hsl(210_100%_50%/0.4)] transition-all overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
            <div className="flex items-center justify-between relative z-10">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan-300 font-semibold mb-1">Strona B2B (publiczna)</div>
                <div className="text-lg font-bold bg-gradient-to-r from-cyan-200 to-blue-300 bg-clip-text text-transparent">grouaistream.com/business →</div>
                <div className="text-xs text-muted-foreground mt-1">Hub usług + chat z Aurorą · klienci → Asystent Desk</div>
              </div>
              <Sparkles className="h-8 w-8 text-cyan-300 group-hover:scale-110 transition-transform animate-pulse" />
            </div>
          </button>
        </motion.div>

        {/* Stats Grid */}
        {loadingData ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Użytkownicy
                    </CardTitle>
                    <Users className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">Zarejestrowanych kont</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Aktywni dziś
                    </CardTitle>
                    <Activity className="h-4 w-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.activeToday || 0}</div>
                    <p className="text-xs text-muted-foreground">Słuchających dzisiaj</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Sesje nastrojów
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalMoodSessions || 0}</div>
                    <p className="text-xs text-muted-foreground">Wykrytych nastrojów</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Utwory w bazie
                    </CardTitle>
                    <Music className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalTracks || 0}</div>
                    <p className="text-xs text-muted-foreground">{genreStats.length} gatunków</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Cost alerts banner */}
            <CostAlertBanner />

            {/* Tabs */}
            <Tabs defaultValue="break-even" className="space-y-4">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="break-even" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Break-even 💰
                </TabsTrigger>
                <TabsTrigger value="payouts-admin" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Wypłaty & Fraud 💸
                </TabsTrigger>
                <TabsTrigger value="bonuses" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Bonusy & Wypłaty
                </TabsTrigger>
                <TabsTrigger value="finance" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Finanse & Weekend AI
                </TabsTrigger>
                <TabsTrigger value="tips" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Tipy & Portfele
                </TabsTrigger>
                <TabsTrigger value="subscriptions" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Subskrypcje 👑
                </TabsTrigger>
                <TabsTrigger value="paddle" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Paddle 💳
                </TabsTrigger>
                <TabsTrigger value="costs" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Koszty & Pomysły
                </TabsTrigger>
                <TabsTrigger value="genres" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Gatunki
                </TabsTrigger>
                <TabsTrigger value="tracks" className="gap-2">
                  <Music className="h-4 w-4" />
                  Utwory
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  Użytkownicy
                </TabsTrigger>
                <TabsTrigger value="email" className="gap-2">
                  <Mail className="h-4 w-4" />
                  E-mail AI
                </TabsTrigger>
                <TabsTrigger value="codes" className="gap-2">
                  <Lock className="h-4 w-4" />
                  Kody dostępu
                </TabsTrigger>
                <TabsTrigger value="radio" className="gap-2">
                  <RadioIcon className="h-4 w-4" />
                  Rozgłośnia
                </TabsTrigger>
                <TabsTrigger value="storage" className="gap-2">
                  <HardDrive className="h-4 w-4" />
                  Dysk
                </TabsTrigger>
                <TabsTrigger value="ai-rankings" className="gap-2">
                  <Award className="h-4 w-4" />
                  Analiza AI
                </TabsTrigger>
                <TabsTrigger value="top-earners" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Top Zarobki
                </TabsTrigger>
                <TabsTrigger value="likes" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Polubienia ❤️
                </TabsTrigger>
                <TabsTrigger value="marquee" className="gap-2">
                  <Megaphone className="h-4 w-4" />
                  Pasek
                </TabsTrigger>
                <TabsTrigger value="seo" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  SEO Bot
                </TabsTrigger>
                <TabsTrigger value="tiktok" className="gap-2">
                  <Music className="h-4 w-4" />
                  Rolki TikTok 🎬
                </TabsTrigger>
                <TabsTrigger value="ai-builder" className="gap-2">
                  <Activity className="h-4 w-4" />
                  AI Builder 🤖
                </TabsTrigger>
                <TabsTrigger value="face-learning" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Aura AI 🧠
                </TabsTrigger>
                <TabsTrigger value="b2b-pricing" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Ceny B2B 💶
                </TabsTrigger>
              </TabsList>

              <TabsContent value="seo">
                <SEODashboard />
              </TabsContent>

              <TabsContent value="tiktok" className="space-y-6">
                <TikTokReelsStudio />
                <TikTokStoriesPanel />
              </TabsContent>

              <TabsContent value="ai-builder">
                <AIBuilderProgress />
              </TabsContent>

              <TabsContent value="face-learning">
                <FaceLearningPanel />
              </TabsContent>

              <TabsContent value="b2b-pricing">
                <B2BPricingPanel />
              </TabsContent>

              {/* Break-even Tab */}
              <TabsContent value="break-even">
                <BreakEvenPanel />
              </TabsContent>

              {/* Payouts Admin & Fraud */}
              <TabsContent value="payouts-admin">
                <PayoutsAdminPanel />
              </TabsContent>

              {/* Bonuses & Payouts Tab */}
              <TabsContent value="bonuses">
                <BonusMonitor />
              </TabsContent>

              {/* Financial Overview Tab */}
              <TabsContent value="finance">
                <FinancialOverview />
              </TabsContent>

              {/* Tips & Wallets Tab */}
              <TabsContent value="tips">
                <TipsOverview />
              </TabsContent>

              {/* Subscriptions Tab */}
              <TabsContent value="subscriptions">
                <SubscriptionsAdminPanel />
              </TabsContent>

              {/* Paddle Tab */}
              <TabsContent value="paddle">
                <PaddleAdminPanel />
              </TabsContent>

              {/* Operational Costs Tab */}
              <TabsContent value="costs" className="space-y-6">
                <CostReportsPanel />
                <OperationalCosts />
              </TabsContent>

              {/* Likes Overview Tab */}
              <TabsContent value="likes">
                <LikesOverview />
              </TabsContent>

              {/* Genres Tab */}
              <TabsContent value="genres">
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Podział gatunków muzycznych
                    </CardTitle>
                    <CardDescription>
                      Rozkład {stats?.totalTracks || 0} utworów w {genreStats.length} kategoriach
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {genreStats.map((g, i) => (
                          <motion.div
                            key={g.genre}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={i < 3 ? "default" : "secondary"}>
                                  #{i + 1}
                                </Badge>
                                <span className="font-medium">{g.genre}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                  {g.count} utworów ({((g.count / (stats?.totalTracks || 1)) * 100).toFixed(1)}%)
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteGenre(g.genre)}
                                  disabled={deletingGenre === g.genre}
                                  title={`Usuń wszystkie utwory z gatunku ${g.genre}`}
                                >
                                  {deletingGenre === g.genre ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <Progress 
                              value={(g.count / maxGenreCount) * 100} 
                              className="h-2"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tracks Tab */}
              <TabsContent value="tracks">
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Music className="h-5 w-5" />
                          Ostatnio dodane utwory
                        </CardTitle>
                        <CardDescription>
                          Testuj odtwarzanie YouTube i zarządzaj biblioteką
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={verifyBrokenTracks}
                          disabled={verifyingTracks}
                          className="gap-2"
                        >
                          {verifyingTracks ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Znajdź zepsute
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={testRandomTracks}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Auto-test kategorii
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Broken Tracks Section */}
                    {brokenTracks.length > 0 && (
                      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="font-semibold">
                              Znaleziono {brokenTracks.length} niedziałających utworów
                            </span>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={deleteAllBroken}
                            disabled={deletingBroken}
                            className="gap-2"
                          >
                            {deletingBroken ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Usuń wszystkie ({brokenTracks.length})
                          </Button>
                        </div>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-1">
                            {brokenTracks.slice(0, 20).map(track => (
                              <div key={track.id} className="flex items-center justify-between text-sm py-1 px-2 bg-background/50 rounded">
                                <span className="truncate flex-1">{track.title} - {track.artist}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteTrack(track.id, track.title)}
                                  disabled={deletingTrack === track.id}
                                >
                                  {deletingTrack === track.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            ))}
                            {brokenTracks.length > 20 && (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                ... i {brokenTracks.length - 20} więcej
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                    
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">Status</TableHead>
                            <TableHead>Tytuł</TableHead>
                            <TableHead>Artysta</TableHead>
                            <TableHead>Gatunek</TableHead>
                            <TableHead>Źródło</TableHead>
                            <TableHead className="w-24">Akcje</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tracks.map((track) => (
                            <TableRow key={track.id}>
                              <TableCell>
                                {testedTracks.has(track.id) ? (
                                  testedTracks.get(track.id) ? (
                                    <CheckCircle className="h-4 w-4 text-accent" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  )
                                ) : (
                                  <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate">
                                {track.title}
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-[150px] truncate">
                                {track.artist}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {track.genre || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {track.video_url ? (
                                  <Badge variant="destructive" className="text-xs">YT</Badge>
                                ) : track.audio_url ? (
                                  <Badge variant="secondary" className="text-xs">Audio</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs">Brak</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => testTrack(recentTracks.find(t => t.id === track.id)!)}
                                    disabled={testingTrack === track.id}
                                    className="gap-1"
                                  >
                                    {testingTrack === track.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Play className="h-3 w-3" />
                                    )}
                                    Test
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteTrack(track.id, track.title)}
                                    disabled={deletingTrack === track.id}
                                    title="Usuń utwór"
                                  >
                                    {deletingTrack === track.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users">
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Zarejestrowani użytkownicy
                    </CardTitle>
                    <CardDescription>
                      Wszystkie konta z adresami e-mail i nickami — łącznie {users.length} użytkowników
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Nick</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Rejestracja</TableHead>
                            <TableHead>Ostatnie logowanie</TableHead>
                            <TableHead>Lokalizacja</TableHead>
                            <TableHead>IP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u, idx) => (
                            <TableRow key={u.id} className="hover:bg-primary/5">
                              <TableCell className="text-muted-foreground text-xs">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                    {(u.display_name || "?")[0].toUpperCase()}
                                  </div>
                                  <span className="font-medium">
                                    {u.display_name || <span className="text-muted-foreground italic">Brak nicku</span>}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">{u.email}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(u.created_at).toLocaleDateString("pl-PL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {u.last_sign_in_at 
                                  ? new Date(u.last_sign_in_at).toLocaleDateString("pl-PL", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })
                                  : "Nigdy"
                                }
                              </TableCell>
                              {(() => {
                                const g = geoByUser[u.id] || (u.email ? geoByUser[u.email.toLowerCase()] : undefined);
                                const loc = g ? [g.city, g.country].filter(Boolean).join(", ") : "";
                                return (
                                  <>
                                    <TableCell className="text-sm">
                                      {loc ? (
                                        <span className="inline-flex items-center gap-1">
                                          {g?.country_code && (
                                            <span className="text-base leading-none">{flagEmoji(g.country_code)}</span>
                                          )}
                                          <span>{loc}</span>
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/60 italic text-xs">— (od następnego logowania)</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono text-muted-foreground">
                                      {g?.ip || "—"}
                                    </TableCell>
                                  </>
                                );
                              })()}
                            </TableRow>
                          ))}
                          {users.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                Brak zarejestrowanych użytkowników
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Email Tab */}
              <TabsContent value="email">
                <AdminEmailDashboard 
                  stats={stats ? { totalTracks: stats.totalTracks, totalUsers: stats.totalUsers } : undefined}
                  genreStats={genreStats}
                />
              </TabsContent>

              {/* Unlock Codes Tab */}
              <TabsContent value="codes">
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Zarządzanie kodami dostępu
                    </CardTitle>
                    <CardDescription>
                      Kody odblokowujące pełną bibliotekę muzyczną
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add new code */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Kod</Label>
                        <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Nowy kod..." className="bg-background/50" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Etykieta</Label>
                        <Input value={newCodeLabel} onChange={e => setNewCodeLabel(e.target.value)} placeholder="np. VIP, Tester..." className="bg-background/50" />
                      </div>
                      <Button onClick={addUnlockCode} className="gap-1">
                        <Plus className="h-4 w-4" /> Dodaj
                      </Button>
                    </div>

                    {/* Codes list */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kod</TableHead>
                          <TableHead>Etykieta</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Utworzony</TableHead>
                          <TableHead className="text-right">Akcje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unlockCodes.map(uc => (
                          <TableRow key={uc.id}>
                            <TableCell className="font-mono font-bold">{uc.code}</TableCell>
                            <TableCell>{uc.label}</TableCell>
                            <TableCell>
                              <Badge variant={uc.is_active ? "default" : "secondary"}>
                                {uc.is_active ? "Aktywny" : "Wyłączony"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(uc.created_at).toLocaleDateString("pl")}
                            </TableCell>
                            <TableCell className="text-right flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => toggleCodeActive(uc.id, uc.is_active)}>
                                {uc.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteUnlockCode(uc.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {unlockCodes.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Brak kodów dostępu
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Radio Station Tab */}
              <TabsContent value="radio">
                <RadioStationManager />
              </TabsContent>

              {/* Storage Tab */}
              <TabsContent value="storage" className="space-y-4">
                <CoverFillPanel />
                <StorageStats />
              </TabsContent>

              <TabsContent value="ai-rankings">
                <AIModeratorRankings />
              </TabsContent>

              <TabsContent value="top-earners">
                <TopEarners />
              </TabsContent>

              <TabsContent value="marquee">
                <MarqueeManager />
              </TabsContent>
            </Tabs>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Szybkie akcje</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={exportStats}
                  >
                    <Download className="h-4 w-4" />
                    Eksport statystyk
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => {
                      setLoadingData(true);
                      fetchAdminData();
                      toast.success("Dane odświeżone");
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Odśwież dane
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
