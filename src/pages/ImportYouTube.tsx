import { useState } from "react";
import { motion } from "framer-motion";
import { Youtube, Search, Download, Mic, Play, Link, Loader2, CheckCircle, AlertTriangle, Music } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { extractYouTubeId } from "@/components/player/YouTubePlayer";

const ImportYouTube = () => {
  const { user } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [mode, setMode] = useState<"url" | "search">("url");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleYouTubeUrlChange = async (url: string) => {
    setYoutubeUrl(url);
    const videoId = extractYouTubeId(url);
    if (!videoId) return;

    setFetching(true);
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await response.json();
      if (data.title) {
        const titleParts = data.title.split(' - ');
        if (titleParts.length >= 2) {
          setArtist(titleParts[0].trim());
          setTitle(titleParts.slice(1).join(' - ').trim());
        } else {
          setTitle(data.title);
          setArtist(data.author_name || '');
        }
      }
    } catch (error) {
      console.error("Error fetching video info:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      // Use YouTube's oembed to validate found URLs
      // For now, open YouTube search in embedded view
      const query = encodeURIComponent(searchQuery);
      setSearchResults([{ type: "redirect", query }]);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby importować utwory");
      return;
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      toast.error("Nieprawidłowy URL YouTube");
      return;
    }
    if (!title.trim()) {
      toast.error("Wpisz tytuł utworu");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("tracks").insert({
        user_id: user.id,
        title: title.trim(),
        artist: artist.trim() || "Unknown Artist",
        genre: genre.trim() || null,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        cover_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration: 180,
        mood: null,
      });

      if (error) throw error;
      toast.success("Utwór zaimportowany!");
      setYoutubeUrl("");
      setTitle("");
      setArtist("");
      setGenre("");
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Błąd importu");
    } finally {
      setLoading(false);
    }
  };

  const videoId = extractYouTubeId(youtubeUrl);

  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <motion.div
            whileHover={{ rotate: 10 }}
            className="groove-gradient-bg h-14 w-14 rounded-2xl flex items-center justify-center"
          >
            <Youtube className="h-7 w-7 text-primary-foreground" />
          </motion.div>
          <div>
            <h1 className="font-display text-3xl font-bold">Import YouTube</h1>
            <p className="text-muted-foreground text-sm">
              Wyszukuj, przeglądaj i importuj muzykę z YouTube
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === "url" ? "default" : "outline"}
            onClick={() => setMode("url")}
            className="gap-2"
          >
            <Link className="h-4 w-4" />
            Wklej URL
          </Button>
          <Button
            variant={mode === "search" ? "default" : "outline"}
            onClick={() => setMode("search")}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            Szukaj na YouTube
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-6">
            {mode === "url" ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="groove-card p-6 space-y-4"
              >
                <div className="space-y-2">
                  <Label>YouTube URL</Label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="https://youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                      className="pl-10"
                    />
                    {fetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    {videoId && !fetching && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
                  </div>
                </div>

                {videoId && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tytuł *</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Artysta</Label>
                        <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artysta" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gatunek</Label>
                      <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Rock, Pop, Electronic..." />
                    </div>
                    <Button onClick={handleImport} disabled={loading || !title.trim()} className="w-full gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {loading ? "Importuję..." : "Importuj do biblioteki"}
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="groove-card p-6 space-y-4"
              >
                <div className="space-y-2">
                  <Label>Szukaj muzyki</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Wpisz tytuł, artystę..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={searching} className="gap-2">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Wyszukaj w YouTube poniżej, a następnie skopiuj URL i wklej w zakładce "Wklej URL"
                </p>
              </motion.div>
            )}

            {/* Tips */}
            <div className="groove-card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                Jak importować
              </h3>
              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="groove-gradient-bg text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                  Znajdź utwór na YouTube (poniżej lub w osobnej karcie)
                </li>
                <li className="flex items-start gap-2">
                  <span className="groove-gradient-bg text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                  Skopiuj URL filmu i wklej w pole powyżej
                </li>
                <li className="flex items-start gap-2">
                  <span className="groove-gradient-bg text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                  Sprawdź metadane i kliknij "Importuj do biblioteki"
                </li>
              </ul>
            </div>
          </div>

          {/* Right: YouTube Embed / Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {videoId ? (
              <div className="groove-card overflow-hidden">
                <div className="h-1 groove-gradient-bg" />
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube Preview"
                  />
                </div>
                <div className="p-4 border-t border-border/30">
                  <p className="font-semibold text-sm truncate">{title || "Podgląd wideo"}</p>
                  <p className="text-xs text-muted-foreground">{artist || "Nieznany artysta"}</p>
                </div>
              </div>
            ) : (
              /* YouTube search embed */
              <div className="groove-card overflow-hidden">
                <div className="h-1 groove-gradient-bg" />
                <div className="flex items-center gap-2 px-4 py-2 bg-card/80 border-b border-border/30">
                  <Youtube className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">YouTube – szukaj i przeglądaj</span>
                </div>
                <iframe
                  src={mode === "search" && searchQuery
                    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`
                    : "https://www.youtube.com"}
                  className="w-full border-0"
                  style={{ height: "calc(100vh - 320px)", minHeight: "400px" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title="YouTube Browser"
                />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ImportYouTube;
