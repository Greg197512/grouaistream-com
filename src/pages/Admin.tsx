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
  Calendar,
  Activity,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface UserStats {
  totalUsers: number;
  activeToday: number;
  totalMoodSessions: number;
  totalTracks: number;
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
}

export default function Admin() {
  const { isAdmin, loading, user } = useAdminAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Brak uprawnień administratora");
      navigate("/");
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    try {
      // Fetch profiles with user data
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch mood sessions count
      const { count: moodCount } = await supabase
        .from("mood_sessions")
        .select("*", { count: "exact", head: true });

      // Fetch tracks count
      const { count: tracksCount } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true });

      // Calculate active users today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: activeCount } = await supabase
        .from("listening_history")
        .select("user_id", { count: "exact", head: true })
        .gte("played_at", today.toISOString());

      setStats({
        totalUsers: profiles?.length || 0,
        activeToday: activeCount || 0,
        totalMoodSessions: moodCount || 0,
        totalTracks: tracksCount || 0,
      });

      // Map profiles to user data format
      const mappedUsers: UserData[] = (profiles || []).map(profile => ({
        id: profile.user_id,
        email: profile.display_name || "Nieznany",
        created_at: profile.created_at,
        last_sign_in_at: profile.updated_at,
        display_name: profile.display_name,
      }));

      setUsers(mappedUsers);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Błąd ładowania danych");
    } finally {
      setLoadingData(false);
    }
  };

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
              Zarządzaj systemem GrooveAI Stream
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
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalTracks || 0}</div>
                    <p className="text-xs text-muted-foreground">Dostępnych utworów</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Users Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Lista użytkowników
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Nazwa</th>
                          <th className="pb-3 text-left text-sm font-medium text-muted-foreground">ID</th>
                          <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Rejestracja</th>
                          <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Ostatnia aktywność</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, index) => (
                          <tr
                            key={u.id}
                            className="border-b border-border/30 hover:bg-muted/20"
                          >
                            <td className="py-3 text-sm">{u.display_name || "Nieznany"}</td>
                            <td className="py-3 text-sm font-mono text-xs text-muted-foreground">
                              {u.id.slice(0, 8)}...
                            </td>
                            <td className="py-3 text-sm text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString("pl-PL")}
                            </td>
                            <td className="py-3 text-sm text-muted-foreground">
                              {u.last_sign_in_at 
                                ? new Date(u.last_sign_in_at).toLocaleDateString("pl-PL")
                                : "Brak danych"
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {users.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground">
                        Brak zarejestrowanych użytkowników
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

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
                  <Button variant="outline" className="gap-2" disabled>
                    <Mail className="h-4 w-4" />
                    Wyślij newsletter (wkrótce)
                  </Button>
                  <Button variant="outline" className="gap-2" disabled>
                    <BarChart3 className="h-4 w-4" />
                    Eksport statystyk (wkrótce)
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => {
                      fetchAdminData();
                      toast.success("Dane odświeżone");
                    }}
                  >
                    <Activity className="h-4 w-4" />
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
