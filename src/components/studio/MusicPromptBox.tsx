import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Send, Globe, Music2, AlertCircle,
  Flame, Wand2, Mic2, Guitar, CheckCircle2, Download, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { invokeStudioEngine, waitForAceStep, fireCoverGeneration, isSubscriptionError, submitStudioVideo, waitForStudioVideo, fetchStoryboard, submitStudioLipsync, waitForStudioLipsync } from "@/lib/hubStudio";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { exportTeledysk, exportScenesOnly } from "@/lib/teledyskExport";

type Lang = "auto" | "pl" | "en" | "nl" | "uk";

const PLACEHOLDERS: Record<Exclude<Lang, "auto">, string[]> = {
  pl: [
    "Smutny lo-fi z deszczem, 80 BPM, 2 minuty, instrumentalny…",
    "Energetyczny synthwave w stylu The Midnight, męski wokal, 3 minuty…",
    "Mroczny trap na nocną jazdę, 140 BPM, kobiecy szept…",
    "Radosny pop o lecie, chwytliwy refren, kobiecy wokal…",
  ],
  en: [
    "Sad lo-fi with rain, 80 BPM, 2 minutes, instrumental…",
    "Energetic synthwave like The Midnight, male vocals, 3 minutes…",
    "Dark trap for a night drive, 140 BPM, female whisper…",
    "Joyful summer pop, catchy chorus, female vocals…",
  ],
  nl: [
    "Verdrietige lo-fi met regen, 80 BPM, 2 minuten, instrumentaal…",
    "Energieke synthwave zoals The Midnight, mannelijke zang…",
    "Donkere trap voor een nachtrit, 140 BPM, vrouwelijk gefluister…",
    "Vrolijke zomerpop, pakkend refrein, vrouwelijke zang…",
  ],
  uk: [
    "Сумний lo-fi з дощем, 80 BPM, 2 хвилини, інструментальний…",
    "Енергійний synthwave у стилі The Midnight, чоловічий вокал…",
    "Темний trap для нічної їзди, 140 BPM, жіночий шепіт…",
    "Радісний літній поп, чіпкий приспів, жіночий вокал…",
  ],
};

const STAGE_LABELS: Record<Exclude<Lang, "auto">, { parsing: string; composing: string; done: string }> = {
  pl: { parsing: "Rozumiem co chcesz…", composing: "Komponuję utwór…", done: "Gotowe!" },
  en: { parsing: "Understanding your idea…", composing: "Composing your track…", done: "Done!" },
  nl: { parsing: "Ik begrijp wat U wilt…", composing: "Ik componeer Uw nummer…", done: "Klaar!" },
  uk: { parsing: "Розумію вашу ідею…", composing: "Створюю трек…", done: "Готово!" },
};

// Szybkie style — jedno kliknięcie dopisuje do opisu (jak tagi w Suno)
const VIBES: { label: string; emoji: string; add: string }[] = [
  { label: "Pop", emoji: "✨", add: "chwytliwy pop, radiowy" },
  { label: "Rock", emoji: "🎸", add: "energiczny rock, mocne gitary" },
  { label: "Disco", emoji: "🪩", add: "taneczne disco, lata 80" },
  { label: "Hip-Hop", emoji: "🎤", add: "hip-hop, mocny bit, flow" },
  { label: "Lo-fi", emoji: "🌧️", add: "spokojny lo-fi, chillout" },
  { label: "Elektronika", emoji: "⚡", add: "electronic, syntezatory, energetyczny" },
  { label: "Ballada", emoji: "💜", add: "emocjonalna ballada, pianino" },
  { label: "Epicki", emoji: "🔥", add: "epicki, filmowy, orkiestrowy" },
];

// AI wykrywa docelowy format z tego, co napisze user (bez przełącznika):
// „tiktok / reels / shorts / pionowo / insta / story" → 9:16, „youtube / poziomo" → 16:9.
function detectAspect(text: string): "9:16" | "16:9" {
  const t = (text || "").toLowerCase();
  if (/(tik[\s-]?tok|reels?|shorts?|pionow|9:16|9x16|vertical|stor(y|ies)|instagram|insta\b|na telefon)/.test(t)) return "9:16";
  if (/(you[\s-]?tube|yt\b|poziom|16:9|16x9|horizontal|szerok|kino)/.test(t)) return "16:9";
  return "16:9";
}
const aspectLabel = (a: string) => (a === "9:16" ? "pionowo 9:16 (TikTok/Reels)" : "poziomo 16:9 (YouTube)");

interface Props {
  onTrackReady?: (data: {
    audioUrl?: string;
    coverUrl?: string;
    generationId: string;
    plan: any;
    engine: string;
    taskId?: string;
    processing?: boolean;
  }) => void;
}

// Losowe iskry/płomienie zapalające się i gasnące — niepowtarzalny efekt
function EmberField({ active }: { active: boolean }) {
  const embers = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        id: i,
        left: `${8 + Math.random() * 84}%`,
        bottom: `${Math.random() * 40}%`,
        delay: Math.random() * 4,
        dur: 2.5 + Math.random() * 3,
        size: 8 + Math.random() * 12,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {embers.map((e) => (
        <motion.div
          key={e.id}
          className="absolute"
          style={{ left: e.left, bottom: e.bottom }}
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={{
            opacity: active ? [0, 0.9, 0] : [0, 0.35, 0],
            y: active ? [-4, -60] : [-2, -24],
            scale: [0.6, 1, 0.5],
          }}
          transition={{ duration: e.dur, repeat: Infinity, delay: e.delay, ease: "easeOut" }}
        >
          <Flame
            style={{ width: e.size, height: e.size }}
            className={active ? "text-orange-400" : "text-primary/50"}
          />
        </motion.div>
      ))}
    </div>
  );
}

export function MusicPromptBox({ onTrackReady }: Props) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<Lang>("auto");
  const [instrumental, setInstrumental] = useState(false);
  const [mode, setMode] = useState<"music" | "video" | "teledysk">("music");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoQuality, setVideoQuality] = useState<"good" | "vip">("good");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [singing, setSinging] = useState(true);
  const [clip, setClip] = useState<{ audioUrl: string; videoUrls: string[]; aspect: "9:16" | "16:9"; finalUrl?: string } | null>(null);
  const [clipIdx, setClipIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const clipBlobRef = useRef<Blob | null>(null);
  const [stage, setStage] = useState<"idle" | "parsing" | "composing" | "done" | "error">("idle");
  const [planSummary, setPlanSummary] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string>("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [activeVibes, setActiveVibes] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prompt) return;
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % 4), 3500);
    return () => clearInterval(id);
  }, [prompt]);

  const placeholderLang = language === "auto" ? "pl" : language;
  const placeholder = PLACEHOLDERS[placeholderLang][placeholderIdx];
  const labels = STAGE_LABELS[placeholderLang];
  const isBusy = stage === "parsing" || stage === "composing";

  const toggleVibe = (v: (typeof VIBES)[number]) => {
    if (isBusy) return;
    if (activeVibes.includes(v.label)) {
      setActiveVibes((s) => s.filter((x) => x !== v.label));
    } else {
      setActiveVibes((s) => [...s, v.label]);
      setPrompt((p) => (p.trim() ? `${p.trim()}, ${v.add}` : v.add));
    }
    textareaRef.current?.focus();
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error("Zaloguj się aby tworzyć muzykę");
      return;
    }
    if (prompt.trim().length < 3) {
      toast.error(mode === "video" ? "Opisz krótko scenę do wideo" : "Powiedz coś więcej o utworze");
      textareaRef.current?.focus();
      return;
    }

    if (mode === "video") return handleGenerateVideo();
    if (mode === "teledysk") return handleGenerateClip();

    setStage("parsing");
    setError("");
    setPlanSummary("");
    setElapsed(0);

    try {
      const finalPrompt = instrumental ? `${prompt.trim()} (instrumentalny, bez wokalu)` : prompt.trim();
      const { data, error: fnError } = await invokeStudioEngine("studio-prompt-engine", {
        prompt: finalPrompt,
        ...(language !== "auto" ? { language } : {}),
      });

      if (fnError) throw new Error(fnError.message || "Generation failed");
      if (!data?.success) throw new Error(data?.message || data?.error || "Engine error");

      const summary: string = data.plan?.human_summary || "";
      setPlanSummary(summary);
      setStage("composing");

      // Utwór jest już w „Twoje utwory” (rekord generations) — odśwież listę od razu
      window.dispatchEvent(new CustomEvent("grouai:generations-changed"));

      // Okładka AI (darmowa) startuje w tle, dopasowana do tytułu i stylu
      fireCoverGeneration(data.task_id, data.plan?.title || "", data.plan?.tags || "");

      const { audioUrl, coverUrl } = await waitForAceStep(data.task_id, data.generation_id, (sec) =>
        setElapsed(sec)
      );

      setStage("done");
      toast.success(labels.done);
      // Gotowy utwór — odśwież „Twoje utwory”, by pokazał się z audio i okładką
      window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
      onTrackReady?.({
        audioUrl,
        coverUrl: coverUrl || undefined,
        generationId: data.generation_id,
        plan: data.plan,
        engine: data.engine,
      });
      setActiveVibes([]);
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: any) {
      if (isSubscriptionError(e)) {
        setStage("idle");
        setShowUpgrade(true);
        return;
      }
      console.error("[MusicPromptBox]", e);
      setStage("error");
      setError(e.message || "Coś poszło nie tak — spróbuj ponownie");
      toast.error(e.message || "Błąd generowania");
      setTimeout(() => setStage("idle"), 6000);
    }
  };

  // Tryb wideo: teledysk/film z tekstu (Higgsfield przez hub). Gdy brak klucza → komunikat.
  const handleGenerateVideo = async () => {
    setStage("parsing");
    setError("");
    setPlanSummary("");
    setElapsed(0);
    setVideoUrl(null);

    try {
      const vAspect = detectAspect(prompt);
      toast.info(`🎬 Format: ${aspectLabel(vAspect)}`, { duration: 2500 });
      const { data, error: fnError } = await submitStudioVideo(prompt.trim(), { quality: videoQuality, aspect: vAspect });
      if (fnError) throw new Error(fnError.message || "Nie udało się zlecić wideo");

      if (data?.pending) {
        setStage("idle");
        const msg = data.message || "🎬 Tryb wideo czeka na klucz Higgsfield — dodaj klucz, aby generować.";
        setError(msg);
        toast.info(msg, { duration: 6000 });
        setTimeout(() => setError(""), 9000);
        return;
      }
      if (!data?.job_id) throw new Error(data?.message || "Silnik wideo nie zwrócił zadania");

      setPlanSummary("Tworzę wideo z Twojego opisu…");
      setStage("composing");
      const url = await waitForStudioVideo(data.job_id, (sec) => setElapsed(sec));

      setVideoUrl(url);
      setStage("done");
      toast.success("Wideo gotowe! 🎬");
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: any) {
      if (isSubscriptionError(e)) {
        setStage("idle");
        setShowUpgrade(true);
        return;
      }
      console.error("[MusicPromptBox video]", e);
      setStage("error");
      setError(e.message || "Coś poszło nie tak przy generowaniu wideo");
      toast.error(e.message || "Błąd generowania wideo");
      setTimeout(() => setStage("idle"), 6000);
    }
  };

  // Tryb teledysk: AI SAMO układa film z tekstu/klimatu utworu.
  // 1) generuje muzykę (plan+tekst), 2) z tekstu robi storyboard (sceny),
  // 3) generuje z nich klipy (Replicate), 4) składa w zsynchronizowany teledysk.
  const CLIP_COUNT = 4;
  const handleGenerateClip = async () => {
    setStage("parsing");
    setError("");
    setPlanSummary("");
    setElapsed(0);
    setClip(null);
    setVideoUrl(null);

    try {
      const musicPromptFinal = instrumental ? `${prompt.trim()} (instrumentalny, bez wokalu)` : prompt.trim();

      // 1) Muzyka — silnik Studia zwraca plan (tytuł, tagi, tekst) od razu; audio dochodzi w tle.
      const { data: mData, error: mErr } = await invokeStudioEngine("studio-prompt-engine", {
        prompt: musicPromptFinal,
        ...(language !== "auto" ? { language } : {}),
      });
      if (mErr) throw new Error(mErr.message || "Błąd muzyki");
      if (!mData?.success) throw new Error(mData?.message || mData?.error || "Błąd silnika muzyki");
      const plan = mData.plan || {};
      window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
      fireCoverGeneration(mData.task_id, plan?.title || "", plan?.tags || "");

      // AI wykrywa format z tego, co napisał user (utwór + ew. wskazówka stylu).
      const aspect = detectAspect(`${prompt} ${videoPrompt}`);

      setStage("composing");
      setPlanSummary(`AI reżyseruje teledysk z tekstu utworu · ${aspectLabel(aspect)}…`);

      const audioJob = waitForAceStep(mData.task_id, mData.generation_id).then((r) => r.audioUrl);

      // 2) Storyboard z tekstu/klimatu utworu (AI decyduje o scenach). 3) Klipy ze scen.
      const clipsJob = (async () => {
        let scenes = await fetchStoryboard({
          song_prompt: prompt.trim(),
          title: plan?.title || "",
          tags: typeof plan?.tags === "string" ? plan.tags : (Array.isArray(plan?.tags) ? plan.tags.join(", ") : ""),
          lyrics: plan?.lyrics || "",
          style: videoPrompt.trim() || undefined, // opcjonalna wskazówka stylu
          count: CLIP_COUNT,
          singing, // tryb śpiewany: każda scena z twarzą tego samego wokalisty
        });
        if (!scenes.length) {
          // Awaryjnie: użyj wskazówki lub opisu utworu jako wspólnej sceny.
          const base = videoPrompt.trim() || prompt.trim();
          scenes = Array.from({ length: CLIP_COUNT }).map(() => `${base}, cinematic music video, high quality`);
        }
        const jobIds = await Promise.all(
          scenes.map(async (scene) => {
            const { data, error: e } = await submitStudioVideo(scene, { quality: videoQuality, aspect });
            if (e) throw new Error(e.message || "Błąd wideo");
            if (!data?.job_id) throw new Error(data?.message || "Błąd zlecenia wideo");
            return data.job_id as string;
          }),
        );
        return await Promise.all(jobIds.map((id) => waitForStudioVideo(id, (sec) => setElapsed(sec))));
      })();

      const [audioUrl, clipUrls] = await Promise.all([audioJob, clipsJob]);

      // 4) Tryb śpiewany: sklej sceny → wgraj → LatentSync synchronizuje usta
      // z wokalem na CAŁYM wideo (działa w każdym języku, bo idzie po dźwięku).
      let finalUrl: string | undefined;
      if (singing) {
        try {
          setPlanSummary("Synchronizuję usta wokalisty ze słowami piosenki…");
          const scenesBlob = await exportScenesOnly(clipUrls, undefined, aspect);
          const scenesPath = `lipsync-in-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp4`;
          const up = await supabase.storage.from("music").upload(scenesPath, scenesBlob, { contentType: "video/mp4", upsert: true });
          if (up.error) throw up.error;
          const { data: pub } = supabase.storage.from("music").getPublicUrl(scenesPath);
          const { data: ls, error: lsErr } = await submitStudioLipsync(pub.publicUrl, audioUrl);
          if (lsErr || !ls?.job_id) throw new Error(ls?.message || lsErr?.message || "lipsync_submit_failed");
          finalUrl = await waitForStudioLipsync(ls.job_id, (sec) => setElapsed(sec));
        } catch (lsE: any) {
          if (isSubscriptionError(lsE)) {
            toast.info("🎤 Pełny lip-sync wymaga planu Pro/Ultimate — pokazuję zwykły teledysk.");
          } else {
            console.error("[teledysk lipsync]", lsE);
            toast.info("Nie udało się zsynchronizować ust — pokazuję zwykły teledysk.");
          }
        }
      }

      setClipIdx(0);
      clipBlobRef.current = null;
      setExportPct(0);
      setClip({ audioUrl, videoUrls: clipUrls, aspect, finalUrl });
      setStage("done");
      toast.success(finalUrl ? "Śpiewający teledysk gotowy! 🎤🎥" : "Teledysk gotowy! 🎥");
      window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: any) {
      if (isSubscriptionError(e)) {
        setStage("idle");
        setShowUpgrade(true);
        return;
      }
      console.error("[MusicPromptBox teledysk]", e);
      setStage("error");
      setError(e.message || "Coś poszło nie tak przy tworzeniu teledysku");
      toast.error(e.message || "Błąd teledysku");
      setTimeout(() => setStage("idle"), 6000);
    }
  };

  // Sklej klipy + utwór w jeden plik MP4 (ffmpeg.wasm). Zwraca File; cache w ref.
  const buildTeledyskFile = async (): Promise<File> => {
    if (!clip) throw new Error("brak teledysku");
    let blob = clipBlobRef.current;
    if (!blob) {
      setExporting(true);
      setExportPct(1);
      try {
        if (clip.finalUrl) {
          // Śpiewający teledysk: LatentSync zwraca gotowy plik z audio — tylko pobieramy (przez proxy CORS).
          const r = await fetch(`https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/media-proxy?u=${encodeURIComponent(clip.finalUrl)}`);
          if (!r.ok) throw new Error("download_failed");
          blob = await r.blob();
        } else {
          blob = await exportTeledysk(clip.videoUrls, clip.audioUrl, (p) => setExportPct(p), clip.aspect);
        }
        clipBlobRef.current = blob;
      } finally {
        setExporting(false);
      }
    }
    return new File([blob], "grouai-teledysk.mp4", { type: "video/mp4" });
  };

  const handleDownloadTeledysk = async () => {
    try {
      const file = await buildTeledyskFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Teledysk pobrany 🎥");
    } catch (e: any) {
      toast.error("Nie udało się skleić teledysku — pobierz muzykę i ujęcia osobno");
    }
  };

  // Publikacja teledysku na stronie w „Nowe na serwerze" (tracks.video_url).
  const handleTeledyskToNew = async () => {
    if (!user) { toast.error("Zaloguj się, aby publikować"); return; }
    setPublishing(true);
    try {
      const file = await buildTeledyskFile();
      const path = `teledysk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp4`;
      // Bucket „music" akceptuje uploady zwykłych userów; gdyby odrzucił wideo — próba „tiktok-reels".
      let bucket = "music";
      let up = await supabase.storage.from(bucket).upload(path, file, { contentType: "video/mp4", upsert: true });
      if (up.error) {
        bucket = "tiktok-reels";
        up = await supabase.storage.from(bucket).upload(path, file, { contentType: "video/mp4", upsert: true });
      }
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const artistName = user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Studio";
      const title = prompt.trim().slice(0, 60) || "Teledysk GrouAI";
      const { error: insErr } = await supabase.from("tracks").insert({
        user_id: user.id,
        title,
        artist: artistName,
        album: "AI Generated",
        duration: 30,
        video_url: pub.publicUrl,
        cover_url: null,
        genre: "AI",
        mood: "generated",
      });
      if (insErr) throw insErr;
      toast.success(`„${title}" jest już na stronie głównej w „Nowe na serwerze"! 🚀`);
      window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
    } catch (e: any) {
      toast.error("Nie udało się opublikować teledysku: " + (e?.message || "błąd"));
    } finally {
      setPublishing(false);
    }
  };

  const handleShareTeledysk = async () => {
    try {
      const file = await buildTeledyskFile();
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Mój teledysk — GrouAI Stream", text: "Teledysk stworzony w GrouAI Studio 🎥 grouaistream.com" });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.info("To urządzenie nie wspiera bezpośredniego wysyłania — teledysk pobrany, wrzuć go na YouTube/TikTok.");
      }
    } catch {
      toast.error("Nie udało się przygotować teledysku do wysłania");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative w-full">
      {/* Obracająca się poświata za kartą */}
      <motion.div
        aria-hidden
        className="absolute -inset-[2px] -z-10 rounded-[26px] opacity-70 blur-md"
        style={{
          background:
            "conic-gradient(from 0deg, #FF6B00, #9333EA, #FF9500, #FF6B00)",
        }}
        animate={{ rotate: isBusy ? 360 : [0, 360] }}
        transition={{ duration: isBusy ? 4 : 18, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#12101c]/90 backdrop-blur-2xl p-6 shadow-2xl">
        <EmberField active={isBusy} />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#9333EA] shadow-lg"
              animate={isBusy ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 1, repeat: isBusy ? Infinity : 0 }}
            >
              {isBusy ? <Flame className="h-5 w-5 text-white" /> : <Wand2 className="h-5 w-5 text-white" />}
            </motion.div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-white leading-none">
                Stwórz utwór
              </h2>
              <p className="text-[11px] text-white/50 mt-0.5">Opisz jednym zdaniem — AI zrobi resztę</p>
            </div>
          </div>

          {/* Język */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-1 border border-white/10">
            {(["auto", "pl", "en", "nl", "uk"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                disabled={isBusy}
                className={`px-2 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  language === l ? "bg-white text-black shadow" : "text-white/50 hover:text-white"
                }`}
              >
                {l === "auto" ? <Globe className="w-3 h-3 inline" /> : l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Przełącznik Muzyka / Video / Teledysk */}
        <div className="relative z-10 mb-3 flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10 w-fit">
          <button
            onClick={() => !isBusy && setMode("music")}
            disabled={isBusy}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${mode === "music" ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
          >
            🎵 Muzyka
          </button>
          <button
            onClick={() => !isBusy && setMode("video")}
            disabled={isBusy}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${mode === "video" ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
          >
            🎬 Video
          </button>
          <button
            onClick={() => !isBusy && setMode("teledysk")}
            disabled={isBusy}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${mode === "teledysk" ? "bg-gradient-to-r from-[#FF6B00] to-[#9333EA] text-white shadow" : "text-white/60 hover:text-white"}`}
          >
            🎥 Teledysk
          </button>
        </div>

        {/* Jakość wideo: Good (tani/szybki) vs VIP (najlepszy model) */}
        {mode !== "music" && (
          <div className="relative z-10 -mt-1 mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-white/50">Jakość:</span>
            <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
              <button
                onClick={() => !isBusy && setVideoQuality("good")}
                disabled={isBusy}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${videoQuality === "good" ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
                title="LTX-Video — szybko i tanio"
              >
                Good · LTX-Video
              </button>
              <button
                onClick={() => !isBusy && setVideoQuality("vip")}
                disabled={isBusy}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${videoQuality === "vip" ? "bg-gradient-to-r from-[#FF6B00] to-[#9333EA] text-white shadow" : "text-white/60 hover:text-white"}`}
                title="MiniMax — najwyższa jakość (plan Pro/Ultimate)"
              >
                ⭐ VIP · MiniMax
              </button>
            </div>
            {mode === "teledysk" && (
              <button
                onClick={() => !isBusy && setSinging((v) => !v)}
                disabled={isBusy}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                  singing
                    ? "border-[#FF6B00]/60 bg-gradient-to-r from-[#FF6B00]/20 to-[#9333EA]/20 text-orange-200"
                    : "border-white/10 bg-white/5 text-white/50 hover:text-white"
                }`}
                title="Usta wokalisty idą dokładnie ze słowami (każdy język: PL/UA/NL/EN). Plan Pro/Ultimate."
              >
                🎤 {singing ? "Śpiewający: usta w synchro ze słowami" : "Śpiewający: wyłączony"}
              </button>
            )}
          </div>
        )}

        {/* Chipy stylu (styl muzyczny — pomaga też opisać klimat wideo) */}
        <div className="relative z-10 flex flex-wrap gap-1.5 mb-3">
          {VIBES.map((v) => {
            const on = activeVibes.includes(v.label);
            return (
              <button
                key={v.label}
                onClick={() => toggleVibe(v)}
                disabled={isBusy}
                className={`group relative inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  on
                    ? "border-[#FF6B00] bg-[#FF6B00]/15 text-orange-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
                }`}
              >
                <span>{v.emoji}</span>
                {v.label}
                {on && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="ml-0.5"
                  >
                    <Flame className="h-3 w-3 text-orange-400" />
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>

        {/* Pole opisu — z delikatnie pulsującą, świecącą ramką */}
        <motion.div
          className="relative z-10 rounded-2xl"
          animate={{
            boxShadow: [
              "0 0 4px rgba(255,107,0,0.15), 0 0 8px rgba(147,51,234,0.10)",
              "0 0 16px rgba(255,107,0,0.55), 0 0 30px rgba(147,51,234,0.35)",
              "0 0 4px rgba(255,107,0,0.15), 0 0 8px rgba(147,51,234,0.10)",
            ],
          }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder={
              mode === "video"
                ? "Opisz scenę do wideo: np. neonowe miasto nocą, jazda dronem, deszcz…"
                : mode === "teledysk"
                ? "🎵 Opis MUZYKI: np. energetyczny synthwave, męski wokal, 3 min…"
                : placeholder
            }
            disabled={isBusy}
            className="min-h-[96px] text-base resize-none bg-black/30 border-white/10 text-white focus-visible:ring-[#FF6B00] placeholder:text-white/35 rounded-2xl"
          />
        </motion.div>

        {/* Drugie pole — OPCJONALNA wskazówka stylu wideo (tylko Teledysk) */}
        {mode === "teledysk" && (
          <div className="relative z-10 mt-2">
            <Textarea
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="🎬 Styl wideo (opcjonalnie): np. anime, retro VHS, czarno-białe kino… — zostaw puste, a AI samo dobierze"
              disabled={isBusy}
              className="min-h-[56px] text-sm resize-none bg-black/30 border-[#9333EA]/30 text-white focus-visible:ring-[#9333EA] placeholder:text-white/35 rounded-2xl"
            />
            <p className="mt-1 text-[10px] text-white/40">✨ Piszesz tylko utwór — <b>AI samo czyta tekst piosenki i układa z niego film</b> ({CLIP_COUNT} ujęcia zsynchronizowane z muzyką). Styl wyżej jest opcjonalny.</p>
          </div>
        )}

        {/* Pasek akcji */}
        <div className="relative z-10 flex items-center justify-between mt-3 gap-3">
          <button
            onClick={() => !isBusy && setInstrumental((v) => !v)}
            disabled={isBusy}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              instrumental
                ? "border-purple-400/50 bg-purple-500/15 text-purple-200"
                : "border-white/10 bg-white/5 text-white/60 hover:text-white"
            }`}
            title="Utwór bez wokalu"
          >
            {instrumental ? <Guitar className="h-3.5 w-3.5" /> : <Mic2 className="h-3.5 w-3.5" />}
            {instrumental ? "Instrumental" : "Z wokalem"}
          </button>

          <motion.div whileHover={!isBusy ? { scale: 1.03 } : {}} whileTap={!isBusy ? { scale: 0.97 } : {}}>
            <Button
              onClick={handleGenerate}
              disabled={isBusy || prompt.trim().length < 3}
              size="lg"
              className="relative overflow-hidden font-bold px-8 text-white border-0 shadow-lg shadow-[#FF6B00]/30 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500, #9333EA)" }}
            >
              {/* płomienny połysk lecący przez przycisk */}
              {!isBusy && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent)" }}
                  animate={{ x: ["-120%", "120%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5 }}
                />
              )}
              <span className="relative flex items-center">
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {mode === "video"
                      ? (stage === "parsing" ? "Przygotowuję wideo…" : `Tworzę wideo… ${elapsed}s`)
                      : mode === "teledysk"
                      ? (stage === "parsing" ? "Reżyseruję teledysk…" : `Kręcę teledysk… ${elapsed}s`)
                      : (stage === "parsing" ? labels.parsing : `${labels.composing} ${elapsed}s`)}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {mode === "video" ? "Generuj wideo" : mode === "teledysk" ? "Stwórz teledysk" : "Generuj"}
                  </>
                )}
              </span>
            </Button>
          </motion.div>
        </div>

        {/* Status / postęp / błąd */}
        <AnimatePresence>
          {(planSummary || error || stage === "done") && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative z-10 mt-4 overflow-hidden"
            >
              {error ? (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : stage === "done" ? (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{labels.done} Utwór gotowy — pojawił się w „Twoich utworach”.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/30 p-3 text-sm">
                  <Music2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#FF9500]" />
                  <span className="text-white/85">{planSummary}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gotowe wideo */}
        {videoUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mt-4"
          >
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full rounded-xl border border-white/10 bg-black shadow-lg"
            />
            <a
              href={videoUrl}
              download
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#FF9500] hover:underline"
            >
              <Send className="h-3.5 w-3.5 rotate-90" /> Pobierz wideo
            </a>
          </motion.div>
        )}

        {/* Gotowy teledysk — ujęcia lecą po kolei w pętli pod wygenerowaną muzyką */}
        {clip && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mt-4"
          >
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
              {clip.finalUrl ? (
                // Śpiewający teledysk — jeden film, usta zsynchronizowane, dźwięk w pliku.
                <video
                  src={clip.finalUrl}
                  controls
                  autoPlay
                  playsInline
                  className={clip.aspect === "9:16" ? "mx-auto h-[420px] aspect-[9/16] object-cover" : "w-full aspect-video object-cover"}
                />
              ) : (
                <video
                  key={clipIdx}
                  src={clip.videoUrls[clipIdx]}
                  muted
                  autoPlay
                  playsInline
                  onEnded={() => setClipIdx((i) => (i + 1) % clip.videoUrls.length)}
                  className={clip.aspect === "9:16" ? "mx-auto h-[420px] aspect-[9/16] object-cover" : "w-full aspect-video object-cover"}
                />
              )}
              <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/80">
                {clip.finalUrl ? "🎤 usta w synchro" : `ujęcie ${clipIdx + 1}/${clip.videoUrls.length}`}
              </span>
            </div>
            {!clip.finalUrl && <audio src={clip.audioUrl} controls autoPlay className="w-full mt-2" />}

            {/* Jeden plik MP4 na YouTube / TikTok */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                onClick={handleShareTeledysk}
                disabled={exporting}
                size="sm"
                className="font-bold text-white border-0"
                style={{ background: "linear-gradient(135deg, #FF6B00, #9333EA)" }}
              >
                {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Share2 className="w-4 h-4 mr-1.5" />}
                {exporting ? `Składam… ${exportPct}%` : "Wyślij do… (YT/TikTok)"}
              </Button>
              <Button
                onClick={handleDownloadTeledysk}
                disabled={exporting}
                size="sm"
                variant="secondary"
                className="font-semibold"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Pobierz teledysk MP4
              </Button>
              <Button
                onClick={handleTeledyskToNew}
                disabled={exporting || publishing}
                size="sm"
                variant="secondary"
                className="font-semibold border border-[#00A3FF]/40 text-[#7fd4ff]"
                title="Opublikuj teledysk na stronie głównej"
              >
                {publishing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Flame className="w-4 h-4 mr-1.5" />}
                {publishing ? "Publikuję…" : "Wyślij do NEW"}
              </Button>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/50">
              <a href={clip.audioUrl} download className="hover:text-[#FF9500] hover:underline">Sama muzyka</a>
              {clip.videoUrls.map((u, i) => (
                <a key={i} href={u} download className="hover:text-[#FF9500] hover:underline">Ujęcie {i + 1}</a>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-white/40">
              „Wyślij do…" składa ujęcia + muzykę w jeden plik MP4 (w Twojej przeglądarce) i otwiera menu udostępniania — wybierasz YouTube / TikTok / itp. Krótki format = idealny na Shorts/Reels.
            </p>
          </motion.div>
        )}

        {/* Equalizer podczas komponowania */}
        <AnimatePresence>
          {stage === "composing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex items-end justify-center gap-1 mt-4 h-10"
            >
              {Array.from({ length: 16 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-[#9333EA] via-[#FF6B00] to-[#FF9500]"
                  animate={{ height: ["15%", "100%", "30%", "80%", "15%"] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.06, ease: "easeInOut" }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </motion.div>
  );
}
