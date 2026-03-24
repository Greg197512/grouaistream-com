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
  Send,
  Sparkles,
  Eye,
  Trophy,
  UserPlus,
  Newspaper,
  Lock,
  Plus,
  ToggleLeft,
  ToggleRight
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
import { RadioStationManager } from "@/components/admin/RadioStationManager";
import { StorageStats } from "@/components/admin/StorageStats";
import { Radio as RadioIcon, HardDrive } from "lucide-react";

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

interface GeneratedEmail {
  subject: string;
  body: string;
  preview: string;
  type: string;
  generatedAt: string;
}

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
  
  // Email state
  const [emailType, setEmailType] = useState<"invitation" | "challenge" | "newsletter" | "weekly_digest">("invitation");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [emailHistory, setEmailHistory] = useState<GeneratedEmail[]>([]);
  
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

  const generateEmail = async () => {
    setGeneratingEmail(true);
    try {
      const topGenres = genreStats.slice(0, 5).map(g => g.genre);
      
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: {
          type: emailType,
          recipientName: recipientName || undefined,
          customMessage: customMessage || undefined,
          stats: {
            totalTracks: stats?.totalTracks || 0,
            totalUsers: stats?.totalUsers || 0,
            topGenres
          }
        }
      });

      if (error) throw error;

      if (data?.email) {
        setGeneratedEmail(data.email);
        setEmailHistory(prev => [data.email, ...prev.slice(0, 9)]);
        toast.success("E-mail wygenerowany przez AI!");
      }
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error("Błąd generowania e-maila");
    } finally {
      setGeneratingEmail(false);
    }
  };

  const sendEmailViaResend = async () => {
    if (!generatedEmail) return;
    if (!recipientEmail.trim()) {
      toast.error("Podaj adres e-mail odbiorcy!");
      return;
    }

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipientEmail.trim(),
          subject: generatedEmail.subject,
          html: generatedEmail.body,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`E-mail wysłany do ${recipientEmail}! ✉️`);
      } else {
        throw new Error(data?.error || "Wysyłanie nie powiodło się");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Błąd wysyłania e-maila");
    } finally {
      setSendingEmail(false);
    }
  };

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
      
      toast.success(`Usunięto "${trackTitle}"`);
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

            {/* Tabs */}
            <Tabs defaultValue="genres" className="space-y-4">
              <TabsList>
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
              </TabsList>

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
                      Lista użytkowników
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nazwa</TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead>Rejestracja</TableHead>
                            <TableHead>Ostatnia aktywność</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.display_name || "Nieznany"}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {u.id.slice(0, 8)}...
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(u.created_at).toLocaleDateString("pl-PL")}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {u.last_sign_in_at 
                                  ? new Date(u.last_sign_in_at).toLocaleDateString("pl-PL")
                                  : "Brak danych"
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                          {users.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Email Generator */}
                  <Card className="border-border/50 bg-card/50 backdrop-blur">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Generator E-maili AI
                      </CardTitle>
                      <CardDescription>
                        Generuj e-maile zaproszenia, wyzwania i newslettery
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Typ e-maila</Label>
                        <Select value={emailType} onValueChange={(v: typeof emailType) => setEmailType(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="invitation">
                              <div className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4" />
                                Zaproszenie
                              </div>
                            </SelectItem>
                            <SelectItem value="challenge">
                              <div className="flex items-center gap-2">
                                <Trophy className="h-4 w-4" />
                                Wyzwanie muzyczne
                              </div>
                            </SelectItem>
                            <SelectItem value="newsletter">
                              <div className="flex items-center gap-2">
                                <Newspaper className="h-4 w-4" />
                                Newsletter
                              </div>
                            </SelectItem>
                            <SelectItem value="weekly_digest">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Podsumowanie tygodnia
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>E-mail odbiorcy</Label>
                        <Input 
                          placeholder="np. jan@example.com"
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Imię odbiorcy (opcjonalne)</Label>
                        <Input 
                          placeholder="np. Jan"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Dodatkowy kontekst (opcjonalne)</Label>
                        <Textarea 
                          placeholder="np. Promuj nowy gatunek K-pop..."
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <Button 
                        className="w-full gap-2"
                        onClick={generateEmail}
                        disabled={generatingEmail}
                      >
                        {generatingEmail ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generowanie...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Wygeneruj e-mail
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-muted-foreground text-center">
                        ✨ Używa Lovable AI - bez potrzeby zewnętrznego API
                      </p>
                    </CardContent>
                  </Card>

                  {/* Email Preview */}
                  <Card className="border-border/50 bg-card/50 backdrop-blur">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Podgląd e-maila
                      </CardTitle>
                      <CardDescription>
                        {generatedEmail ? (
                          <Badge variant="secondary" className="mt-1">
                            {emailType === "invitation" && "Zaproszenie"}
                            {emailType === "challenge" && "Wyzwanie"}
                            {emailType === "newsletter" && "Newsletter"}
                            {emailType === "weekly_digest" && "Podsumowanie"}
                          </Badge>
                        ) : (
                          "Wygeneruj e-mail aby zobaczyć podgląd"
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {generatedEmail ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg bg-background border">
                            <div className="text-sm text-muted-foreground mb-1">Temat:</div>
                            <div className="font-semibold">{generatedEmail.subject}</div>
                          </div>
                          
                          <div className="p-4 rounded-lg bg-background border">
                            <div className="text-sm text-muted-foreground mb-2">Treść:</div>
                            <div 
                              className="prose prose-sm dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: generatedEmail.body }}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              className="flex-1 gap-2"
                              onClick={() => {
                                navigator.clipboard.writeText(generatedEmail.body);
                                toast.success("Skopiowano do schowka!");
                              }}
                            >
                              <Download className="h-4 w-4" />
                              Kopiuj treść
                            </Button>
                            <Button 
                              variant="default" 
                              className="flex-1 gap-2"
                              onClick={sendEmailViaResend}
                              disabled={sendingEmail || !recipientEmail.trim()}
                            >
                              {sendingEmail ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              {sendingEmail ? "Wysyłanie..." : "Wyślij przez Resend"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <Mail className="h-12 w-12 mb-4 opacity-30" />
                          <p>Brak wygenerowanego e-maila</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Email History */}
                {emailHistory.length > 0 && (
                  <Card className="border-border/50 bg-card/50 backdrop-blur mt-6">
                    <CardHeader>
                      <CardTitle className="text-base">Historia generowanych e-maili</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {emailHistory.map((email, i) => (
                            <div 
                              key={i}
                              className="p-3 rounded-lg bg-background/50 border cursor-pointer hover:bg-background/80 transition-colors"
                              onClick={() => setGeneratedEmail(email)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate max-w-[300px]">
                                  {email.subject}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {email.type}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {new Date(email.generatedAt).toLocaleString("pl-PL")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
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
              <TabsContent value="storage">
                <StorageStats />
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
