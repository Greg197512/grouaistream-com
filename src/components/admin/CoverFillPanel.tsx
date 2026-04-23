import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Image, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface CoverStats {
  total: number;
  missing: number;
  recentMissing: number;
  withCover: number;
}

export const CoverFillPanel = () => {
  const [stats, setStats] = useState<CoverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [allowAI, setAllowAI] = useState(true);
  const [onlyRecent, setOnlyRecent] = useState(true);
  const [batchSize, setBatchSize] = useState(50);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { count: total } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true });

      const { count: missing } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .or("cover_url.is.null,cover_url.eq.,cover_url.ilike.%picsum.photos%,cover_url.ilike.%placeholder%");

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentMissing } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .or("cover_url.is.null,cover_url.eq.,cover_url.ilike.%picsum.photos%,cover_url.ilike.%placeholder%")
        .gte("created_at", cutoff);

      setStats({
        total: total || 0,
        missing: missing || 0,
        recentMissing: recentMissing || 0,
        withCover: (total || 0) - (missing || 0),
      });
    } catch (e: any) {
      toast.error("Błąd pobierania statystyk: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runBatch = async () => {
    setRunning(true);
    const t = toast.loading(`Generuję okładki dla ${batchSize} utworów...`);
    try {
      const { data, error } = await supabase.functions.invoke("batch-fill-covers", {
        body: { limit: batchSize, onlyRecent, allowAI },
      });
      if (error) throw error;

      const r = data?.results || {};
      toast.success(
        `✅ Przetworzono ${data?.processed || 0} | 🎵 Oryginalne: ${r.original || 0} | 🎨 AI: ${r.ai || 0} | 🖼️ Placeholder: ${r.placeholder || 0} | ❌ Błędy: ${r.failed || 0}`,
        { id: t, duration: 8000 }
      );
      await fetchStats();
    } catch (e: any) {
      toast.error("Błąd: " + e.message, { id: t });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" />
          Auto-okładki utworów
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !stats ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Wszystkie utwory</div>
                <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              </div>
              <div className="rounded-lg bg-green-500/10 p-3">
                <div className="text-xs text-muted-foreground">Z okładką</div>
                <div className="text-2xl font-bold text-green-500">{stats.withCover.toLocaleString()}</div>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-3">
                <div className="text-xs text-muted-foreground">Bez okładki</div>
                <div className="text-2xl font-bold text-orange-500">{stats.missing.toLocaleString()}</div>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <div className="text-xs text-muted-foreground">Bez okładki (30 dni)</div>
                <div className="text-2xl font-bold text-primary">{stats.recentMissing.toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-fallback" className="flex items-center gap-2 cursor-pointer">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI fallback (wysoka jakość)
                </Label>
                <Switch id="ai-fallback" checked={allowAI} onCheckedChange={setAllowAI} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="only-recent" className="cursor-pointer">
                  Tylko nowe (ostatnie 30 dni)
                </Label>
                <Switch id="only-recent" checked={onlyRecent} onCheckedChange={setOnlyRecent} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="flex-1">Rozmiar partii</Label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="bg-background border border-border rounded px-2 py-1 text-sm"
                >
                  <option value={10}>10 (test)</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200 (max)</option>
                </select>
              </div>

              <p className="text-xs text-muted-foreground">
                Najpierw szuka oryginalnych okładek (iTunes, Deezer). Jeśli nie znajdzie i AI fallback jest włączony,
                generuje okładkę AI w wysokiej jakości (Gemini 3 Flash Image).
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={runBatch} disabled={running || stats.missing === 0} className="flex-1">
                {running ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generuję...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Uruchom batch ({batchSize} utworów)</>
                )}
              </Button>
              <Button variant="outline" onClick={fetchStats} disabled={loading || running}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
