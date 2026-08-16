import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadToR2 } from "@/lib/r2Upload";
import { UploadCloud, FolderOpen, Loader2, Check, X, Music, Brain } from "lucide-react";

/**
 * Masowy import — wybierasz z komputera cały folder (lub wiele plików) muzyki,
 * a PRZEGLĄDARKA wgrywa je do R2 i tworzy utwory w katalogu. To jedyny sposób,
 * by pliki z Twojego kompa trafiły na serwer (przez Twoją przeglądarkę). Nowe
 * utwory od razu zasilają naukę silnika (tożsamość brzmieniowa katalogu).
 */
const GENRES = ["Pop", "Rock", "Hip-Hop", "Electronic", "Folk", "EDM", "Country", "R&B", "Disco", "Jazz", "Classical", "Ambient", "Lo-Fi", "Chill", "Other"];
type Row = { name: string; status: "wait" | "up" | "done" | "err"; msg?: string };

function titleFromName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Utwór";
}
function durationOf(file: File): Promise<number> {
  return new Promise((res) => {
    try {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.onloadedmetadata = () => { const d = Math.round(a.duration) || 0; URL.revokeObjectURL(a.src); res(d); };
      a.onerror = () => res(0);
      a.src = URL.createObjectURL(file);
    } catch { res(0); }
  });
}

export function BulkMusicUpload() {
  const { user } = useAuth();
  const [genre, setGenre] = useState("Other");
  const [rows, setRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null) => {
    const arr = Array.from(list || []).filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|flac|ogg|aac)$/i.test(f.name));
    setFiles(arr);
    setRows(arr.map((f) => ({ name: f.name, status: "wait" })));
    setDone(0);
    if (arr.length === 0) toast.error("Nie znaleziono plików audio w wyborze");
  };

  const run = async () => {
    if (!user) { toast.error("Zaloguj się"); return; }
    if (files.length === 0) { toast.error("Najpierw wybierz pliki lub folder"); return; }
    const displayName = (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "GrouAI";
    setBusy(true); setDone(0);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setRows((r) => r.map((x, k) => k === i ? { ...x, status: "up" } : x));
      try {
        const dur = await durationOf(f);
        const { publicUrl } = await uploadToR2({ file: f, folder: `library/${user.id}` });
        const { error } = await supabase.from("tracks").insert({
          user_id: user.id, title: titleFromName(f.name), artist: displayName,
          album: "Import", duration: dur || 0, audio_url: publicUrl, genre, mood: null,
        });
        if (error) throw error;
        ok++;
        setRows((r) => r.map((x, k) => k === i ? { ...x, status: "done" } : x));
      } catch (e: any) {
        setRows((r) => r.map((x, k) => k === i ? { ...x, status: "err", msg: (e?.message || "błąd").slice(0, 60) } : x));
      }
      setDone(i + 1);
    }
    setBusy(false);
    toast.success(`Zaimportowano ${ok}/${files.length} do R2. Silnik uczy się z nowego katalogu.`);
  };

  const pct = files.length ? Math.round((done / files.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UploadCloud className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">Masowy import muzyki → R2</h3>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90 flex gap-2">
        <Brain className="h-4 w-4 flex-none mt-0.5" />
        <span>Pliki wgrywasz <b>Ty, ze swojej przeglądarki</b> (ja nie mam dostępu do Twojego komputera). Trafiają do R2 i do katalogu, a silnik uczy się <b>tożsamości brzmieniowej</b> katalogu (gatunki/nastroje). Nie trenujemy modelu Suno na audio — to niemożliwe z naszej strony.</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input ref={folderRef} type="file" hidden multiple
          // @ts-expect-error — webkitdirectory nie jest w typach, ale działa w przeglądarce
          webkitdirectory="" directory=""
          onChange={(e) => pick(e.target.files)} />
        <input ref={filesRef} type="file" hidden multiple accept="audio/*"
          onChange={(e) => pick(e.target.files)} />
        <Button variant="outline" className="gap-2" onClick={() => folderRef.current?.click()} disabled={busy}>
          <FolderOpen className="h-4 w-4" /> Wybierz cały folder
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => filesRef.current?.click()} disabled={busy}>
          <Music className="h-4 w-4" /> Wybierz pliki
        </Button>
        <div className="sm:max-w-[160px]">
          <select value={genre} onChange={(e) => setGenre(e.target.value)} disabled={busy}
            className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-sm text-white">
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {files.length > 0 && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">{files.length} plików gotowych · gatunek: <b>{genre}</b></span>
            <Button onClick={run} disabled={busy} className="gap-2 bg-gradient-to-br from-[#FF6B00] to-[#9333EA] text-white font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {busy ? `Wgrywam… ${pct}%` : "Wgraj wszystko do R2"}
            </Button>
          </div>
          {busy && (
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#FF6B00] to-[#9333EA] transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border/50">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                {r.status === "done" ? <Check className="h-3.5 w-3.5 text-emerald-400 flex-none" />
                  : r.status === "err" ? <X className="h-3.5 w-3.5 text-rose-400 flex-none" />
                  : r.status === "up" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF9500] flex-none" />
                  : <Music className="h-3.5 w-3.5 text-white/30 flex-none" />}
                <span className="truncate flex-1">{r.name}</span>
                {r.msg && <span className="text-rose-300/80">{r.msg}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Po imporcie wejdź w „Nauka silnika" i kliknij „Odśwież katalog" — nowe utwory od razu wejdą do nauki tożsamości brzmieniowej.
      </p>
    </div>
  );
}
