import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Send, Trash2, Loader2, Eye, EyeOff, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import { pl } from "date-fns/locale";

interface MarqueeMsg {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

export const MarqueeManager = () => {
  const { user } = useAuth();
  const [text, setText] = useState('"Latimer63" Muzyka świetna, polubienia poleciały. Dziękujemy!!');
  const [minutes, setMinutes] = useState<number>(5);
  const [messages, setMessages] = useState<MarqueeMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [, setTick] = useState(0);

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
  // Refresh "time left" labels every 15s
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(i);
  }, []);

  const send = async () => {
    if (!text.trim() || !user) return;
    const mins = Math.max(1, Math.min(1440, minutes || 5));
    setSending(true);
    const expires = new Date(Date.now() + mins * 60_000).toISOString();
    const { error } = await supabase
      .from("admin_marquee_messages")
      .insert({ message: text.trim(), created_by: user.id, is_active: true, expires_at: expires });
    setSending(false);
    if (error) {
      toast.error("Nie udało się wysłać: " + error.message);
      return;
    }
    toast.success(`Wiadomość na pasku przez ${mins} min!`);
    setText("");
    load();
  };

  const toggle = async (id: string, current: boolean) => {
    await supabase.from("admin_marquee_messages").update({ is_active: !current }).eq("id", id);
    load();
  };

  const extend = async (id: string, currentExpires: string, addMins: number) => {
    const base = new Date(currentExpires).getTime();
    const now = Date.now();
    const newExpires = new Date(Math.max(base, now) + addMins * 60_000).toISOString();
    const { error } = await supabase
      .from("admin_marquee_messages")
      .update({ expires_at: newExpires, is_active: true })
      .eq("id", id);
    if (error) { toast.error("Błąd: " + error.message); return; }
    toast.success(`Przedłużono o ${addMins} min`);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("admin_marquee_messages").delete().eq("id", id);
    toast.success("Usunięto");
    load();
  };

  const timeLeft = (expires: string, isActive: boolean) => {
    const ms = new Date(expires).getTime() - Date.now();
    if (!isActive) return "Ukryta";
    if (ms <= 0) return "Wygasła";
    return `Zostało ${formatDistanceToNowStrict(new Date(expires), { locale: pl })}`;
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Pasek wiadomości na stronie głównej
        </CardTitle>
        <CardDescription>
          Wiadomości pojawiają się jako przewijający się tekst nad sekcją "Nowe na serwerze" i znikają automatycznie po upływie czasu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Np. "Latimer63" Muzyka świetna, polubienia poleciały. Dziękujemy!!'
            rows={3}
            className="resize-none"
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="duration" className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Czas wyświetlania (min)
              </Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value) || 5)}
                className="w-32"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {[5, 15, 30, 60, 240].map((m) => (
                <Button key={m} variant="outline" size="sm" onClick={() => setMinutes(m)}>
                  {m}m
                </Button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{text.length} znaków</span>
              <Button onClick={send} disabled={sending || !text.trim()} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Wyślij na pasek
              </Button>
            </div>
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
              {messages.map((m) => {
                const expired = new Date(m.expires_at).getTime() <= Date.now();
                const live = m.is_active && !expired;
                return (
                  <div key={m.id} className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-background/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-words">{m.message}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={live ? "default" : "secondary"} className="text-xs">
                          {live ? "Na żywo" : expired ? "Wygasła" : "Ukryta"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(m.created_at), "dd.MM.yyyy HH:mm")}
                        </span>
                        <span className="text-xs text-primary/80">
                          {timeLeft(m.expires_at, m.is_active)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => extend(m.id, m.expires_at, 5)} title="Przedłuż o 5 min" className="gap-1 h-8">
                        <Plus className="h-3 w-3" />5m
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => extend(m.id, m.expires_at, 30)} title="Przedłuż o 30 min" className="gap-1 h-8">
                        <Plus className="h-3 w-3" />30m
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggle(m.id, m.is_active)} title={m.is_active ? "Ukryj" : "Pokaż"}>
                        {m.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(m.id)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
