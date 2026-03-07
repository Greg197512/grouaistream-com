import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Music, Image, FileAudio, Loader2 } from "lucide-react";

interface StorageInfo {
  totalFiles: number;
  totalSizeMB: number;
  audioFiles: number;
  audioSizeMB: number;
  imageFiles: number;
  imageSizeMB: number;
}

export const StorageStats = () => {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStorage();
  }, []);

  const fetchStorage = async () => {
    try {
      // List all files in music bucket
      const { data: musicFiles } = await supabase.storage.from("music").list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });

      // List nested folders too
      let allFiles: any[] = [];
      if (musicFiles) {
        for (const item of musicFiles) {
          if (item.id) {
            allFiles.push(item);
          } else {
            // It's a folder, list inside
            const { data: nested } = await supabase.storage
              .from("music")
              .list(item.name, { limit: 1000 });
            if (nested) allFiles.push(...nested.filter((f) => f.id));
          }
        }
      }

      // List avatars
      const { data: avatarFiles } = await supabase.storage.from("avatars").list("", { limit: 500 });
      const avatars = (avatarFiles || []).filter((f) => f.id);

      const allCombined = [...allFiles, ...avatars];

      const audioExts = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma"];
      const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];

      let audioCount = 0, audioSize = 0, imgCount = 0, imgSize = 0;

      for (const f of allCombined) {
        const name = (f.name || "").toLowerCase();
        const size = f.metadata?.size || 0;
        const isAudio = audioExts.some((e) => name.endsWith(e));
        const isImage = imageExts.some((e) => name.endsWith(e));

        if (isAudio) { audioCount++; audioSize += size; }
        if (isImage) { imgCount++; imgSize += size; }
      }

      const totalSize = allCombined.reduce((s, f) => s + (f.metadata?.size || 0), 0);

      setInfo({
        totalFiles: allCombined.length,
        totalSizeMB: totalSize / (1024 * 1024),
        audioFiles: audioCount,
        audioSizeMB: audioSize / (1024 * 1024),
        imageFiles: imgCount,
        imageSizeMB: imgSize / (1024 * 1024),
      });
    } catch (err) {
      console.error("Storage fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!info) return null;

  // Assume 1GB soft limit for display
  const maxGB = 1;
  const usedPct = Math.min((info.totalSizeMB / (maxGB * 1024)) * 100, 100);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          Zużycie przestrzeni dyskowej
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Łącznie</span>
            <span className="font-medium">{fmt(info.totalSizeMB)} / {maxGB} GB</span>
          </div>
          <Progress value={usedPct} className="h-3" />
          <p className="text-xs text-muted-foreground">{info.totalFiles} plików łącznie</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/30 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileAudio className="h-4 w-4 text-primary" />
              Muzyka
            </div>
            <p className="text-lg font-bold">{fmt(info.audioSizeMB)}</p>
            <p className="text-xs text-muted-foreground">{info.audioFiles} plików audio</p>
          </div>
          <div className="rounded-lg border border-border/30 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Image className="h-4 w-4 text-accent" />
              Obrazy
            </div>
            <p className="text-lg font-bold">{fmt(info.imageSizeMB)}</p>
            <p className="text-xs text-muted-foreground">{info.imageFiles} plików</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
