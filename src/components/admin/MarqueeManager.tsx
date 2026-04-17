import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Send, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MarqueeMsg {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export const MarqueeManager = () => {
  const { user } = useAuth();
  const [text, setText] = useState('"Latimer63" Muzyka świetna, polubienia poleciały. Dziękujemy!!');
  const [messages, setMessages] = useState<MarqueeMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_marquee_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setMessages(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await supabase
      .from("admin_marquee_messages")
      .insert({ message: text.trim(), created_by: user.id, is_active: true });
    setSending(false);
    if (error) {
      toast.error("Nie udało się wysłać: " + error.message);
      return;
    }
    toast.success("Wiadomość wyświetlana na pasku!");
    setText("");
    load();
  };

  const toggle = async (id: string, current: boolean) => {
    await supabase.from("admin_marquee_messages").update({ is_active: !current }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("admin_marquee_messages").delete().eq("id", id);
    toast.success("Usunięto");
    load();
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Pasek wiadomości na stronie głównej
        </CardTitle>
        <CardDescription>
          Wiadomości pojawiają się jako przewijający się tekst nad sekcją "Nowe na serwerze".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Np. "Latimer63" Muzyka świetna, polubienia poleciały. Dziękujemy!!'
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{text.length} znaków</span>
            <Button onClick={send} disabled={sending || !text.trim()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Wyślij na pasek
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Historia wiadomości ({messages.length})</h4>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Brak wiadomości</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {messages.map((m) => (
                <div key={m.id} className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-background/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-words">{m.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={m.is_active ? "default" : "secondary"} className="text-xs">
                        {m.is_active ? "Aktywna" : "Ukryta"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(m.created_at), "dd.MM.yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggle(m.id, m.is_active)} title={m.is_active ? "Ukryj" : "Pokaż"}>
                    {m.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(m.id)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
