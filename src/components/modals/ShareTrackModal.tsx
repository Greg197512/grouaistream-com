import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Share2, Download, Copy, Check, Link2, MessageCircle, Radar
} from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/contexts/PlayerContext";

interface ShareTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

const CARD_W = 1080;
const CARD_H = 1080;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (ctx.measureText(t + "…").width > maxWidth && t.length > 1) t = t.slice(0, -1);
  return t + "…";
}

async function generateShareCard(track: Track): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  // --- tło ---
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#07070f");
  bg.addColorStop(0.5, "#0f0f1e");
  bg.addColorStop(1, "#070710");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // --- okładka ---
  const coverSize = 700;
  const coverX = (CARD_W - coverSize) / 2;
  const coverY = 80;
  const r = 36;

  let coverImg: HTMLImageElement | null = null;
  if (track.cover_url) {
    try { coverImg = await loadImage(track.cover_url); } catch { /* fallback */ }
  }

  if (coverImg) {
    // rozmycie tła z okładki
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.filter = "blur(60px)";
    ctx.drawImage(coverImg, -80, -80, CARD_W + 160, CARD_H + 160);
    ctx.filter = "none";
    ctx.restore();

    // cień pod okładką
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 80;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = "transparent";
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, r);
    ctx.fill();
    ctx.restore();

    // okrągła okładka
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, r);
    ctx.clip();
    ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
    ctx.restore();
  } else {
    // gradient fallback
    const g = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
    g.addColorStop(0, "#6366f1");
    g.addColorStop(1, "#8b5cf6");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, r);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `bold 220px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", CARD_W / 2, coverY + coverSize / 2);
  }

  // --- gradient overlay na dole okładki ---
  const overGrad = ctx.createLinearGradient(0, coverY + coverSize - 180, 0, coverY + coverSize);
  overGrad.addColorStop(0, "rgba(0,0,0,0)");
  overGrad.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(coverX, coverY, coverSize, coverSize, r);
  ctx.clip();
  ctx.fillStyle = overGrad;
  ctx.fillRect(coverX, coverY, coverSize, coverSize);
  ctx.restore();

  // --- tytuł ---
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 74px -apple-system,BlinkMacSystemFont,"Inter",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const title = truncateText(ctx, track.title, 940);
  ctx.fillText(title, CARD_W / 2, 830);

  // --- artysta ---
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `400 50px -apple-system,BlinkMacSystemFont,"Inter",sans-serif`;
  ctx.fillText(track.artist, CARD_W / 2, 924);

  // --- equalizer bars ---
  const barCount = 44;
  const barW = 13;
  const barGap = 7;
  const totalW = barCount * (barW + barGap) - barGap;
  const bx = (CARD_W - totalW) / 2;
  const bY = 1018;

  const barGrad = ctx.createLinearGradient(bx, bY - 55, bx + totalW, bY);
  barGrad.addColorStop(0, "#6366f1");
  barGrad.addColorStop(0.45, "#8b5cf6");
  barGrad.addColorStop(1, "#06b6d4");
  ctx.fillStyle = barGrad;
  ctx.shadowColor = "#6366f1";
  ctx.shadowBlur = 18;

  for (let i = 0; i < barCount; i++) {
    const h = Math.abs(Math.sin(i * 0.45 + 1.1) * 28 + Math.cos(i * 0.75) * 18 + 36);
    const x = bx + i * (barW + barGap);
    ctx.beginPath();
    ctx.roundRect(x, bY - h, barW, h, 4);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // --- branding ---
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = `500 34px -apple-system,BlinkMacSystemFont,"Inter",sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("grouaistream.com", CARD_W / 2, 1056);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Canvas toBlob failed")), "image/png");
  });
}

export const ShareTrackModal = ({ isOpen, onClose, track }: ShareTrackModalProps) => {
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const prevBlobUrl = useRef<string>("");

  const shareUrl = track
    ? `${window.location.origin}/?play=${track.id}`
    : window.location.origin;

  // generuj kartę gdy modal otwierany
  useEffect(() => {
    if (!isOpen || !track) return;
    let cancelled = false;
    setGenerating(true);
    setCardBlob(null);
    setCardUrl("");

    generateShareCard(track)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setCardBlob(blob);
        setCardUrl(url);
      })
      .catch(() => toast.error("Nie udało się wygenerować karty"))
      .finally(() => { if (!cancelled) setGenerating(false); });

    return () => { cancelled = true; };
  }, [isOpen, track?.id]);

  // --- Podaj osobie obok: natychmiastowe natywne okno udostępniania ---
  // (AirDrop na iOS, Nearby Share na Androidzie) — bez czekania na wygenerowanie karty.
  const handleNearbyShare = useCallback(async () => {
    if (!track) return;
    const text = `🎵 Słucham "${track.title}" – ${track.artist} na GrouAI Stream!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: track.title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success("Skopiowano do schowka!");
      }
    } catch {
      // anulowane przez użytkownika
    }
  }, [track, shareUrl]);

  // sprzątaj blob URL
  useEffect(() => {
    if (cardUrl && prevBlobUrl.current && prevBlobUrl.current !== cardUrl) {
      URL.revokeObjectURL(prevBlobUrl.current);
    }
    prevBlobUrl.current = cardUrl;
  }, [cardUrl]);

  useEffect(() => {
    return () => { if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current); };
  }, []);

  // --- udostępnij z kartą (Web Share API + plik PNG) ---
  const handleNativeShare = useCallback(async () => {
    if (!track) return;
    const text = `🎵 Słucham "${track.title}" – ${track.artist} na GrouAI Stream!`;
    try {
      if (cardBlob && navigator.share) {
        const file = new File([cardBlob], "grouai-track.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: track.title, text });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: track.title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success("Skopiowano do schowka!");
      }
    } catch {
      // anulowane przez użytkownika
    }
  }, [track, cardBlob, shareUrl]);

  // --- Messenger ---
  const handleMessenger = useCallback(() => {
    if (!track) return;
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      // deep link do aplikacji Messenger
      window.location.href = `fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`;
      setTimeout(() => {
        // jeśli aplikacja nie otworzyła się — pobierz kartę
        if (cardBlob) {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(cardBlob);
          a.download = `grouai-${track.title.replace(/\s+/g, "-")}.png`;
          a.click();
          toast.info("Karta pobrana! Wyślij ją jako zdjęcie w Messengerze 📲");
        }
      }, 1800);
    } else {
      // desktop: pobierz kartę + informacja
      handleDownload();
      toast.info("Karta pobrana! Wyślij ją jako zdjęcie w Messengerze na komputerze 💻");
    }
  }, [track, cardBlob, shareUrl]);

  // --- WhatsApp ---
  const handleWhatsApp = useCallback(() => {
    if (!track) return;
    const text = `🎵 Słucham "${track.title}" – ${track.artist} na GrouAI Stream!\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, [track, shareUrl]);

  // --- X / Twitter ---
  const handleTwitter = useCallback(() => {
    if (!track) return;
    const text = `🎵 Słucham "${track.title}" – ${track.artist} na GrouAI Stream!`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
  }, [track, shareUrl]);

  // --- Skopiuj link ---
  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link skopiowany!");
    setTimeout(() => setCopied(false), 2200);
  }, [shareUrl]);

  // --- Pobierz kartę ---
  const handleDownload = useCallback(() => {
    if (!cardBlob || !track) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(cardBlob);
    a.download = `grouai-${track.title.replace(/[\s/\\?%*:|"<>]/g, "-")}.png`;
    a.click();
  }, [cardBlob, track]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121a] overflow-hidden"
          >
            {/* nagłówek */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <span className="text-sm font-semibold text-white">Udostępnij utwór</span>
              <button onClick={onClose} className="p-1 text-white/40 hover:text-white/70 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* podgląd karty */}
            <div className="px-5 pb-4">
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white/5">
                {generating && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
                    />
                  </div>
                )}
                {cardUrl && (
                  <motion.img
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={cardUrl}
                    alt="Karta utworu"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            {/* przyciski */}
            <div className="px-5 pb-6 space-y-3">

              {/* najszybszy: natywne okno systemowe, AirDrop/Nearby Share — bez czekania na kartę */}
              <button
                onClick={handleNearbyShare}
                className="w-full flex items-center gap-3 rounded-xl bg-accent/20 border border-accent/30 px-4 py-3 hover:bg-accent/30 transition-colors"
              >
                <Radar className="h-5 w-5 flex-shrink-0 text-accent" />
                <span className="text-sm font-medium text-white">Podaj osobie obok</span>
                <span className="ml-auto text-xs text-white/40">AirDrop / Nearby Share</span>
              </button>

              {/* główny: Web Share API z plikiem */}
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center gap-3 rounded-xl bg-primary/20 border border-primary/30 px-4 py-3 hover:bg-primary/30 transition-colors"
              >
                <Share2 className="h-5 w-5 flex-shrink-0 text-primary" />
                <span className="text-sm font-medium text-white">Udostępnij z kartą</span>
                <span className="ml-auto text-xs text-white/40">Messenger, inne</span>
              </button>

              {/* siatka platform */}
              <div className="grid grid-cols-4 gap-2">

                {/* Messenger */}
                <button
                  onClick={handleMessenger}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0084FF]">
                    <MessageCircle className="h-5 w-5 fill-white text-white" />
                  </div>
                  <span className="text-[10px] text-white/50">Messenger</span>
                </button>

                {/* WhatsApp */}
                <button
                  onClick={handleWhatsApp}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]">
                    <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <span className="text-[10px] text-white/50">WhatsApp</span>
                </button>

                {/* X / Twitter */}
                <button
                  onClick={handleTwitter}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black">
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <span className="text-[10px] text-white/50">X / Twitter</span>
                </button>

                {/* Pobierz kartę */}
                <button
                  onClick={handleDownload}
                  disabled={!cardBlob}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] text-white/50">Pobierz</span>
                </button>
              </div>

              {/* kopiuj link */}
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
              >
                {copied
                  ? <Check className="h-4 w-4 flex-shrink-0 text-green-400" />
                  : <Link2 className="h-4 w-4 flex-shrink-0 text-white/50" />
                }
                <span className="min-w-0 truncate text-sm text-white/60">{shareUrl}</span>
                <span className="ml-auto flex-shrink-0 text-xs text-primary">
                  {copied ? "Skopiowano!" : "Kopiuj"}
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
