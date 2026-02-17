import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Film, Loader2, Database, Flag, Globe } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Movie {
  id: string;
  title: string;
  original_title: string | null;
  director: string;
  year: number | null;
  genre: string | null;
  category: string;
  description: string | null;
  poster_url: string | null;
  duration_minutes: number | null;
  rating: number | null;
  country: string | null;
}

const Movies = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [populating, setPopulating] = useState(false);
  const [populateProgress, setPopulateProgress] = useState(0);
  const [populateMsg, setPopulateMsg] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const loadMovies = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("movies")
      .select("*")
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(100);

    if (activeTab === "polish") query = query.eq("category", "polish");
    else if (activeTab === "foreign") query = query.eq("category", "foreign");

    const { data } = await query;
    setMovies((data as Movie[]) || []);

    const { count } = await supabase
      .from("movies")
      .select("*", { count: "exact", head: true });
    setTotalCount(count || 0);

    setLoading(false);
  }, [activeTab]);

  const runBulkPopulate = useCallback(async () => {
    if (populating) return;
    setPopulating(true);
    setPopulateProgress(0);
    setPopulateMsg("Rozpoczynam wypełnianie filmów...");

    try {
      for (let batch = 0; batch < 40; batch++) {
        setPopulateMsg(`Batch ${batch + 1}/40 — dodaję filmy...`);

        const { data, error } = await supabase.functions.invoke("bulk-populate-movies", {
          body: { batch, batchSize: 500 },
        });

        if (error) {
          console.error("Batch error:", error);
          continue;
        }

        const progress = data?.progress || Math.round(((batch + 1) / 40) * 100);
        setPopulateProgress(Math.min(progress, 100));
        setPopulateMsg(
          `Batch ${batch + 1}/40 — dodano ${data?.added || 0} filmów (${data?.totalMovies || "?"} łącznie)`
        );

        if ((data?.totalMovies || 0) >= 20000) {
          setPopulateMsg(`Cel osiągnięty! ${data.totalMovies} filmów w bibliotece.`);
          break;
        }

        await new Promise((r) => setTimeout(r, 500));
      }

      setPopulateProgress(100);
      setPopulateMsg("Gotowe! Biblioteka filmów wypełniona.");
      toast.success("Biblioteka filmów wypełniona!");
      loadMovies();
    } catch (err: any) {
      console.error("Populate error:", err);
      toast.error("Błąd: " + (err.message || "Unknown"));
    } finally {
      setTimeout(() => setPopulating(false), 3000);
    }
  }, [populating, loadMovies]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadMovies();
  }, [user, navigate, loadMovies]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Film className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-bold">Filmy</h1>
              <p className="text-sm text-muted-foreground">{totalCount} filmów w bazie</p>
            </div>
          </div>
          <Button
            onClick={runBulkPopulate}
            variant="outline"
            className="gap-2"
            disabled={populating}
          >
            {populating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {populating ? "Wypełniam..." : "Wypełnij 20k"}
          </Button>
        </div>

        {/* Progress */}
        {populating && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{populateMsg}</span>
              <span className="text-muted-foreground">{populateProgress}%</span>
            </div>
            <Progress value={populateProgress} className="h-2" />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <Film className="h-4 w-4" /> Wszystkie
            </TabsTrigger>
            <TabsTrigger value="polish" className="gap-2">
              <Flag className="h-4 w-4" /> Polskie
            </TabsTrigger>
            <TabsTrigger value="foreign" className="gap-2">
              <Globe className="h-4 w-4" /> Zagraniczne
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Movie Grid */}
        {movies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {movies.map((movie) => (
              <motion.div
                key={movie.id}
                whileHover={{ scale: 1.03, y: -4 }}
                className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="aspect-[2/3] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative">
                  {movie.poster_url ? (
                    <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                  ) : (
                    <Film className="h-12 w-12 text-muted-foreground/30" />
                  )}
                  {movie.rating && (
                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-lg">
                      ⭐ {movie.rating}
                    </span>
                  )}
                  {movie.category === "polish" && (
                    <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                      PL
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{movie.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{movie.director}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {movie.year && <span className="text-xs text-muted-foreground">{movie.year}</span>}
                    {movie.genre && (
                      <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                        {movie.genre}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Brak filmów. Kliknij "Wypełnij 20k" aby dodać filmy!</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Movies;
