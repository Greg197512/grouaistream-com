import { useRef, useEffect, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaveformPlayerProps {
  audioUrl: string;
  title: string;
  genre: string;
  onSaveToLibrary?: () => void;
  compact?: boolean;
}

export const WaveformPlayer = ({ audioUrl, title, genre, onSaveToLibrary, compact }: WaveformPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#FF6B00",
      progressColor: "#FF9500",
      cursorColor: "#FF9500",
      barWidth: compact ? 2 : 3,
      barRadius: 2,
      barGap: compact ? 1 : 2,
      height: compact ? 32 : 48,
      normalize: true,
      backend: "WebAudio",
    });

    ws.load(audioUrl);
    ws.on("ready", () => setReady(true));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, compact]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  const downloadTrack = () => {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${title || "track"}.mp3`;
    a.click();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={togglePlay} disabled={!ready}>
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <div ref={containerRef} className="flex-1 min-w-0" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="w-full rounded-lg" />
      <div className="flex items-center gap-2">
        <Button
          onClick={togglePlay}
          disabled={!ready}
          className="gap-2 bg-[#FF6B00] hover:bg-[#FF9500] text-white"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? "Pauza" : "Odtwórz"}
        </Button>
        <Button onClick={downloadTrack} variant="outline" className="gap-2 border-[#FF6B00]/30 text-[#FF9500] hover:bg-[#FF6B00]/10">
          <Download className="h-4 w-4" />
          Pobierz MP3
        </Button>
        {onSaveToLibrary && (
          <Button onClick={onSaveToLibrary} variant="outline" className="gap-2 border-[#FF6B00]/30 text-[#FF9500] hover:bg-[#FF6B00]/10">
            Zapisz do biblioteki
          </Button>
        )}
      </div>
    </div>
  );
};
