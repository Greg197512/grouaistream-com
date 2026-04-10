import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Globe, Radio, Music2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface BreakdownProps {
  userId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Bezpośredni",
  playlist: "Playlista",
  radio: "Radio",
  dj: "DJ Session",
  search: "Wyszukiwarka",
  ai_dj: "AI DJ",
};

const SOURCE_COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#10b981"];

const COUNTRY_NAMES: Record<string, string> = {
  PL: "Polska", NL: "Holandia", US: "USA", DE: "Niemcy", UA: "Ukraina",
  GB: "Wielka Brytania", FR: "Francja", ES: "Hiszpania", IT: "Włochy",
};

export const StreamBreakdown = ({ userId }: BreakdownProps) => {
  const { t } = useLanguage();
  const [sourceData, setSourceData] = useState<{ source: string; count: number }[]>([]);
  const [countryData, setCountryData] = useState<{ country: string; count: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBreakdown();
  }, [userId]);

  const loadBreakdown = async () => {
    setLoading(true);

    // Get all stream events for tracks owned by this user
    const { data: userTracks } = await supabase
      .from("tracks")
      .select("id")
      .eq("user_id", userId);

    if (!userTracks || userTracks.length === 0) {
      setLoading(false);
      return;
    }

    const trackIds = userTracks.map((t) => t.id);

    const { data: events } = await supabase
      .from("stream_events")
      .select("source, country, streamed_at")
      .in("track_id", trackIds)
      .eq("counted", true)
      .order("streamed_at", { ascending: false })
      .limit(1000);

    if (!events) {
      setLoading(false);
      return;
    }

    // Source breakdown
    const sourceMap: Record<string, number> = {};
    events.forEach((e) => {
      const src = (e as any).source || "direct";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    setSourceData(
      Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
    );

    // Country breakdown
    const countryMap: Record<string, number> = {};
    events.forEach((e) => {
      const c = (e as any).country || "unknown";
      countryMap[c] = (countryMap[c] || 0) + 1;
    });
    setCountryData(
      Object.entries(countryMap)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
    );

    // Daily trend (last 30 days)
    const dayMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayMap[d.toISOString().slice(0, 10)] = 0;
    }
    events.forEach((e) => {
      const day = e.streamed_at.slice(0, 10);
      if (day in dayMap) dayMap[day]++;
    });
    setDailyData(Object.entries(dayMap).map(([date, count]) => ({ date: date.slice(5), count })));

    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-white/10">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Ładowanie statystyk...
        </CardContent>
      </Card>
    );
  }

  const totalStreams = sourceData.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="bg-card/50 backdrop-blur border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Breakdown streamów
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sources" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="sources" className="gap-1 text-xs">
              <Music2 className="h-3 w-3" /> Źródła
            </TabsTrigger>
            <TabsTrigger value="countries" className="gap-1 text-xs">
              <Globe className="h-3 w-3" /> Kraje
            </TabsTrigger>
            <TabsTrigger value="trend" className="gap-1 text-xs">
              <Radio className="h-3 w-3" /> Trend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources">
            {sourceData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Brak danych</p>
            ) : (
              <div className="space-y-4">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceData}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ source, percent }) =>
                          `${SOURCE_LABELS[source] || source} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {sourceData.map((_, i) => (
                          <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [value, SOURCE_LABELS[name] || name]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {sourceData.map((d, i) => (
                    <div key={d.source} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                        <span>{SOURCE_LABELS[d.source] || d.source}</span>
                      </div>
                      <span className="font-medium">{d.count.toLocaleString()} ({totalStreams > 0 ? ((d.count / totalStreams) * 100).toFixed(1) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="countries">
            {countryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Brak danych</p>
            ) : (
              <div className="space-y-1.5">
                {countryData.slice(0, 10).map((d) => {
                  const pct = totalStreams > 0 ? (d.count / totalStreams) * 100 : 0;
                  return (
                    <div key={d.country} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{COUNTRY_NAMES[d.country] || d.country}</span>
                        <span className="font-medium">{d.count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trend">
            {dailyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Brak danych</p>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={30} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Streamy" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
