import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Star, Award, Music, Crown } from "lucide-react";
import { motion } from "framer-motion";

interface Submission {
  id: string;
  user_email: string;
  title: string;
  genre: string;
  status: string;
  total_score: number;
  score_length: number;
  score_lyrics: number;
  score_vocal: number;
  score_production: number;
  score_originality: number;
  created_at: string;
}

interface UserRanking {
  email: string;
  submissions: Submission[];
  avgScore: number;
  bestScore: number;
  totalSubmissions: number;
  approvedCount: number;
}

export function AIModeratorRankings() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("track_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
      return;
    }

    const subs = (data || []) as Submission[];
    setSubmissions(subs);

    // Group by user email and compute rankings
    const userMap = new Map<string, Submission[]>();
    subs.forEach((s) => {
      if (!userMap.has(s.user_email)) userMap.set(s.user_email, []);
      userMap.get(s.user_email)!.push(s);
    });

    const ranked: UserRanking[] = Array.from(userMap.entries()).map(
      ([email, userSubs]) => {
        const scored = userSubs.filter((s) => s.total_score > 0);
        const avgScore =
          scored.length > 0
            ? scored.reduce((sum, s) => sum + s.total_score, 0) / scored.length
            : 0;
        const bestScore =
          scored.length > 0
            ? Math.max(...scored.map((s) => s.total_score))
            : 0;

        return {
          email,
          submissions: userSubs,
          avgScore: Math.round(avgScore * 10) / 10,
          bestScore,
          totalSubmissions: userSubs.length,
          approvedCount: userSubs.filter((s) => s.status === "approved").length,
        };
      }
    );

    ranked.sort((a, b) => b.avgScore - a.avgScore);
    setRankings(ranked);
    setLoading(false);
  };

  const getScoreColor = (score: number, max: number = 100) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return "text-green-400";
    if (pct >= 60) return "text-yellow-400";
    if (pct >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90)
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          Wybitny
        </Badge>
      );
    if (score >= 75)
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          Dobry
        </Badge>
      );
    if (score >= 60)
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          Przeciętny
        </Badge>
      );
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        Słaby
      </Badge>
    );
  };

  const selectedUserData = selectedUser
    ? rankings.find((r) => r.email === selectedUser)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Most Authentic Artist - #1 */}
      {rankings.length > 0 && rankings[0].avgScore > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-primary/50 bg-gradient-to-r from-primary/10 via-card/80 to-primary/10 backdrop-blur relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-primary">
                <Crown className="h-6 w-6" />
                🏆 Najbardziej Autentyczny Artysta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-foreground">
                    {rankings[0].email}
                  </p>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    <span>
                      Średnia:{" "}
                      <span className="text-primary font-semibold">
                        {rankings[0].avgScore}/100
                      </span>
                    </span>
                    <span>
                      Najlepszy wynik:{" "}
                      <span className="text-primary font-semibold">
                        {rankings[0].bestScore}/100
                      </span>
                    </span>
                    <span>
                      Zatwierdzonych:{" "}
                      <span className="text-green-400 font-semibold">
                        {rankings[0].approvedCount}/{rankings[0].totalSubmissions}
                      </span>
                    </span>
                  </div>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/40 text-base px-4 py-1">
                  <Star className="h-4 w-4 mr-1" />
                  #1 Autentyczność
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Rankings Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Ranking artystów – wyniki analizy AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Artysta (e-mail)</TableHead>
                  <TableHead className="text-center">Śr. wynik</TableHead>
                  <TableHead className="text-center">Najlepszy</TableHead>
                  <TableHead className="text-center">Zgłoszenia</TableHead>
                  <TableHead className="text-center">Zatwierdzone</TableHead>
                  <TableHead className="text-center">Poziom</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((r, i) => (
                  <TableRow
                    key={r.email}
                    className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedUser === r.email ? "bg-accent/30" : ""
                    } ${i === 0 && r.avgScore > 0 ? "border-l-2 border-l-primary" : ""}`}
                    onClick={() =>
                      setSelectedUser(
                        selectedUser === r.email ? null : r.email
                      )
                    }
                  >
                    <TableCell className="font-bold">
                      {i === 0 && r.avgScore > 0 ? (
                        <Crown className="h-5 w-5 text-primary" />
                      ) : (
                        i + 1
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell
                      className={`text-center font-bold ${getScoreColor(r.avgScore)}`}
                    >
                      {r.avgScore}
                    </TableCell>
                    <TableCell
                      className={`text-center font-semibold ${getScoreColor(r.bestScore)}`}
                    >
                      {r.bestScore}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.totalSubmissions}
                    </TableCell>
                    <TableCell className="text-center text-green-400">
                      {r.approvedCount}
                    </TableCell>
                    <TableCell className="text-center">
                      {getScoreBadge(r.avgScore)}
                    </TableCell>
                  </TableRow>
                ))}
                {rankings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Brak zgłoszeń do analizy
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detailed Submissions for Selected User */}
      {selectedUserData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Music className="h-5 w-5 text-primary" />
                Utwory: {selectedUserData.email}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tytuł</TableHead>
                      <TableHead>Gatunek</TableHead>
                      <TableHead className="text-center">📏 Długość</TableHead>
                      <TableHead className="text-center">📝 Tekst</TableHead>
                      <TableHead className="text-center">🎤 Wokal</TableHead>
                      <TableHead className="text-center">🎛️ Prod.</TableHead>
                      <TableHead className="text-center">💎 Orig.</TableHead>
                      <TableHead className="text-center">Suma</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedUserData.submissions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.genre}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <ScoreCell value={s.score_length} max={20} />
                        </TableCell>
                        <TableCell className="text-center">
                          <ScoreCell value={s.score_lyrics} max={20} />
                        </TableCell>
                        <TableCell className="text-center">
                          <ScoreCell value={s.score_vocal} max={20} />
                        </TableCell>
                        <TableCell className="text-center">
                          <ScoreCell value={s.score_production} max={20} />
                        </TableCell>
                        <TableCell className="text-center">
                          <ScoreCell value={s.score_originality} max={20} />
                        </TableCell>
                        <TableCell
                          className={`text-center font-bold ${getScoreColor(s.total_score)}`}
                        >
                          {s.total_score}/100
                        </TableCell>
                        <TableCell className="text-center">
                          {s.status === "approved" ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              ✓
                            </Badge>
                          ) : s.status === "rejected" ? (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              ✗
                            </Badge>
                          ) : (
                            <Badge variant="outline">⏳</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString("pl-PL")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function ScoreCell({ value, max }: { value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm font-semibold">
        {value}/{max}
      </span>
      <Progress value={pct} className="h-1.5 w-12" />
    </div>
  );
}
