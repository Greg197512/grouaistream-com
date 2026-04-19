import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Download, Play, Film, RefreshCw, Music2 } from "lucide-react";
import { toast } from "sonner";

interface Story {
  id: string;
  artist_name: string;
  era: string | null;
  genre: string | null;
  hook: string;
  script: string;
  outro: string;
  audio_url: string | null;
  image_urls: string[];
  captions: { text: string; start: number; end: number }[];
  status: string;
  created_at: string;
  video_url: string | null;
}

export function TikTokStoriesPanel() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [previewStory, setPreviewStory] = useState<Story | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tiktok_stories")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) toast.error(error.message);
    else setStories((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const generateNew = async () => {
    setGenerating(true);
    toast.info("Generuję nową historię — to może potrwać 30-60s...");
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-story-generate");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Gotowe: ${data?.story?.artist_name || "historia"}`);
      await load();
    } catch (e: any) {
      toast.error(`Błąd: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const renderVideo = async (story: Story) => {
    setRenderingId(story.id);
    try {
      await renderStoryToMp4(story, async (url) => {
        // Po wyrenderowaniu — zapisujemy URL w DB (blob URL — pobieramy lokalnie)
        await supabase.from("tiktok_stories").update({ status: "rendered" }).eq("id", story.id);
        toast.success("MP4 gotowe — pobieranie...");
        const a = document.createElement("a");
        a.href = url;
        a.download = `grouaistream-${story.artist_name.replace(/\s+/g, "-").toLowerCase()}.webm`;
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
    <Card className="border-orange-500/20 bg-black/40 backdrop-blur">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-orange-500" />
              Studio Rolek TikTok / Shorts
            </CardTitle>
            <CardDescription>
              Codzienne 30-sekundowe historie legendarnych artystów. AI DJ-ka opowiada → outro o GrouAIStream → MP4 do uploadu.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={generateNew} disabled={generating} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generuj historię
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : stories.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Music2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Brak historii. Kliknij <strong>Generuj historię</strong> by stworzyć pierwszą.</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
              {stories.map((s) => (
                <div key={s.id} className="rounded-lg border border-orange-500/10 bg-black/30 p-3 hover:border-orange-500/40 transition">
                  <div className="flex items-start gap-3">
                    {s.image_urls?.[0] && (
                      <img src={s.image_urls[0]} alt={s.artist_name} className="w-16 h-24 object-cover rounded" loading="lazy" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm truncate">{s.artist_name}</h4>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{s.status}</Badge>
                      </div>
                      <p className="text-xs text-orange-400 mb-1 line-clamp-2">{s.hook}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{s.script}</p>
                      <div className="flex gap-1 mt-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPreviewStory(s)}>
                          <Play className="h-3 w-3 mr-1" /> Podgląd
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-orange-500/20 hover:bg-orange-500/40 text-orange-300"
                          disabled={renderingId === s.id || !s.audio_url || !s.image_urls?.length}
                          onClick={() => renderVideo(s)}
                        >
                          {renderingId === s.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                          Render MP4
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {previewStory && <StoryPreviewModal story={previewStory} onClose={() => setPreviewStory(null)} />}
    </Card>
  );
}

// ===== Modal podglądu =====
function StoryPreviewModal({ story, onClose }: { story: Story; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const imgIdx = Math.min(Math.floor(time / 7.5), (story.image_urls?.length || 1) - 1);
  const currentCaption = story.captions?.find((c) => time >= c.start && time < c.end);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => setTime(a.currentTime);
    a.addEventListener("timeupdate", tick);
    return () => a.removeEventListener("timeupdate", tick);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-[360px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {story.image_urls?.[imgIdx] && (
          <img src={story.image_urls[imgIdx]} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500" />
        )}
        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/70 to-transparent">
          {currentCaption && (
            <p className="text-white text-2xl font-bold text-center drop-shadow-lg" style={{ textShadow: "0 0 10px rgba(255,140,0,0.8)" }}>
              {currentCaption.text}
            </p>
          )}
          <p className="text-orange-400 text-xs text-center mt-3 font-semibold tracking-wider">GROUAISTREAM.COM</p>
        </div>
        {story.audio_url && (
          <audio ref={audioRef} src={story.audio_url} controls autoPlay className="absolute top-2 left-2 right-2 w-[calc(100%-1rem)] h-8" />
        )}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 bg-black/60 text-white w-8 h-8 rounded-full">×</button>
      </div>
    </div>
  );
}

// ===== Render do WebM (przeglądarka, MediaRecorder) =====
async function renderStoryToMp4(story: Story, onDone: (url: string) => Promise<void>) {
  if (!story.audio_url || !story.image_urls?.length) throw new Error("Brak audio lub obrazów");

  const W = 1080;
  const H = 1920;
  const FPS = 30;

  // 1) Załaduj wszystkie obrazy
  const imgs: HTMLImageElement[] = await Promise.all(
    story.image_urls.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        })
    )
  );

  // 2) Załaduj audio
  const audioCtx = new AudioContext();
  const audioRes = await fetch(story.audio_url);
  const audioBuf = await audioCtx.decodeAudioData(await audioRes.arrayBuffer());
  const duration = Math.min(audioBuf.duration, 35);

  // 3) Canvas
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 4) Stream: video z canvas + audio
  const videoStream = canvas.captureStream(FPS);
  const dest = audioCtx.createMediaStreamDestination();
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuf;
  src.connect(dest);
  src.connect(audioCtx.destination);

  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();
  src.start();
  const startedAt = performance.now();

  // 5) Pętla animacji
  await new Promise<void>((resolve) => {
    const draw = () => {
      const t = (performance.now() - startedAt) / 1000;
      if (t >= duration) return resolve();

      // Tło: obraz z Ken Burns
      const idx = Math.min(Math.floor((t / duration) * imgs.length), imgs.length - 1);
      const img = imgs[idx];
      const localT = (t / duration) * imgs.length - idx; // 0..1 wewnątrz obrazu
      const zoom = 1.05 + localT * 0.1;

      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(W / iw, H / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2 - localT * 30;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, dx, dy, dw, dh);

      // Vignette/gradient bottom
      const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.92)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);

      // Caption
      const cap = story.captions.find((c) => t >= c.start && t < c.end);
      if (cap) {
        ctx.font = "900 92px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.shadowColor = "rgba(255,140,0,0.95)";
        ctx.shadowBlur = 28;
        wrapText(ctx, cap.text.toUpperCase(), W / 2, H * 0.78, W - 120, 110);
        ctx.shadowBlur = 0;
      }

      // Brand
      ctx.font = "700 44px Inter, sans-serif";
      ctx.fillStyle = "#ff8c00";
      ctx.textAlign = "center";
      ctx.fillText("GROUAISTREAM.COM", W / 2, H - 80);

      requestAnimationFrame(draw);
    };
    draw();
  });

  recorder.stop();
  await recordingDone;
  audioCtx.close();

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  await onDone(url);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else current = test;
  }
  if (current) lines.push(current);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineHeight));
}
