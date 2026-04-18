import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Loader2, Star, AlertTriangle, RefreshCw, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface RatingRow {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  track_id: string;
  track_title: string;
  track_artist: string;
  stars: number;
  listened_seconds: number;
  created_at: string;
  is_suspicious_short: boolean;
  is_max_stars: boolean;
}

export const RatingsAuditTable = () => {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlySuspicious, setOnlySuspicious] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_all_ratings_for_admin", {
      _only_suspicious: onlySuspicious,
    });
    if (error) {
      toast.error("Błąd: " + error.message);
    } else {
      const list = (data as any) || [];
      setRows(Array.isArray(list) ? list : []);
    }
    setLoading(false);
  }, [onlySuspicious]);

  useEffect(() => {
    load();
  }, [load]);

  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  const suspiciousCount = rows.filter(r => r.is_suspicious_short).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Oceny utworów (do weryfikacji ludzkiej)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {rows.length} ocen • {suspiciousCount} podejrzanych ({"<"}30s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch checked={onlySuspicious} onCheckedChange={setOnlySuspicious} />
            <span>Tylko podejrzane</span>
          </label>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Odśwież
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">Brak ocen do wyświetlenia</p>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Utwór</TableHead>
                  <TableHead className="text-center">Ocena</TableHead>
                  <TableHead className="text-right">Odsłuch</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className={r.is_suspicious_short ? "bg-yellow-500/5" : ""}>
                    <TableCell>
                      <div className="text-xs">
                        <div className="font-semibold">{r.user_name || "—"}</div>
                        <div className="text-muted-foreground">{r.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div className="font-medium truncate max-w-[200px]">{r.track_title}</div>
                        <div className="text-muted-foreground truncate max-w-[200px]">{r.track_artist}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-mono text-sm ${r.stars === 5 ? "text-amber-400" : r.stars >= 3 ? "text-primary" : "text-muted-foreground"}`}>
                        {stars(r.stars)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-xs ${r.is_suspicious_short ? "text-yellow-400 font-bold" : "text-foreground"}`}>
                        {r.listened_seconds}s
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.is_suspicious_short ? (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1">
                          <AlertTriangle className="h-3 w-3" /> Podejrz.
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
