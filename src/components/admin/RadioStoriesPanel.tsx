import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Radio, Trash2, Loader2, Upload, Plus, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2Upload";
import { toast } from "sonner";

type StoryRow = {
  id: string;
  slot: string;
  title: string;
  audio_url: string;
  duration_sec: number | null;
  air_times: string[] | null;
  is_active: boolean;
  created_at: string;
};

// Ta tabela jest wdrażana niezależnie od automatycznie generowanego pliku typów.
const radioDb = supabase as unknown as SupabaseClient;

const QUICK_PRESETS = [
  { label: "Horror 21:00", time: "21:00", slot: "Horror na wieczór" },
  { label: "Bajki 08:00", time: "08:00", slot: "Bajki dla dzieci" },
];

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => resolve(Math.round(audio.duration) || 600);
    audio.onerror = () => resolve(600);
  });
}

function fmtTime(t: string) {
  // "21:00:00" -> "21:00"
  return t.slice(0, 5);
}

function fmtDur(sec: number | null) {
  if (!sec) return "—";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function RadioStoriesPanel() {
  const [rows, setRows] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotLabel, setSlotLabel] = useState("");
  const [title, setTitle] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await radioDb
      .from("radio_story_slots")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error("Nie udało się wczytać audycji: " + error.message);
    setRows((data || []) as StoryRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addTime = () => {
    if (!newTime) return;
    if (times.includes(newTime)) { setNewTime(""); return; }
    setTimes((t) => [...t, newTime].sort());
    setNewTime("");
  };
  const removeTime = (t: string) => setTimes((ts) => ts.filter((x) => x !== t));

  const handleUpload = async () => {
    if (!file) { toast.error("Wybierz plik audio"); return; }
    if (!title.trim()) { toast.error("Podaj tytuł"); return; }
    if (times.length === 0) { toast.error("Dodaj przynajmniej jedną godzinę emisji"); return; }
    setUploading(true);
    setProgress(0);
    try {
      const { publicUrl } = await uploadToR2({ file, folder: "radio-stories", onProgress: setProgress });
      const duration = await getAudioDuration(publicUrl);
      const { error } = await radioDb.from("radio_story_slots").insert({
        slot: slotLabel.trim() || "Audycja specjalna",
        title: title.trim(),
        audio_url: publicUrl,
        duration_sec: duration,
        air_times: times,
        is_active: true,
      });
      if (error) throw error;
      toast.success(`🎙️ „${title.trim()}" dodane — gra codziennie o ${times.join(", ")}`);
      setTitle("");
      setSlotLabel("");
      setTimes([]);
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
    const { error } = await radioDb.from("radio_story_slots").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
  };

  const remove = async (row: StoryRow) => {
    if (!confirm(`Usunąć „${row.title}”?`)) return;
    const { error } = await radioDb.from("radio_story_slots").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  };

  // Grupowanie widoku: po godzinach emisji (posortowane), jeden plik może pojawić się w kilku grupach.
  const groups = useMemo(() => {
    const map = new Map<string, StoryRow[]>();
    for (const r of rows) {
      for (const t of r.air_times || []) {
        const key = fmtTime(t);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" /> Audycje / opowiadania radiowe
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Osobna szuflada od muzyki — nie wchodzą do zwykłej rotacji. Każdy plik gra codziennie
            o wskazanych, stałych godzinach (może być kilka na dzień, np. 20:30 i 22:00), tylko
            na strumieniu rozgłośni. Kilka plików na tę samą godzinę rotuje dzień po dniu (ten
            sam dla wszystkich słuchaczy tego dnia).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="story-title">Tytuł</Label>
            <Input id="story-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Efekt ciszy" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="story-slot">Kategoria (etykieta, opcjonalnie)</Label>
            <Input id="story-slot" value={slotLabel} onChange={(e) => setSlotLabel(e.target.value)} placeholder="np. Horror na wieczór" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Godziny emisji (codziennie)</Label>
          <div className="flex flex-wrap gap-2">
            {times.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm">
                <Clock className="h-3.5 w-3.5" /> {t}
                <button onClick={() => removeTime(t)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
            <div className="flex items-center gap-1.5">
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-32 h-8" />
              <Button type="button" size="sm" variant="outline" onClick={addTime} className="h-8 gap-1"><Plus className="h-3.5 w-3.5" /> Dodaj</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setNewTime(p.time); if (!slotLabel) setSlotLabel(p.slot); }}
                className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
              >
                + {p.label}
              </button>
            ))}
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
            {uploading ? (progress != null ? `Wgrywanie ${progress}%` : "Wgrywanie…") : "Dodaj do rozgłośni"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak audycji — radio gra tylko normalną rotację muzyki.</p>
        ) : (
          groups.map(([time, items]) => (
            <Card key={time} className="p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" /> {time} <span className="text-xs text-muted-foreground">codziennie</span>
                {items.length > 1 && <span className="text-xs text-muted-foreground">· rotacja {items.length} plików</span>}
              </h4>
              <ul className="space-y-2">
                {items.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                    <span className={`flex-1 text-sm ${r.is_active ? "" : "text-muted-foreground line-through"}`}>
                      {r.title} {r.slot && <span className="text-xs text-muted-foreground">· {r.slot}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtDur(r.duration_sec)}</span>
                    <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
