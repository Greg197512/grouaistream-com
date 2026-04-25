// Kalendarz z przypomnieniami
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalIcon, Plus, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";

interface Event {
  id: string; title: string; description: string | null; event_type: string;
  starts_at: string; ends_at: string | null; status: string; color: string;
}

export const CalendarPanel = ({ orderId }: { orderId: string | null }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("reminder");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("aurora_calendar_events")
      .select("*").eq("user_id", user.id).order("starts_at", { ascending: true });
    setEvents((data ?? []) as Event[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user || !title || !date) { toast.error("Tytuł i data wymagane"); return; }
    const { error } = await supabase.from("aurora_calendar_events").insert({
      user_id: user.id, order_id: orderId, title, starts_at: new Date(date).toISOString(),
      event_type: type, status: "scheduled",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Dodano");
    setTitle(""); setDate("");
    load();
  };

  const del = async (id: string) => {
    await supabase.from("aurora_calendar_events").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalIcon className="w-5 h-5" />Kalendarz i przypomnienia</CardTitle>
        <CardDescription>Deadliny, spotkania, milestone'y zleceń</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-4 gap-2">
          <Input placeholder="Tytuł" value={title} onChange={e => setTitle(e.target.value)} />
          <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
          <select value={type} onChange={e => setType(e.target.value)} className="border bg-background rounded px-2 text-sm">
            <option value="reminder">Przypomnienie</option>
            <option value="deadline">Deadline</option>
            <option value="meeting">Spotkanie</option>
            <option value="milestone">Milestone</option>
            <option value="task">Zadanie</option>
          </select>
          <Button onClick={add} className="gap-1"><Plus className="w-3 h-3" />Dodaj</Button>
        </div>
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
          events.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Brak wydarzeń</p> :
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Bell className="w-4 h-4" style={{ color: e.color }} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.starts_at).toLocaleString("pl-PL")} • <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => del(e.id)} className="text-red-400"><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        }
      </CardContent>
    </Card>
  );
};
