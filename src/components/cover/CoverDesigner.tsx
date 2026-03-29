import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, Wand2, Upload, Loader2, Disc3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CDJewelCase } from "./CDJewelCase";

interface CoverDesignerProps {
  title: string;
  genre: string;
  onCoverReady: (url: string) => void;
  coverUrl?: string;
}

export const CoverDesigner = ({ title, genre, onCoverReady, coverUrl }: CoverDesignerProps) => {
  const [tab, setTab] = useState<string>("ai");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(coverUrl || "");
  const [backCoverUrl, setBackCoverUrl] = useState("");
  const [generatingBack, setGeneratingBack] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik graficzny (JPG, PNG, WEBP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maksymalny rozmiar okładki: 10 MB");
      return;
    }

    const safeName = (title || "cover").replace(/[^a-zA-Z0-9\-_]/g, "_").substring(0, 60);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `covers/custom-${safeName}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("music").upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      toast.error("Błąd uploadu okładki");
      return;
    }

    const { data } = supabase.storage.from("music").getPublicUrl(filePath);
    setPreviewUrl(data.publicUrl);
    onCoverReady(data.publicUrl);
    toast.success("Okładka wgrana!");
  };

  const generateAICover = async (side: "front" | "back" = "front") => {
    if (!prompt.trim() && !title) {
      toast.error("Wpisz opis okładki lub tytuł utworu");
      return;
    }

    if (side === "back") setGeneratingBack(true);
    else setGenerating(true);

    try {
      const desc = side === "back"
        ? `Back cover of an album. ${prompt || title}. Include tracklist area, barcode area at bottom. Professional album back cover design, photographic quality.`
        : prompt || undefined;

      const { data, error } = await supabase.functions.invoke("ai-cover-generate", {
        body: {
          title,
          style: genre,
          description: desc,
          mode: desc ? "custom" : "auto",
        },
      });

      if (error) throw error;
      if (data?.cover_url) {
        if (side === "back") {
          setBackCoverUrl(data.cover_url);
          toast.success("Tylna okładka wygenerowana!");
        } else {
          setPreviewUrl(data.cover_url);
          onCoverReady(data.cover_url);
          toast.success("Okładka wygenerowana!");
        }
      } else {
        toast.error("Nie udało się wygenerować okładki");
      }
    } catch (err: any) {
      console.error("Cover gen error:", err);
      toast.error("Błąd generowania okładki");
    } finally {
      setGenerating(false);
      setGeneratingBack(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2 text-base font-semibold">
        <Disc3 className="h-5 w-5 text-primary" />
        Okładka albumu
      </Label>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> AI Generator
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Własna grafika
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label htmlFor="cover-prompt" className="text-sm">
              Opisz jak ma wyglądać okładka (opcjonalnie)
            </Label>
            <Textarea
              id="cover-prompt"
              placeholder="np. Ciemny las nocą z neonowymi światłami, klimat cyberpunk, deszcz, odbicia w kałużach..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="bg-card/60 border-muted min-h-[80px]"
            />
            <p className="text-[11px] text-muted-foreground">
              Zostaw puste — AI sam dobierze motyw na podstawie tytułu i gatunku
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => generateAICover("front")}
              disabled={generating}
              className="flex-1 gap-2"
              variant="outline"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? "Generuję przód..." : "Generuj przód"}
            </Button>
            <Button
              type="button"
              onClick={() => generateAICover("back")}
              disabled={generatingBack}
              className="flex-1 gap-2"
              variant="outline"
            >
              {generatingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generatingBack ? "Generuję tył..." : "Generuj tył"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-secondary/30"
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Kliknij aby wybrać okładkę</p>
            <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WEBP • max 10 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUploadCover}
            className="hidden"
          />
        </TabsContent>
      </Tabs>

      {/* CD Jewel Case Preview */}
      {(previewUrl || backCoverUrl) && (
        <div className="mt-4">
          <Label className="text-sm text-muted-foreground mb-2 block">Podgląd CD Jewel Case</Label>
          <CDJewelCase
            frontCover={previewUrl}
            backCover={backCoverUrl}
            title={title}
            artist=""
          />
        </div>
      )}
    </div>
  );
};
