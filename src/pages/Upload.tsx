import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Upload as UploadIcon, Music, CheckCircle, Loader2, ShieldCheck, XCircle, AlertTriangle, FileAudio, LogIn, Gift, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useLanguage } from "@/contexts/LanguageContext";
import { CoverDesigner } from "@/components/cover/CoverDesigner";

const genres = [
  "Pop", "Rock", "Electronic", "EDM", "House", "Trance", "Hip-Hop", "R&B",
  "Jazz", "Disco", "Punk", "Metal", "Ambient", "Lo-fi", "Indie", "Trap",
  "Reggaeton", "Classical", "Folk", "Country", "Other"
];

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus", ".wma", ".weba"];
const AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/mp4", "audio/x-m4a",
  "audio/ogg", "audio/flac", "audio/aac", "audio/opus", "audio/webm",
];
const MIN_DURATION_SEC = 10;

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cannot read audio file"));
    };
    audio.src = url;
  });
}

const Upload = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sunoLink, setSunoLink] = useState("");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationResult, setModerationResult] = useState<any>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [durationError, setDurationError] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [insertedTrackId, setInsertedTrackId] = useState<string | null>(null);
  const [wantMonetize, setWantMonetize] = useState(true);

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Artist";
  const isSunoTrack = sunoLink.trim().length > 0;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!AUDIO_TYPES.includes(file.type) && !AUDIO_EXTENSIONS.includes(ext)) {
      toast.error(t("upload.unsupportedFormat"));
      e.target.value = "";
      return;
    }

    try {
      const dur = await getAudioDuration(file);
      setAudioFile(file);
      setAudioDuration(dur);
      if (dur < MIN_DURATION_SEC) {
        setDurationError(true);
        toast.error(`${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, "0")} — ${t("upload.fileTooShort")}`);
      } else {
        setDurationError(false);
      }
    } catch {
      toast.error(t("upload.unsupportedFormat"));
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !genre || !agreed) {
      toast.error(t("upload.fillRequired"));
      return;
    }
    if (!sunoLink && !audioFile) {
      toast.error(t("upload.addFileOrLink"));
      return;
    }
    if (audioFile && durationError) {
      toast.error(t("upload.tooShort"));
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(null);

    try {
      let audioUrl = "";

      if (audioFile) {
        setUploadProgress(0);
        const { publicUrl } = await uploadToR2({
          file: audioFile,
          folder: "tracks",
          onProgress: (pct) => setUploadProgress(pct),
        });
        audioUrl = publicUrl;
        setUploadProgress(100);
      }

      // AI moderation - real analysis
      setUploadProgress(null);
      toast.info("🤖 Analiza AI w toku...");

      const { data: moderationData, error: moderationError } = await supabase.functions.invoke(
        "ai-moderate-track",
        {
          body: {
            title,
            artist: displayName,
            genre,
            description,
            duration: audioDuration || 180,
            hasSunoLink: isSunoTrack,
            hasAudioFile: !!audioFile,
          },
        }
      );

      if (moderationError) {
        console.error("Moderation error:", moderationError);
        throw new Error("Błąd analizy AI: " + (moderationError.message || ""));
      }

      const result = moderationData?.result;
      if (!result) {
        throw new Error("AI nie zwróciło wyniku analizy");
      }

      // Only insert track if approved or review
      if (result.status === "rejected") {
        setModerationResult(result);
        toast.error("Utwór nie przeszedł weryfikacji AI");
        return;
      }

      const finalAudioUrl = audioUrl || sunoLink || null;
      const { data: insertedTrack, error: trackInsertErr } = await supabase.from("tracks").insert({
        title,
        artist: displayName,
        genre,
        duration: Math.round(audioDuration || 180),
        audio_url: finalAudioUrl,
        cover_url: coverUrl || null,
        user_id: user?.id || null,
        is_monetized: wantMonetize,
        monetization_enabled_at: wantMonetize ? new Date().toISOString() : null,
      } as any).select("id").single();

      if (trackInsertErr) throw trackInsertErr;

      setInsertedTrackId(insertedTrack?.id || null);
      if (!coverUrl && insertedTrack?.id) {
        supabase.functions.invoke("ai-cover", {
          body: { trackId: insertedTrack.id },
        }).catch(() => {/* silent */});
      }

      window.dispatchEvent(new Event("track-list-changed"));

      setModerationResult(result);
      toast.success(result.status === "approved" ? t("upload.accepted") : "Utwór skierowany do ręcznej weryfikacji");
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error(t("upload.submitError") + ": " + (err.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSunoLink("");
    setTitle("");
    setGenre("");
    setDescription("");
    setAgreed(false);
    setModerationResult(null);
    setAudioFile(null);
    setAudioDuration(null);
    setDurationError(false);
    setCoverUrl("");
    setUploadProgress(null);
    setInsertedTrackId(null);
  };

  // Require login
  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <LogIn className="h-16 w-16 text-primary mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-3">{t("upload.loginRequired")}</h1>
            <p className="text-muted-foreground mb-6">{t("upload.loginRequiredDesc")}</p>
            <Button onClick={() => navigate("/auth")} className="gap-2">
              <LogIn className="h-4 w-4" />
              {t("auth.signIn")}
            </Button>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  if (moderationResult) {
    const isApproved = moderationResult.status === "approved";
    const isReview = moderationResult.status === "review";
    const Icon = isApproved ? CheckCircle : isReview ? AlertTriangle : XCircle;
    const iconColor = isApproved ? "text-green-500" : isReview ? "text-yellow-500" : "text-red-500";

    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              <Icon className={`h-20 w-20 ${iconColor} mx-auto mb-6`} />
            </motion.div>
            <h1 className="text-3xl font-bold mb-3">
              {isApproved ? t("upload.successTitle") : isReview ? t("upload.reviewTitle") : t("upload.rejectedTitle")}
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              {isApproved ? t("upload.successDesc") : isReview ? t("upload.reviewDesc") : t("upload.rejectedDesc")}
            </p>
            {isApproved && (
              <div className="mt-6 space-y-3 flex flex-col items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-6 py-3"
                >
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-green-300 font-semibold">{t("upload.confirmed")}</span>
                </motion.div>
                {isSunoTrack && (
                  <span className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 rounded-full px-4 py-1.5 text-xs font-semibold text-primary">
                    <Music className="h-3.5 w-3.5" /> AI-Assisted (Suno)
                  </span>
                )}
                {insertedTrackId && (
                  <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
                    <Music className="h-4 w-4" />
                    Przejdź do biblioteki
                  </Button>
                )}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-secondary/50 rounded-xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">AI Quality Score: {moderationResult.total_score}/100</h2>
            </div>

            <div className="space-y-3">
              {[
                { label: t("upload.lengthMin"), score: moderationResult.score_length },
                { label: t("upload.lyricQuality"), score: moderationResult.score_lyrics },
                { label: t("upload.vocalQuality"), score: moderationResult.score_vocal },
                { label: t("upload.production"), score: moderationResult.score_production },
                { label: t("upload.originality"), score: moderationResult.score_originality },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm w-48">{item.label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.score / 20) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className={`h-full rounded-full ${
                        item.score >= 15 ? "bg-green-500" : item.score >= 10 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                    />
                  </div>
                  <span className="text-sm font-mono w-10 text-right">{item.score}/20</span>
                </div>
              ))}
            </div>

            {moderationResult.rejection_reasons?.length > 0 && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-sm font-medium text-red-400 mb-1">{t("upload.reasons")}</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {moderationResult.rejection_reasons.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {moderationResult.analysis && (
              <p className="mt-4 text-sm text-muted-foreground italic">{moderationResult.analysis}</p>
            )}

            {moderationResult.recommendations && (
              <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary mb-1">{t("upload.recommendations")}</p>
                <p className="text-sm text-muted-foreground">{moderationResult.recommendations}</p>
              </div>
            )}
          </motion.div>

          <Button className="w-full" onClick={resetForm}>
            {t("upload.sendAnother")}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Promo banner */}
          <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
            <Gift className="h-6 w-6 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary">{t("upload.promoTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("upload.promoDesc")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <UploadIcon className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t("upload.title")}</h1>
            </div>
          </div>
          <p className="text-muted-foreground mb-4 mt-3">{t("upload.desc")}</p>

          <div className="bg-secondary/30 rounded-xl p-4 mb-8 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{t("upload.aiChecks")}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <span>{t("upload.lengthMin")}</span>
              <span>{t("upload.lyricQuality")}</span>
              <span>{t("upload.vocalQuality")}</span>
              <span>{t("upload.production")}</span>
              <span>{t("upload.originality")}</span>
              <span>{t("upload.minScore")}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="suno-link" className="flex items-center gap-1.5">
                <Music className="h-4 w-4 text-primary" /> {t("upload.sunoLabel")}
              </Label>
              <Input
                id="suno-link"
                placeholder={t("upload.sunoPlaceholder")}
                value={sunoLink}
                onChange={(e) => setSunoLink(e.target.value)}
                className="bg-card/60 border-muted"
              />
            </div>

            {/* Audio file upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileAudio className="h-4 w-4 text-primary" /> {t("upload.fileLabel")}
              </Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  durationError
                    ? "border-red-500/50 bg-red-500/5"
                    : audioFile
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border hover:border-primary/50 hover:bg-secondary/30"
                }`}
              >
                {audioFile ? (
                  <div className="flex items-center justify-center gap-3">
                    {durationError ? (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium truncate">{audioFile.name}</p>
                      <p className={`text-xs ${durationError ? "text-red-400" : "text-muted-foreground"}`}>
                        {audioDuration !== null
                          ? `${Math.floor(audioDuration / 60)}:${String(Math.floor(audioDuration % 60)).padStart(2, "0")}`
                          : "..."}{" "}
                        • {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                        {durationError && ` — ${t("upload.fileTooShort")}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAudioFile(null);
                        setAudioDuration(null);
                        setDurationError(false);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      {t("upload.fileChange")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <FileAudio className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t("upload.fileDrop")}</p>
                    <p className="text-xs text-muted-foreground/60">{t("upload.fileMinMax")}</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,.opus,.wma,.weba"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t("upload.titleLabel")}</Label>
              <Input
                id="title"
                placeholder={t("upload.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-card/60 border-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("upload.genreLabel")}</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="bg-card/60 border-muted">
                  <SelectValue placeholder={t("upload.genrePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {genres.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">{t("upload.descLabel")}</Label>
              <Textarea
                id="desc"
                placeholder={t("upload.descPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-card/60 border-muted min-h-[100px]"
              />
            </div>

            {/* Artist info (read-only from profile) */}
            <div className="space-y-2">
              <Label>{t("upload.artistLabel")}</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-card/60 border border-muted rounded-md text-sm">
                <span className="font-medium">{displayName}</span>
                <span className="text-muted-foreground text-xs">({t("upload.fromProfile")})</span>
              </div>
            </div>

            {/* Monetization opt-in */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  <p className="font-semibold text-sm">Czy chcesz zarabiać na tym utworze?</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Każde odsłuchanie powyżej 30 sekund = 1 stream × 0.003 zł (65% trafia do Ciebie).
                  Wypłaty co miesiąc na konto bankowe. Możesz to zmienić w każdej chwili.
                </p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setWantMonetize(true)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                      wantMonetize
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                        : "border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                  >
                    <CheckCircle className={cn("h-4 w-4", wantMonetize ? "text-emerald-400" : "text-muted-foreground")} />
                    Tak, chcę zarabiać
                  </button>
                  <button
                    type="button"
                    onClick={() => setWantMonetize(false)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                      !wantMonetize
                        ? "bg-white/10 border-white/20 text-foreground"
                        : "border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                  >
                    Nie teraz
                  </button>
                </div>
              </div>
            </div>

            {/* Cover Designer */}
            <CoverDesigner
              title={title}
              genre={genre}
              onCoverReady={setCoverUrl}
              coverUrl={coverUrl}
            />

            <div className="flex items-center gap-3 pt-2">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="agree" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                {t("upload.agreeLabel")}
              </Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-primary px-0 whitespace-nowrap"
                onClick={() => window.location.href = "/legal"}
              >
                {t("upload.agreeRules")}
              </Button>
            </div>

            {/* Upload Progress Bar */}
            {uploadProgress !== null && isSubmitting && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Przesyłanie pliku do R2...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || durationError}
                className="w-full h-12 text-base font-semibold bg-green-500 hover:bg-green-400 text-black rounded-full gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t("upload.submitting")}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    {t("upload.submitBtn")}
                  </>
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default Upload;
