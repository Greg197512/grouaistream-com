import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  onVoiceCloned: (voiceId: string, label: string) => void;
  onCleared: () => void;
  clonedVoiceId: string | null;
  clonedVoiceLabel: string | null;
}

const MAX_DURATION = 30; // seconds
const MIN_DURATION = 8;  // seconds — required for good cloning

// Encode ArrayBuffer → base64 in chunks (avoids stack overflow on large blobs)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export const VoiceRecorder = ({ onVoiceCloned, onCleared, clonedVoiceId, clonedVoiceLabel }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [level, setLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      streamRef.current = stream;

      // Visual level meter
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setLevel(Math.min(100, (avg / 128) * 100));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Pick best supported mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
        cleanup();
      };

      recorder.start();
      setRecording(true);
      setElapsed(0);

      timerRef.current = window.setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= MAX_DURATION) stopRecording();
          return next;
        });
      }, 1000);
    } catch (err: any) {
      console.error("[VoiceRecorder] mic error:", err);
      toast.error("Brak dostępu do mikrofonu", {
        description: "Pozwól przeglądarce na dostęp do mikrofonu w ustawieniach.",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const discard = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    onCleared();
  };

  const cloneVoice = async () => {
    if (!recordedBlob) return;
    if (elapsed < MIN_DURATION) {
      toast.error(`Nagranie zbyt krótkie — potrzeba min. ${MIN_DURATION}s dla dobrej jakości klona.`);
      return;
    }

    setCloning(true);
    try {
      const arrayBuffer = await recordedBlob.arrayBuffer();
      const audioBase64 = arrayBufferToBase64(arrayBuffer);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-voice-clone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            audioBase64,
            name: `GrouAI Voice ${new Date().toLocaleString("pl-PL")}`,
            description: "User-recorded voice for AI singing in GrouAI Studio",
          }),
        }
      );

      const data = await response.json().catch(() => ({ error: "parse_error" }));

      if (!response.ok) {
        if (response.status === 402 || data.error === "quota_exceeded") {
          toast.error("💳 Klonowanie głosu niedostępne", {
            description: data.message || "Wymaga planu ElevenLabs Creator+. Doładuj na elevenlabs.io.",
            duration: 9000,
          });
          return;
        }
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success || !data.voiceId) {
        throw new Error("Brak voice_id w odpowiedzi");
      }

      onVoiceCloned(data.voiceId, data.name);
      toast.success("🎤 Twój głos został sklonowany!", {
        description: "Teraz AI zaśpiewa Twoim głosem dowolny tekst.",
      });
    } catch (err: any) {
      console.error("[VoiceRecorder] clone error:", err);
      toast.error("Błąd klonowania: " + (err.message || "Spróbuj ponownie"));
    } finally {
      setCloning(false);
    }
  };

  // === If voice already cloned: show summary card ===
  if (clonedVoiceId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl border border-[#FF6B00]/40 bg-gradient-to-br from-[#FF6B00]/10 to-[#9333EA]/10 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#FF6B00]/20 border border-[#FF6B00]/50">
              <Check className="h-5 w-5 text-[#FF9500]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Twój głos jest gotowy</p>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">{clonedVoiceLabel}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={discard}
            className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <Badge className="bg-[#FF6B00]/20 text-[#FF9500] border-[#FF6B00]/40 text-xs">
          AI zaśpiewa Twoim głosem dowolny tekst
        </Badge>
      </motion.div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-[#9333EA]/30 bg-[#1a1a2e]/60 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-gray-200 flex items-center gap-2">
          <Mic className="h-4 w-4 text-[#9333EA]" />
          Nagraj swój głos (opcjonalnie)
        </Label>
        {(recording || recordedBlob) && (
          <span className="text-xs font-mono text-[#FF9500]">
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")} / 00:30
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Nagraj 8–30 sekund swojego głosu (mów lub śpiewaj wyraźnie). AI zaśpiewa potem Twoim głosem dowolny tekst.
      </p>

      {/* Live level meter */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="h-2 rounded-full bg-[#0F0F1A] overflow-hidden">
              <motion.div
                className="h-full"
                style={{
                  background: "linear-gradient(90deg, #FF6B00, #FF9500, #9333EA)",
                  width: `${level}%`,
                }}
                animate={{ width: `${level}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playback preview */}
      {recordedUrl && !recording && (
        <audio src={recordedUrl} controls className="w-full h-10" />
      )}

      {/* Warning if too short */}
      {recordedBlob && elapsed < MIN_DURATION && (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Za krótko — nagraj minimum {MIN_DURATION}s</span>
        </div>
      )}

      <div className="flex gap-2">
        {!recording && !recordedBlob && (
          <Button
            type="button"
            onClick={startRecording}
            className="flex-1 gap-2 text-white border-0"
            style={{ background: "linear-gradient(135deg, #9333EA, #FF6B00)" }}
          >
            <Mic className="h-4 w-4" /> Rozpocznij nagrywanie
          </Button>
        )}

        {recording && (
          <Button
            type="button"
            onClick={stopRecording}
            className="flex-1 gap-2 bg-red-500 hover:bg-red-600 text-white"
          >
            <Square className="h-4 w-4 fill-white" /> Zatrzymaj ({MAX_DURATION - elapsed}s)
          </Button>
        )}

        {recordedBlob && !recording && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={discard}
              className="border-gray-600 text-gray-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={cloneVoice}
              disabled={cloning || elapsed < MIN_DURATION}
              className="flex-1 gap-2 text-white border-0"
              style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
            >
              {cloning ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Klonuję głos...</>
              ) : (
                <><Check className="h-4 w-4" /> Użyj tego głosu</>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
