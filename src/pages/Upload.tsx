import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Upload as UploadIcon, Music, CheckCircle, Loader2, ShieldCheck, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const genres = [
  "Pop", "Rock", "Electronic", "EDM", "House", "Trance", "Hip-Hop", "R&B",
  "Jazz", "Disco", "Punk", "Metal", "Ambient", "Lo-fi", "Indie", "Trap",
  "Reggaeton", "Classical", "Folk", "Country", "Other"
];

const Upload = () => {
  const { t } = useLanguage();
  const [sunoLink, setSunoLink] = useState("");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationResult, setModerationResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sunoLink || !title || !genre || !email || !agreed) {
      toast.error("Wypełnij wszystkie wymagane pola i zaakceptuj regulamin.");
      return;
    }
    setIsSubmitting(true);
    setModerationResult(null);

    try {
      const submissionId = crypto.randomUUID();
      
      // 1. Insert submission
      const { error: insertErr } = await supabase
        .from("track_submissions" as any)
        .insert({
          id: submissionId,
          suno_link: sunoLink,
          title,
          genre,
          description: description || null,
          user_email: email,
          status: "pending",
        } as any);

      if (insertErr) throw insertErr;

      toast.info("🔍 Analizuję utwór przez AI...");

      // 2. Trigger AI moderation
      const { data: modData, error: modErr } = await supabase.functions.invoke("ai-moderate-track", {
        body: { submission_id: submissionId },
      });
      
      const modResult = modData;

      if (modErr) throw modErr;

      setModerationResult(modResult.result);

      if (modResult.result?.status === "approved") {
        toast.success("✅ Utwór zaakceptowany! Zostanie dodany do platformy.");
      } else if (modResult.result?.status === "review") {
        toast.info("⏳ Utwór wymaga ręcznej weryfikacji. Sprawdzimy go w 24-48h.");
      } else {
        toast.error("❌ Utwór nie spełnia wymagań jakościowych.");
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Błąd podczas wysyłania: " + (err.message || "Spróbuj ponownie"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSunoLink("");
    setTitle("");
    setGenre("");
    setDescription("");
    setEmail("");
    setAgreed(false);
    setModerationResult(null);
  };

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
              {isApproved ? "Zaakceptowany! 🎉" : isReview ? "Do ręcznej weryfikacji ⏳" : "Odrzucony ❌"}
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              {isApproved
                ? "Twój utwór spełnia nasze standardy jakości i zostanie dodany z badge'em AI-Assisted."
                : isReview
                ? "Utwór wymaga dodatkowej weryfikacji. Sprawdzimy go w ciągu 24-48h."
                : "Utwór nie spełnił wymagań jakościowych. Popraw go i spróbuj ponownie."}
            </p>
          </motion.div>

          {/* Score breakdown */}
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
                { label: "📏 Długość & Struktura", score: moderationResult.score_length },
                { label: "📝 Tekst / Lyrics", score: moderationResult.score_lyrics },
                { label: "🎤 Wokal", score: moderationResult.score_vocal },
                { label: "🎛️ Produkcja & Aranż", score: moderationResult.score_production },
                { label: "💎 Oryginalność", score: moderationResult.score_originality },
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
                <p className="text-sm font-medium text-red-400 mb-1">Powody:</p>
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
                <p className="text-sm font-medium text-primary mb-1">💡 Rekomendacje:</p>
                <p className="text-sm text-muted-foreground">{moderationResult.recommendations}</p>
              </div>
            )}
          </motion.div>

          <Button className="w-full" onClick={resetForm}>
            Wyślij kolejny utwór
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <UploadIcon className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Dodaj swój utwór</h1>
            </div>
          </div>
          <p className="text-muted-foreground mb-4 mt-3">
            Wklej link do Suno (lub embed), tytuł, gatunek i opis.
            AI sprawdzi jakość w kilka sekund. Wynik ≥60/100 = automatyczna akceptacja.
          </p>

          {/* Quality criteria info */}
          <div className="bg-secondary/30 rounded-xl p-4 mb-8 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">AI sprawdza 5 kryteriów:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <span>📏 Długość & Struktura</span>
              <span>📝 Jakość tekstu</span>
              <span>🎤 Jakość wokalu</span>
              <span>🎛️ Produkcja & dynamika</span>
              <span>💎 Oryginalność</span>
              <span>🎯 Min. 60/100 pkt</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="suno-link" className="flex items-center gap-1.5">
                <Music className="h-4 w-4 text-primary" /> Link Suno / Embed *
              </Label>
              <Input
                id="suno-link"
                placeholder="https://suno.com/song/... lub embed link"
                value={sunoLink}
                onChange={(e) => setSunoLink(e.target.value)}
                className="bg-card/60 border-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Tytuł utworu *</Label>
              <Input
                id="title"
                placeholder="Nazwa Twojego tracka"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-card/60 border-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Gatunek *</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="bg-card/60 border-muted">
                  <SelectValue placeholder="Wybierz gatunek" />
                </SelectTrigger>
                <SelectContent>
                  {genres.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Opis (opcjonalny – wpływa na ocenę!)</Label>
              <Textarea
                id="desc"
                placeholder="Opowiedz o procesie tworzenia, inspiracjach, co chciałeś przekazać..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-card/60 border-muted min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email kontaktowy *</Label>
              <Input
                id="email"
                type="email"
                placeholder="twoj@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-card/60 border-muted"
              />
            </div>

            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="agree" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                Akceptuję regulamin GrouAI Stream i zgadzam się na publikację utworu z badge'em AI-Assisted po pozytywnej weryfikacji.
              </Label>
            </div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold bg-green-500 hover:bg-green-400 text-black rounded-full gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    AI analizuje utwór...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    Wyślij do weryfikacji AI
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
