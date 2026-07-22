import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Wand2, Image as ImageIcon, Film, Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { triggerCoverVideo } from "@/lib/autoCoverVideo";


interface CoverStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  currentCoverUrl?: string | null;
  onCoverUpdated?: (url: string) => void;
  onVideoUpdated?: (url: string) => void;
}

type BusyKind = null | "upload" | "t2i" | "i2i" | "t2v" | "i2v";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export const CoverStudioModal = ({
  open,
  onOpenChange,
  trackId,
  trackTitle,
  trackArtist,
  currentCoverUrl,
  onCoverUpdated,
  onVideoUpdated,
}: CoverStudioModalProps) => {
  const [tab, setTab] = useState("upload");
  const [busy, setBusy] = useState<BusyKind>(null);
  const [preview, setPreview] = useState<string | null>(currentCoverUrl || null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [t2iPrompt, setT2iPrompt] = useState("");
  const [i2iPrompt, setI2iPrompt] = useState("");
  const [t2vPrompt, setT2vPrompt] = useState("");
  const [i2vPrompt, setI2vPrompt] = useState("");

  const [refImageUrl, setRefImageUrl] = useState<string | null>(null); // for i2i
  const [i2vImageUrl, setI2vImageUrl] = useState<string | null>(null); // for i2v

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const i2iInputRef = useRef<HTMLInputElement>(null);
  const i2vInputRef = useRef<HTMLInputElement>(null);

  const persistCover = async (url: string) => {
    const { data, error } = await supabase.from("tracks").update({ cover_url: url }).eq("id", trackId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Tylko autor utworu może zmienić jego okładkę");
    window.dispatchEvent(new CustomEvent("track-list-changed"));
    onCoverUpdated?.(url);
    // Auto-generate matching video clip in the background.
    triggerCoverVideo(trackId);
  };


  const persistVideo = async (url: string) => {
    const { data, error } = await supabase.from("tracks").update({ video_url: url }).eq("id", trackId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Tylko autor utworu może zmienić jego wideo");
    window.dispatchEvent(new CustomEvent("track-list-changed"));
    onVideoUpdated?.(url);
  };

  // ---- Upload własnej okładki ----
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Wybierz obrazek (JPG/PNG/WebP)");
    if (file.size > 10 * 1024 * 1024) return toast.error("Maks. 10 MB");
    setBusy("upload");
    toast.info("🎨 Wysyłam okładkę…");
    try {
      const { publicUrl } = await uploadToR2({ file, folder: "covers" });
      await persistCover(publicUrl);
      setPreview(publicUrl);
      toast.success("✨ Nowa okładka założona!");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się wysłać okładki");
    } finally {
      setBusy(null);
    }
  };

  // ---- Text → Image ----
  const handleT2I = async () => {
    setBusy("t2i");
    toast.info("🎨 Maluję okładkę z tekstu…");
    try {
      const { data, error } = await supabase.functions.invoke("ai-cover-generate", {
        body: { title: trackTitle, style: "", description: t2iPrompt || `${trackTitle} — ${trackArtist}`, mode: "custom" },
      });
      if (error) throw error;
      if (!data?.cover_url) throw new Error("AI nie zwróciło obrazu");
      await persistCover(data.cover_url);
      setPreview(data.cover_url);
      toast.success("✨ Gotowe!");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się wygenerować");
    } finally {
      setBusy(null);
    }
  };

  // ---- Image (upload) → Image (AI restyle) ----
  const handleI2IUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Maks. 8 MB dla zdjęcia bazowego");
    const dataUrl = await fileToDataUrl(file);
    setRefImageUrl(dataUrl);
  };

  const handleI2I = async () => {
    if (!refImageUrl) return toast.error("Najpierw wybierz zdjęcie bazowe");
    setBusy("i2i");
    toast.info("🖼️ Przerabiam Twoje zdjęcie w okładkę…");
    try {
      const { data, error } = await supabase.functions.invoke("ai-cover-generate", {
        body: {
          title: trackTitle,
          description: i2iPrompt || "cinematic album cover style",
          reference_image: refImageUrl,
        },
      });
      if (error) throw error;
      if (!data?.cover_url) throw new Error("AI nie zwróciło obrazu");
      await persistCover(data.cover_url);
      setPreview(data.cover_url);
      toast.success("✨ Zdjęcie zamienione w okładkę!");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się przetworzyć zdjęcia");
    } finally {
      setBusy(null);
    }
  };

  // ---- Text → Video ----
  const handleT2V = async () => {
    setBusy("t2v");
    toast.info("🎬 Generuję teledysk z tekstu — może zająć ~1-3 min…");
    try {
      const { data, error } = await supabase.functions.invoke("cover-video-generate", {
        body: { prompt: t2vPrompt || `cinematic music video for "${trackTitle}" by ${trackArtist}` },
      });
      if (error) throw error;
      if (!data?.video_url) throw new Error("Silnik wideo nie zwrócił URL");
      await persistVideo(data.video_url);
      setVideoPreview(data.video_url);
      toast.success("🎬 Teledysk gotowy!");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się wygenerować wideo");
    } finally {
      setBusy(null);
    }
  };

  // ---- Image → Video ----
  const handleI2VUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Maks. 10 MB");
    setBusy("upload");
    try {
      const { publicUrl } = await uploadToR2({ file, folder: "covers" });
      setI2vImageUrl(publicUrl);
      toast.success("Zdjęcie wgrane — dopisz opis i wygeneruj wideo");
    } catch {
      toast.error("Nie udało się wgrać zdjęcia");
    } finally {
      setBusy(null);
    }
  };

  const handleI2V = async () => {
    if (!i2vImageUrl) return toast.error("Najpierw wgraj zdjęcie startowe");
    setBusy("i2v");
    toast.info("🎬 Animuję zdjęcie w teledysk — ~1-3 min…");
    try {
      const { data, error } = await supabase.functions.invoke("cover-video-generate", {
        body: { prompt: i2vPrompt, image_url: i2vImageUrl },
      });
      if (error) throw error;
      if (!data?.video_url) throw new Error("Brak URL wideo");
      await persistVideo(data.video_url);
      setVideoPreview(data.video_url);
      toast.success("🎬 Teledysk gotowy!");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się animować zdjęcia");
    } finally {
      setBusy(null);
    }
  };

  const Loading = ({ label }: { label: string }) => (
    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {label}</span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-black/95 border border-primary/30 shadow-[0_0_40px_rgba(255,140,0,0.15)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Cover Studio — „{trackTitle}"
          </DialogTitle>
          <DialogDescription>
            Wgraj własną okładkę lub stwórz nową z AI: tekst → obraz, zdjęcie → obraz, tekst → wideo, zdjęcie → wideo.
          </DialogDescription>
        </DialogHeader>

        {/* Podgląd */}
        <div className="grid grid-cols-2 gap-3">
          <div className="aspect-square rounded-lg overflow-hidden bg-secondary/30 border border-border flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Brak okładki</span>
            )}
          </div>
          <div className="aspect-square rounded-lg overflow-hidden bg-secondary/30 border border-border flex items-center justify-center">
            {videoPreview ? (
              <video src={videoPreview} controls className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Brak wideo</span>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="upload" className="text-xs"><Upload className="h-3.5 w-3.5 mr-1" />Upload</TabsTrigger>
            <TabsTrigger value="t2i" className="text-xs"><Wand2 className="h-3.5 w-3.5 mr-1" />Tekst→Obraz</TabsTrigger>
            <TabsTrigger value="i2i" className="text-xs"><ImageIcon className="h-3.5 w-3.5 mr-1" />Zdj→Obraz</TabsTrigger>
            <TabsTrigger value="t2v" className="text-xs"><Film className="h-3.5 w-3.5 mr-1" />Tekst→Wideo</TabsTrigger>
            <TabsTrigger value="i2v" className="text-xs"><Film className="h-3.5 w-3.5 mr-1" />Zdj→Wideo</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-3 space-y-3">
            <div
              onClick={() => uploadInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition"
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm">Kliknij, aby wybrać obraz</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP — do 10 MB</p>
            </div>
            <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            {busy === "upload" && <div className="text-xs text-primary"><Loading label="Wysyłam…" /></div>}
          </TabsContent>

          <TabsContent value="t2i" className="mt-3 space-y-3">
            <Label className="text-sm">Opisz okładkę</Label>
            <Textarea
              placeholder="np. neonowe miasto w deszczu, sylwetka artysty pod parasolem, cinematic amber…"
              value={t2iPrompt}
              onChange={(e) => setT2iPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            <Button onClick={handleT2I} disabled={busy !== null} className="w-full">
              {busy === "t2i" ? <Loading label="Generuję…" /> : <><Wand2 className="h-4 w-4 mr-2" />Wygeneruj okładkę</>}
            </Button>
          </TabsContent>

          <TabsContent value="i2i" className="mt-3 space-y-3">
            <div
              onClick={() => i2iInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-4 text-center cursor-pointer transition"
            >
              {refImageUrl ? (
                <div className="flex items-center gap-3 justify-center">
                  <img src={refImageUrl} alt="ref" className="h-16 w-16 object-cover rounded" />
                  <span className="text-xs text-emerald-400 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Zdjęcie gotowe — zmień</span>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm">Wybierz zdjęcie bazowe</p>
                  <p className="text-xs text-muted-foreground">AI zamieni je w okładkę</p>
                </>
              )}
            </div>
            <input ref={i2iInputRef} type="file" accept="image/*" className="hidden" onChange={handleI2IUpload} />
            <Textarea
              placeholder="opcjonalnie: styl, nastrój, oświetlenie…"
              value={i2iPrompt}
              onChange={(e) => setI2iPrompt(e.target.value)}
              className="min-h-[70px]"
            />
            <Button onClick={handleI2I} disabled={busy !== null || !refImageUrl} className="w-full">
              {busy === "i2i" ? <Loading label="Przerabiam…" /> : <><Sparkles className="h-4 w-4 mr-2" />Przerób w okładkę</>}
            </Button>
          </TabsContent>

          <TabsContent value="t2v" className="mt-3 space-y-3">
            <Label className="text-sm">Opisz teledysk</Label>
            <Textarea
              placeholder="np. kobieta biegnąca przez nocne miasto, neony, slow-motion, mgła, cinematic…"
              value={t2vPrompt}
              onChange={(e) => setT2vPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-[11px] text-muted-foreground">Generowanie trwa 1-3 minuty. Wideo zostanie przypięte do utworu.</p>
            <Button onClick={handleT2V} disabled={busy !== null} className="w-full">
              {busy === "t2v" ? <Loading label="Kręcę teledysk…" /> : <><Film className="h-4 w-4 mr-2" />Wygeneruj teledysk</>}
            </Button>
          </TabsContent>

          <TabsContent value="i2v" className="mt-3 space-y-3">
            <div
              onClick={() => i2vInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-4 text-center cursor-pointer transition"
            >
              {i2vImageUrl ? (
                <div className="flex items-center gap-3 justify-center">
                  <img src={i2vImageUrl} alt="startframe" className="h-16 w-16 object-cover rounded" />
                  <span className="text-xs text-emerald-400 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Klatka startowa gotowa</span>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm">Wgraj zdjęcie startowe</p>
                  <p className="text-xs text-muted-foreground">AI ożywi je w teledysk</p>
                </>
              )}
            </div>
            <input ref={i2vInputRef} type="file" accept="image/*" className="hidden" onChange={handleI2VUpload} />
            <Textarea
              placeholder="opis ruchu, kadru, nastroju…"
              value={i2vPrompt}
              onChange={(e) => setI2vPrompt(e.target.value)}
              className="min-h-[70px]"
            />
            <Button onClick={handleI2V} disabled={busy !== null || !i2vImageUrl} className="w-full">
              {busy === "i2v" ? <Loading label="Animuję…" /> : <><Film className="h-4 w-4 mr-2" />Ożyw w teledysk</>}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CoverStudioModal;
