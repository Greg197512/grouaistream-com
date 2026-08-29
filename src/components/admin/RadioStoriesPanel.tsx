import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun, Trash2, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { toast } from "sonner";

type Slot = "evening_horror" | "morning_kids";

type StoryRow = {
  id: string;
  slot: Slot;
  title: string;
  audio_url: string;
  duration_sec: number | null;
  is_active: boolean;
  created_at: string;
};

const SLOT_META: Record<Slot, { label: string; time: string; icon: typeof Moon }> = {
  evening_horror: { label: "Horror na wieczór", time: "21:00 codziennie", icon: Moon },
  morning_kids: { label: "Bajki dla dzieci", time: "08:00 codziennie", icon: Sun },
};

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => resolve(Math.round(audio.duration) || 600);
    audio.onerror = () => resolve(600);
  });
}

export function RadioStoriesPanel() {
  const [rows, setRows] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<Slot>("evening_horror");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("radio_story_slots")
      .select("*")
      .order("slot", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error("Nie udało się wczytać opowiadań: " + error.message);
    setRows((data || []) as StoryRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!file) { toast.error("Wybierz plik audio"); return; }
    if (!title.trim()) { toast.error("Podaj tytuł"); return; }
    setUploading(true);
    setProgress(0);
    try {
      const { publicUrl } = await uploadToR2({ file, folder: "radio-stories", onProgress: setProgress });
      const duration = await getAudioDuration(publicUrl);
      const { error } = await supabase.from("radio_story_slots").insert({
        slot,
        title: title.trim(),
        audio_url: publicUrl,
        duration_sec: duration,
        is_active: true,
      });
      if (error) throw error;
      toast.success(`🎙️ „${title.trim()}" dodane do slotu ${SLOT_META[slot].label}`);
      setTitle("");
      setFile(null);
      await load();
    } catch (e: any) {
      toast.error("Błąd wgrywania: " + (e?.message || "nieznany"));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const toggleActive = async (row: StoryRow) => {
    const { error } = await supabase.from("radio_story_slots").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
  };

  const remove = async (row: StoryRow) => {
    if (!confirm(`Usunąć „${row.title}”?`)) return;
    const { error } = await supabase.from("radio_story_slots").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary" /> Opowiadania radiowe
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Osobna szuflada od muzyki — nie wchodzą do zwykłej rotacji. Grane automatycznie
            codziennie o stałej porze, tylko na strumieniu rozgłośni: <strong>21:00 horror</strong>{" "}
            (dla dorosłych) i <strong>08:00 bajki</strong> (dla dzieci). Jeśli dodasz kilka plików
            do jednego slotu, rotują dzień po dniu (ten sam dla wszystkich słuchaczy).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex gap-2">
            {(Object.keys(SLOT_META) as Slot[]).map((s) => {
              const meta = SLOT_META[s];
              const Icon = meta.icon;
              return (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                    slot === s ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-left">
                    <span className="block font-medium">{meta.label}</span>
                    <span className="block text-[11px] opacity-70">{meta.time}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="story-title">Tytuł</Label>
            <Input id="story-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Trzy Sekundy" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1"
          />
          <Button onClick={handleUpload} disabled={uploading} className="gap-2 whitespace-nowrap">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? (progress != null ? `Wgrywanie ${progress}%` : "Wgrywanie…") : "Dodaj opowiadanie"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {(Object.keys(SLOT_META) as Slot[]).map((s) => {
          const meta = SLOT_META[s];
          const Icon = meta.icon;
          const items = rows.filter((r) => r.slot === s);
          return (
            <Card key={s} className="p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 text-primary" /> {meta.label} <span className="text-xs text-muted-foreground">({meta.time})</span>
              </h4>
              {loading ? (
                <p className="text-sm text-muted-foreground">Ładowanie…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak plików w tym slocie — radio gra normalną muzykę o tej porze.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                      <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                      <span className={`flex-1 text-sm ${r.is_active ? "" : "text-muted-foreground line-through"}`}>{r.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.duration_sec ? `${Math.floor(r.duration_sec / 60)}:${String(r.duration_sec % 60).padStart(2, "0")}` : "—"}
                      </span>
                      <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
