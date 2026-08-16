import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Film, Loader2, Download, Sparkles, Wand2 } from "lucide-react";
import { submitVideoSmart, waitForVideoSmart, isSubscriptionError, type VideoEngine } from "@/lib/hubStudio";

/**
 * VIDEO STUDIO — teledysk / film z tekstu. Domyślnie leci naszym działającym
 * silnikiem (Replicate: LTX / MiniMax). Gdy w hubie pojawi się klucz Higgsfield,
 * submitVideoSmart automatycznie użyje Higgsfielda — bez zmian w tym UI.
 */
const ASPECTS = [
  { id: "9:16", label: "Pion 9:16", hint: "Reels / TikTok / Shorts" },
  { id: "16:9", label: "Poziom 16:9", hint: "YouTube" },
  { id: "1:1", label: "Kwadrat 1:1", hint: "Feed" },
] as const;

export function VideoStudio() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<string>("9:16");
  const [quality, setQuality] = useState<"good" | "vip">("good");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<VideoEngine | null>(null);
  const cancelRef = useRef(false);

  const generate = async () => {
    if (!user) { toast.error("Zaloguj się, aby tworzyć wideo"); return; }
    const p = prompt.trim();
    if (p.length < 5) { toast.error("Opisz scenę / teledysk (min. kilka słów)"); return; }
    setBusy(true); setVideoUrl(null); setEngineUsed(null); cancelRef.current = false;
    setStatus("🎬 Zlecam wideo…");
    try {
      const { engine, jobId } = await submitVideoSmart(p, { quality, aspect });
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
      if (isSubscriptionError(e)) { toast.error("Jakość VIP wymaga planu Pro/Ultimate — wybierz tryb Szybko albo ulepsz plan."); }
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
        <p className="text-xs text-gray-400 max-w-md mx-auto">Opisz teledysk lub scenę — AI zrobi z tego wideo. Pion pod Reels/TikTok, poziom pod YouTube.</p>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="np. Neonowe nocne miasto w deszczu, jazda kamery nad ulicą, odbicia świateł, filmowo, 4K…"
        className="w-full resize-none rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#FF6B00]/60"
      />

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

      <Button onClick={generate} disabled={busy}
        className="w-full gap-2 bg-gradient-to-br from-[#FF6B00] to-[#9333EA] text-white font-bold h-12">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5" />}
        {busy ? (status || "Renderuję…") : "Wygeneruj wideo"}
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
        Silnik: <b className="text-white/60">nasz (Replicate)</b> — działa od zaraz. Po dodaniu klucza Higgsfield w hubie Video Studio automatycznie przełączy się na Higgsfield.
      </p>
    </div>
  );
}
