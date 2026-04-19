import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Download, Play, Film, RefreshCw, Camera, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  slug: string;
  title: string;
  feature_name: string;
  hook: string;
  voiceover_script: string;
  outro: string;
  app_route: string | null;
  duration_seconds: number;
  queue_order: number;
  is_active: boolean;
  used_count: number;
  last_used_at: string | null;
  screenshot_paths: string[];
}

interface Reel {
  id: string;
  template_id: string | null;
  title: string;
  feature_name: string;
  voiceover_script: string;
  captions: { text: string; start: number; end: number }[];
  audio_url: string | null;
  screenshot_urls: string[];
  video_url: string | null;
  duration_seconds: number;
  status: string;
  created_at: string;
  metadata: any;
}

export function TikTokReelsStudio() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [previewReel, setPreviewReel] = useState<Reel | null>(null);
  const [uploadingForReel, setUploadingForReel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tmpl, rls] = await Promise.all([
      supabase.from("tiktok_reel_templates").select("*").order("queue_order"),
      supabase.from("tiktok_reels").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (tmpl.data) setTemplates(tmpl.data as any);
    if (rls.data) setReels(rls.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generateReel = async (templateId?: string) => {
    setGeneratingId(templateId || "auto");
    toast.info("🎙️ Generating voiceover (Brian, Apple-ad style)…");
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-reel-generate", {
        body: templateId ? { templateId } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`✅ Reel ready: ${data.reel.title}`);
      await load();
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const uploadScreenshots = async (reel: Reel, files: FileList) => {
    setUploadingForReel(reel.id);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `screenshots/${reel.id}/${Date.now()}-${i}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
        const { error: upErr } = await supabase.storage.from("tiktok-reels").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("tiktok-reels").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const merged = [...reel.screenshot_urls, ...urls];
      const { error } = await supabase.from("tiktok_reels").update({ screenshot_urls: merged, status: "ready_to_render" }).eq("id", reel.id);
      if (error) throw error;
      toast.success(`📸 ${urls.length} screenshots added`);
      await load();
    } catch (e: any) {
      toast.error(`Upload error: ${e.message}`);
    } finally {
      setUploadingForReel(null);
    }
  };

  const renderReel = async (reel: Reel) => {
    if (!reel.audio_url || reel.screenshot_urls.length === 0) {
      toast.error("Add at least one screenshot first");
      return;
    }
    setRenderingId(reel.id);
    try {
      await renderReelToWebm(reel, async (blob) => {
        const path = `videos/${reel.id}-${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage.from("tiktok-reels").upload(path, blob, {
          contentType: "video/webm",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("tiktok-reels").getPublicUrl(path);
        await supabase.from("tiktok_reels").update({ video_url: pub.publicUrl, status: "rendered" }).eq("id", reel.id);
        toast.success("🎬 Video rendered & uploaded — downloading…");
        const a = document.createElement("a");
        a.href = pub.publicUrl;
        a.download = `grouaistream-${reel.feature_name.toLowerCase().replace(/\s+/g, "-")}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        await load();
      });
    } catch (e: any) {
      toast.error(`Render error: ${e.message}`);
    } finally {
      setRenderingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-orange-500/30 bg-gradient-to-br from-black/60 to-orange-950/20 backdrop-blur">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Film className="h-6 w-6 text-orange-500" />
                Studio Rolek TikTok / Reels / Shorts
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Profesjonalne 10-sekundowe filmiki instruktażowe po angielsku, voiceover Brian (cinematic Apple-ad style),
                kinetyczne captions, screenshoty z aplikacji. Kolejność: Intro → AI DJ → Mood → Radio → Studio → Party → Cover → Crowd Cam → Earnings → Multi-language.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                onClick={() => generateReel()}
                disabled={generatingId !== null}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-bold"
              >
                {generatingId === "auto" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Generate next reel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* SZABLONY */}
      <Card className="border-orange-500/20 bg-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">📋 Szablony rolek ({templates.length})</CardTitle>
          <CardDescription>Klikij konkretny szablon, żeby wygenerować rolkę z dokładnie tej funkcji.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pr-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-orange-500/10 bg-black/30 p-3 hover:border-orange-500/40 transition flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-orange-500/20 text-orange-300 text-[10px]">#{t.queue_order}</Badge>
                      <h4 className="font-semibold text-sm truncate">{t.title}</h4>
                    </div>
                    <p className="text-xs text-orange-400 mb-1 line-clamp-1 italic">"{t.hook}"</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{t.voiceover_script}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>📍 {t.app_route || "—"}</span>
                      <span>🔁 {t.used_count}× used</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-xs"
                    disabled={generatingId !== null}
                    onClick={() => generateReel(t.id)}
                  >
                    {generatingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* WYGENEROWANE ROLKI */}
      <Card className="border-orange-500/20 bg-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">🎬 Wygenerowane rolki ({reels.length})</CardTitle>
          <CardDescription>
            <strong className="text-orange-400">Krok 1:</strong> wgraj screenshoty z aplikacji (PNG/JPG, 9:16 lub 16:9 — auto crop). 
            <strong className="text-orange-400 ml-2">Krok 2:</strong> Render MP4. <strong className="text-orange-400 ml-2">Krok 3:</strong> Pobierz i wrzuć na TikToka.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : reels.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Film className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Brak rolek. Kliknij <strong>Generate next reel</strong> by stworzyć pierwszą.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pr-2">
                {reels.map((r) => (
                  <div key={r.id} className="rounded-lg border border-orange-500/10 bg-black/30 p-3 hover:border-orange-500/40 transition">
                    <div className="flex items-start gap-3">
                      <div className="w-20 h-32 rounded overflow-hidden bg-black/60 shrink-0 relative">
                        {r.screenshot_urls?.[0] ? (
                          <img src={r.screenshot_urls[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        )}
                        {r.screenshot_urls.length > 1 && (
                          <Badge className="absolute bottom-1 right-1 bg-black/80 text-[9px] px-1">+{r.screenshot_urls.length - 1}</Badge>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold text-sm truncate">{r.title}</h4>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{r.status}</Badge>
                        </div>
                        <p className="text-[11px] text-orange-400 italic line-clamp-1">"{r.metadata?.hook}"</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{r.voiceover_script}</p>
                        {r.audio_url && (
                          <audio src={r.audio_url} controls className="w-full h-7 mt-2" preload="none" />
                        )}
                        <div className="flex gap-1 mt-2 flex-wrap">
                          <Label htmlFor={`upload-${r.id}`} className="cursor-pointer">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-orange-500/20 hover:bg-orange-500/40 text-orange-300 transition">
                              {uploadingForReel === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                              Screenshots
                            </span>
                            <Input
                              id={`upload-${r.id}`}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => e.target.files && uploadScreenshots(r, e.target.files)}
                            />
                          </Label>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setPreviewReel(r)}>
                            <Play className="h-3 w-3 mr-1" /> Preview
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300"
                            disabled={renderingId === r.id || !r.audio_url || r.screenshot_urls.length === 0}
                            onClick={() => renderReel(r)}
                          >
                            {renderingId === r.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                            Render MP4
                          </Button>
                          {r.video_url && (
                            <a
                              href={r.video_url}
                              download
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/20 hover:bg-green-500/40 text-green-300 transition"
                            >
                              <Download className="h-3 w-3" /> .webm
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {previewReel && <ReelPreviewModal reel={previewReel} onClose={() => setPreviewReel(null)} />}
    </div>
  );
}

// ===== Modal podglądu (9:16) =====
function ReelPreviewModal({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const dur = reel.duration_seconds;
  const imgs = reel.screenshot_urls.length ? reel.screenshot_urls : [];
  const imgIdx = imgs.length ? Math.min(Math.floor((time / dur) * imgs.length), imgs.length - 1) : 0;
  const currentCap = reel.captions?.find((c) => time >= c.start && time < c.end);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => setTime(a.currentTime);
    a.addEventListener("timeupdate", tick);
    return () => a.removeEventListener("timeupdate", tick);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-[360px] aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl ring-2 ring-orange-500/40" onClick={(e) => e.stopPropagation()}>
        {imgs[imgIdx] ? (
          <img src={imgs[imgIdx]} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" key={imgIdx} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-950 via-black to-amber-950 flex items-center justify-center">
            <Camera className="h-16 w-16 text-orange-500/30" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
          {currentCap && (
            <p className="text-white text-3xl font-black text-center uppercase leading-tight tracking-tight" style={{ textShadow: "0 0 20px rgba(255,140,0,0.9), 0 2px 8px rgba(0,0,0,0.95)" }}>
              {currentCap.text}
            </p>
          )}
          <p className="text-orange-400 text-xs text-center mt-4 font-bold tracking-[0.3em]">GROUAISTREAM.COM</p>
        </div>
        {reel.audio_url && (
          <audio ref={audioRef} src={reel.audio_url} controls autoPlay className="absolute top-3 left-3 right-3 w-[calc(100%-1.5rem)] h-9" />
        )}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 bg-black/70 hover:bg-orange-500 text-white w-9 h-9 rounded-full text-xl font-bold transition">×</button>
      </div>
    </div>
  );
}

// ===== Render do WebM (Canvas + MediaRecorder, 1080x1920, 30fps) =====
async function renderReelToWebm(reel: Reel, onDone: (blob: Blob) => Promise<void>) {
  if (!reel.audio_url || reel.screenshot_urls.length === 0) throw new Error("Brak audio lub screenshotów");

  const W = 1080;
  const H = 1920;
  const FPS = 30;

  // Load images
  const imgs = await Promise.all(
    reel.screenshot_urls.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Image load failed: ${url}`));
          img.src = url;
        })
    )
  );

  // Audio
  const audioCtx = new AudioContext();
  const audioBuf = await audioCtx.decodeAudioData(await (await fetch(reel.audio_url)).arrayBuffer());
  const duration = Math.min(audioBuf.duration, reel.duration_seconds + 1.5);

  // Canvas + streams
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const videoStream = canvas.captureStream(FPS);
  const dest = audioCtx.createMediaStreamDestination();
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuf;
  src.connect(dest);
  src.connect(audioCtx.destination);

  const stream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (recorder.onstop = () => res()));

  recorder.start();
  src.start();
  const startedAt = performance.now();

  await new Promise<void>((resolve) => {
    const draw = () => {
      const t = (performance.now() - startedAt) / 1000;
      if (t >= duration) return resolve();

      const idx = Math.min(Math.floor((t / duration) * imgs.length), imgs.length - 1);
      const img = imgs[idx];
      const localT = (t / duration) * imgs.length - idx;

      // Ken Burns: subtle zoom + pan
      const zoom = 1.08 + localT * 0.12;
      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(W / iw, H / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (W - dw) / 2 + Math.sin(localT * Math.PI) * 30;
      const dy = (H - dh) / 2 - localT * 40;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, dx, dy, dw, dh);

      // Cinematic gradient bottom
      const grad = ctx.createLinearGradient(0, H * 0.45, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.6, "rgba(0,0,0,0.85)");
      grad.addColorStop(1, "rgba(0,0,0,0.98)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.45, W, H * 0.55);

      // Top vignette
      const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.25);
      topGrad.addColorStop(0, "rgba(0,0,0,0.7)");
      topGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, W, H * 0.25);

      // Caption (kinetic, with entrance)
      const cap = reel.captions.find((c) => t >= c.start && t < c.end);
      if (cap) {
        const capT = (t - cap.start) / Math.max(0.001, cap.end - cap.start);
        const ease = 1 - Math.pow(1 - Math.min(1, capT * 4), 3);
        const yOff = (1 - ease) * 60;
        const alpha = Math.min(1, capT * 5);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "900 96px 'Space Grotesk', 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.shadowColor = "rgba(255,140,0,0.95)";
        ctx.shadowBlur = 32;
        wrapText(ctx, cap.text.toUpperCase(), W / 2, H * 0.78 + yOff, W - 100, 110);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Brand watermark
      ctx.font = "800 42px 'Space Grotesk', 'Inter', sans-serif";
      ctx.fillStyle = "#ff8c00";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 8;
      ctx.letterSpacing = "8px";
      ctx.fillText("GROUAISTREAM.COM", W / 2, H - 90);
      ctx.shadowBlur = 0;

      requestAnimationFrame(draw);
    };
    draw();
  });

  recorder.stop();
  await done;
  audioCtx.close();
  await onDone(new Blob(chunks, { type: mime }));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineHeight));
}
