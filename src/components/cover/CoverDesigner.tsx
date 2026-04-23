import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Upload, Loader2, Disc3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useLanguage } from "@/contexts/LanguageContext";
import { CDJewelCase } from "./CDJewelCase";

interface CoverDesignerProps {
  title: string;
  genre: string;
  onCoverReady: (url: string) => void;
  coverUrl?: string;
}

export const CoverDesigner = ({ title, genre, onCoverReady, coverUrl }: CoverDesignerProps) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<string>("ai");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(coverUrl || "");
  const [backCoverUrl, setBackCoverUrl] = useState("");
  const [generatingBack, setGeneratingBack] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(coverUrl || "");
  }, [coverUrl]);

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("cover.selectImage"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("cover.maxSize"));
      return;
    }

    try {
      const { publicUrl } = await uploadToR2({
        file,
        folder: "covers",
      });
      setPreviewUrl(publicUrl);
      onCoverReady(publicUrl);
      toast.success(t("cover.uploaded"));
    } catch (err: any) {
      console.error("Cover upload error:", err);
      toast.error(t("cover.errorUpload"));
    }
  };

  const generateAICover = async (side: "front" | "back" = "front") => {
    if (!prompt.trim() && !title) {
      toast.error(t("cover.enterPrompt"));
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
          toast.success(t("cover.backGenerated"));
        } else {
          setPreviewUrl(data.cover_url);
          onCoverReady(data.cover_url);
          toast.success(t("cover.generated"));
        }
      } else {
        toast.error(t("cover.errorGen"));
      }
    } catch (err: any) {
      console.error("Cover gen error:", err);
      toast.error(t("cover.errorGen"));
    } finally {
      setGenerating(false);
      setGeneratingBack(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2 text-base font-semibold">
        <Disc3 className="h-5 w-5 text-primary" />
        {t("cover.title")}
      </Label>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> {t("cover.aiTab")}
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> {t("cover.uploadTab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label htmlFor="cover-prompt" className="text-sm">
              {t("cover.promptLabel")}
            </Label>
            <Textarea
              id="cover-prompt"
              placeholder={t("cover.promptPlaceholder")}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="bg-card/60 border-muted min-h-[80px]"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("cover.promptHint")}
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
              {generating ? t("cover.genFrontLoading") : t("cover.genFront")}
            </Button>
            <Button
              type="button"
              onClick={() => generateAICover("back")}
              disabled={generatingBack}
              className="flex-1 gap-2"
              variant="outline"
            >
              {generatingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generatingBack ? t("cover.genBackLoading") : t("cover.genBack")}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-secondary/30"
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("cover.uploadClick")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t("cover.uploadHint")}</p>
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
          <Label className="text-sm text-muted-foreground mb-2 block">{t("cover.preview")}</Label>
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
