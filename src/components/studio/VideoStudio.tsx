import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Film, Loader2, Download, Sparkles, Wand2, Type, UserSquare, ImagePlus, X } from "lucide-react";
import { submitVideoSmart, waitForVideoSmart, isSubscriptionError, isDailyLimitError, type VideoEngine } from "@/lib/hubStudio";
import { uploadToR2 } from "@/lib/r2Upload";

/**
 * VIDEO STUDIO — dwa tryby:
 *  1) „Z tekstu" — opis sceny → wideo.
 *  2) „Teledysk" — wgrywasz swoje ZDJĘCIE (postać) + wklejasz TEKST piosenki,
 *     a silnik robi teledysk z Twoją postacią pod ten tekst (image→video).
 * Domyślnie leci nasz silnik (Replicate). Gdy w hubie pojawi się klucz Higgsfield,
 * submitVideoSmart automatycznie przełącza się na Higgsfield (lepsza postać/śpiew).
 */
const ASPECTS = [
  { id: "9:16", label: "Pion 9:16", hint: "Reels / TikTok / Shorts" },
  { id: "16:9", label: "Poziom 16:9", hint: "YouTube" },
  { id: "1:1", label: "Kwadrat 1:1", hint: "Feed" },
] as const;

type Mode = "text" | "teledysk";

// Z tekstu piosenki budujemy filmowy prompt teledysku z postacią użytkownika.
function buildTeledyskPrompt(lyrics: string): string {
  const clean = lyrics.trim().slice(0, 600);
  return (
    "Profesjonalny teledysk muzyczny z tą postacią w roli głównej. " +
    "Kinowe, rytmiczne ujęcia dopasowane nastrojem do tekstu piosenki, " +
    "filmowe światło, płynna praca kamery, 4K. Tekst piosenki: " + clean
  );
}

export function VideoStudio() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("text");

  // wspólne
  const [aspect, setAspect] = useState<string>("9:16");
  const [quality, setQuality] = useState<"good" | "vip">("good");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<VideoEngine | null>(null);
  const cancelRef = useRef(false);

  // tryb „z tekstu"
  const [prompt, setPrompt] = useState("");

  // tryb „teledysk"
  const [lyrics, setLyrics] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (file: File) => {
    if (!user) { toast.error("Zaloguj się, aby wgrać zdjęcie"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Wybierz plik graficzny (zdjęcie)"); return; }
    if (file.size > 12 * 1024 * 1024) { toast.error("Zdjęcie za duże (max 12 MB)"); return; }
    setUploading(true);
    setPhotoPreview(URL.createObjectURL(file));
    try {
      const { publicUrl } = await uploadToR2({ file, folder: "teledyski" });
      setPhotoUrl(publicUrl);
      toast.success("Zdjęcie wgrane ✅");
    } catch (e: any) {
      setPhotoPreview(null);
      toast.error(e?.message || "Nie udało się wgrać zdjęcia");
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => { setPhotoUrl(null); setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ""; };

  const generate = async () => {
    if (!user) { toast.error("Zaloguj się, aby tworzyć wideo"); return; }

    let finalPrompt = "";
    let image: string | undefined;
    let singing = false;

    if (mode === "text") {
      finalPrompt = prompt.trim();
      if (finalPrompt.length < 5) { toast.error("Opisz scenę / teledysk (min. kilka słów)"); return; }
    } else {
      if (!photoUrl) { toast.error("Wgraj najpierw swoje zdjęcie (postać)"); return; }
      if (lyrics.trim().length < 5) { toast.error("Wklej tekst piosenki"); return; }
      finalPrompt = buildTeledyskPrompt(lyrics);
      image = photoUrl;
      singing = true;
    }

    setBusy(true); setVideoUrl(null); setEngineUsed(null); cancelRef.current = false;
    setStatus("🎬 Zlecam wideo…");
    try {
      const { engine, jobId } = await submitVideoSmart(finalPrompt, { quality, aspect, image, singing });
      setEngineUsed(engine);
      setStatus(engine === "higgsfield" ? "Higgsfield renderuje…" : "Nasz silnik renderuje…");
      const url = await waitForVideoSmart(engine, jobId, (s) => {
        if (!cancelRef.current) setStatus(`${engine === "higgsfield" ? "Higgsfield" : "Silnik"} renderuje… (${s}s)`);
      });
      if (cancelRef.current) return;
      setVideoUrl(url);
      setStatus("Gotowe!");
      toast.success("🎬 Wideo gotowe!");
    } catch (e: any) {
      if (isDailyLimitError(e)) toast.error(e?.message || "Dzienny limit wideo osiągnięty — wróć jutro.");
      else if (isSubscriptionError(e)) toast.error("Jakość VIP wymaga planu Pro/Ultimate — wybierz tryb Szybko albo ulepsz plan.");
      else toast.error(e?.message || "Nie udało się wygenerować wideo");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6B00]/15 to-[#9333EA]/15 border border-[#FF6B00]/20 px-3 py-1">
          <Film className="h-4 w-4 text-[#FF9500]" />
          <span className="text-sm font-semibold text-white">Video Studio</span>
        </div>
        <p className="text-xs text-gray-400 max-w-md mx-auto">Zrób wideo z opisu albo teledysk z własnym zdjęciem i tekstem piosenki.</p>
      </div>

      {/* Wybór trybu */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode("text")}
          className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${mode === "text" ? "border-[#FF6B00] bg-[#FF6B00]/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
          <Type className="h-4 w-4 text-[#FF9500]" />
          <div className="text-left"><div className="text-sm font-semibold text-white">Z tekstu</div><div className="text-[10px] text-white/45">Opisz scenę</div></div>
        </button>
        <button type="button" onClick={() => setMode("teledysk")}
          className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${mode === "teledysk" ? "border-[#9333EA] bg-[#9333EA]/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
          <UserSquare className="h-4 w-4 text-[#B026FF]" />
          <div className="text-left"><div className="text-sm font-semibold text-white">Teledysk</div><div className="text-[10px] text-white/45">Twoje zdjęcie + tekst</div></div>
        </button>
      </div>

      {mode === "text" ? (
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="np. Neonowe nocne miasto w deszczu, jazda kamery nad ulicą, odbicia świateł, filmowo, 4K…"
          className="w-full resize-none rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#FF6B00]/60"
        />
      ) : (
        <div className="space-y-3">
          {/* Zdjęcie postaci */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Twoje zdjęcie (postać)</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePhoto(f); }} />
            {photoPreview ? (
              <div className="relative inline-block">
                <img src={photoPreview} alt="Twoja postać" className="h-28 w-28 rounded-2xl object-cover border border-white/15" />
                {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>}
                <button type="button" onClick={clearPhoto} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white/80 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex h-28 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 text-white/60 hover:border-[#9333EA]/60 hover:text-white transition">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-sm">{uploading ? "Wgrywam…" : "Wgraj zdjęcie"}</span>
              </button>
            )}
            <p className="text-[10px] text-white/40 mt-1">Najlepiej wyraźna twarz na wprost, dobre światło.</p>
          </div>

          {/* Tekst piosenki */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Tekst piosenki</div>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={4}
              placeholder="Wklej tekst piosenki — teledysk dopasuje nastrój i sceny do słów…"
              className="w-full resize-none rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#9333EA]/60"
            />
          </div>
        </div>
      )}

      {/* Format */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Format</div>
        <div className="grid grid-cols-3 gap-2">
          {ASPECTS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAspect(a.id)}
              className={`rounded-xl border p-2 text-left transition ${aspect === a.id ? "border-[#FF6B00] bg-[#FF6B00]/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
              <div className="text-sm font-semibold text-white">{a.label}</div>
              <div className="text-[10px] text-white/45">{a.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Jakość */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Jakość</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setQuality("good")}
            className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${quality === "good" ? "border-[#FF6B00] bg-[#FF6B00]/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
            <Sparkles className="h-4 w-4 text-[#FF9500]" />
            <div className="text-left"><div className="text-sm font-semibold text-white">Szybko</div><div className="text-[10px] text-white/45">Dla każdego · szybszy render</div></div>
          </button>
          <button type="button" onClick={() => setQuality("vip")}
            className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${quality === "vip" ? "border-[#9333EA] bg-[#9333EA]/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
            <Wand2 className="h-4 w-4 text-[#B026FF]" />
            <div className="text-left"><div className="text-sm font-semibold text-white">Jakość VIP</div><div className="text-[10px] text-white/45">Wyższa jakość · plan Pro</div></div>
          </button>
        </div>
      </div>

      <Button onClick={generate} disabled={busy || uploading}
        className="w-full gap-2 bg-gradient-to-br from-[#FF6B00] to-[#9333EA] text-white font-bold h-12">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5" />}
        {busy ? (status || "Renderuję…") : mode === "teledysk" ? "Zrób teledysk" : "Wygeneruj wideo"}
      </Button>

      {busy && status && <p className="text-center text-sm text-gray-400">{status}</p>}

      {videoUrl && (
        <div className="space-y-2">
          <video src={videoUrl} controls playsInline className="w-full rounded-2xl border border-white/10 bg-black" style={{ maxHeight: 460 }} />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/45">
              Silnik: {engineUsed === "higgsfield" ? "Higgsfield" : "GrouAI (nasz silnik)"}
            </span>
            <a href={videoUrl} download className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF9500] hover:text-white">
              <Download className="h-3.5 w-3.5" /> Pobierz
            </a>
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/40 text-center">
        Limit dzienny chroni koszty. Silnik: <b className="text-white/60">nasz (Replicate)</b> — działa od zaraz.
        Po dodaniu klucza Higgsfield teledysk z postacią/śpiewem robi się jeszcze lepszy (automatycznie).
      </p>
    </div>
  );
}
