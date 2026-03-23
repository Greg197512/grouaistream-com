import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Upload as UploadIcon, Music, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const genres = [
  "Pop", "Rock", "Electronic", "EDM", "House", "Trance", "Hip-Hop", "R&B",
  "Jazz", "Disco", "Punk", "Metal", "Ambient", "Lo-fi", "Indie", "Trap",
  "Reggaeton", "Classical", "Folk", "Country", "Other"
];

const Upload = () => {
  const [sunoLink, setSunoLink] = useState("");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sunoLink || !title || !genre || !email || !agreed) {
      toast.error("Wypełnij wszystkie wymagane pola i zaakceptuj regulamin.");
      return;
    }
    setIsSubmitting(true);
    // Simulate submission
    await new Promise((r) => setTimeout(r, 1500));
    setIsSubmitting(false);
    setSubmitted(true);
    toast.success("Utwór wysłany do weryfikacji!");
  };

  if (submitted) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <CheckCircle className="h-20 w-20 text-green-500 mb-6" />
          </motion.div>
          <h1 className="text-3xl font-bold mb-3">Dziękujemy!</h1>
          <p className="text-muted-foreground max-w-md">
            Twój utwór został wysłany do weryfikacji. Sprawdzimy go w ciągu 24–48h i dodamy z badge'em AI-Assisted.
          </p>
          <Button className="mt-8" onClick={() => setSubmitted(false)}>
            Wyślij kolejny
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
          <p className="text-muted-foreground mb-8 mt-3">
            Wklej link do Suno (lub embed), tytuł, gatunek i opis. 
            Sprawdzimy w 24–48h i dodamy z badge'em <span className="text-primary font-medium">AI-Assisted</span>.
          </p>

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
              <Label htmlFor="desc">Opis (opcjonalny)</Label>
              <Textarea
                id="desc"
                placeholder="Opowiedz coś o swoim utworze..."
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
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <UploadIcon className="h-5 w-5" />
                )}
                Wyślij do weryfikacji
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default Upload;
