// Notatki Word-lite
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, NotebookPen, Plus, Trash2, Save, Pin } from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string; title: string; content_md: string; pinned: boolean; updated_at: string;
}

export const NotesPanel = ({ orderId }: { orderId: string | null }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [active, setActive] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("aurora_client_notes")
      .select("*").eq("user_id", user.id).order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
    if (!active && data && data.length > 0) setActive(data[0] as Note);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("aurora_client_notes")
      .insert({ user_id: user.id, order_id: orderId, title: "Nowa notatka", content_md: "" } as any).select().single();
    if (error || !data) { toast.error(error?.message); return; }
    setActive(data as Note);
    load();
  };

  const save = async () => {
    if (!active) return;
    const { error } = await supabase.from("aurora_client_notes")
      .update({ title: active.title, content_md: active.content_md, pinned: active.pinned } as any).eq("id", active.id);
    if (error) toast.error(error.message); else { toast.success("Zapisano"); load(); }
  };

  const del = async (id: string) => {
    await supabase.from("aurora_client_notes").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><NotebookPen className="w-5 h-5" />Notatki</CardTitle>
            <CardDescription>Twój prywatny edytor Word-lite z markdown</CardDescription>
          </div>
          <Button size="sm" onClick={create} className="gap-1"><Plus className="w-3 h-3" />Nowa</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1 max-h-[500px] overflow-auto">
              {notes.map(n => (
                <button key={n.id} onClick={() => setActive(n)}
                  className={`w-full text-left p-2 rounded border text-sm ${active?.id === n.id ? "border-orange-500 bg-orange-500/10" : "border-border hover:border-orange-500/50"}`}>
                  <div className="flex items-center gap-2">
                    {n.pinned && <Pin className="w-3 h-3 text-orange-400" />}
                    <span className="font-medium truncate">{n.title}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{n.content_md.slice(0, 50)}</div>
                </button>
              ))}
              {notes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Brak notatek</p>}
            </div>
            <div className="md:col-span-2 space-y-2">
              {active ? (
                <>
                  <div className="flex gap-2">
                    <Input value={active.title} onChange={e => setActive({ ...active, title: e.target.value })} />
                    <Button size="icon" variant={active.pinned ? "default" : "outline"} onClick={() => setActive({ ...active, pinned: !active.pinned })}>
                      <Pin className="w-3 h-3" />
                    </Button>
                  </div>
                  <Textarea value={active.content_md} onChange={e => setActive({ ...active, content_md: e.target.value })}
                    rows={16} placeholder="Pisz tu… (markdown)" className="font-mono text-sm" />
                  <div className="flex gap-2">
                    <Button onClick={save} className="gap-1"><Save className="w-3 h-3" />Zapisz</Button>
                    <Button variant="ghost" className="text-red-400 gap-1" onClick={() => del(active.id)}><Trash2 className="w-3 h-3" />Usuń</Button>
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Wybierz lub stwórz notatkę</p>}
            </div>
          </div>
        }
      </CardContent>
    </Card>
  );
};
