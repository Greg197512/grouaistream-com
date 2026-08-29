import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Globalna nakładka głosu DJ-a na żywo.
 * Słucha kanału "radio-live-voice" NA KAŻDEJ stronie i odtwarza głos DJ-a,
 * przyciszając aktualną muzykę (talkover) — dzięki temu wejście na antenę
 * słychać u WSZYSTKICH słuchaczy, nie tylko na /radio-live.
 *
 * Na samej stronie /radio-live nie działa — tam obsługuje to lokalny listener,
 * żeby nie odtwarzać głosu podwójnie.
 */
const base64ToBlobUrl = (audioBase64: string, mimeType: string) => {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
};

export const GlobalLiveVoiceOverlay = () => {
  const location = useLocation();
  const onRadioLivePage = location.pathname === "/radio-live";

  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const savedVolRef = useRef<number | null>(null);
  const restoreTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (onRadioLivePage) return; // /radio-live ma własny odtwarzacz głosu

    const duck = () => {
      const music = document.querySelector("audio[data-player='main']") as HTMLAudioElement | null;
      if (music && savedVolRef.current === null) {
        savedVolRef.current = music.volume;
        music.volume = Math.max(music.volume * 0.15, 0.02);
      }
      if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = window.setTimeout(restore, 1800);
    };
    const restore = () => {
      const music = document.querySelector("audio[data-player='main']") as HTMLAudioElement | null;
      if (music && savedVolRef.current !== null) music.volume = savedVolRef.current;
      savedVolRef.current = null;
    };

    const playNext = () => {
      const next = queueRef.current.shift();
      if (!next) { playingRef.current = false; voiceAudioRef.current = null; restore(); return; }
      playingRef.current = true;
      const a = new Audio(next);
      a.volume = 1;
      voiceAudioRef.current = a;
      const done = () => { URL.revokeObjectURL(next); if (voiceAudioRef.current === a) voiceAudioRef.current = null; playNext(); };
      a.addEventListener("ended", done, { once: true });
      a.addEventListener("error", done, { once: true });
      a.play().catch(() => done()); // autoplay zablokowany → pomiń
    };

    const channel = supabase
      .channel("radio-live-voice", { config: { broadcast: { self: false }, presence: { key: clientIdRef.current } } })
      .on("broadcast", { event: "chunk" }, ({ payload }) => {
        if (!payload?.audioBase64 || payload.sourceId === clientIdRef.current) return;
        try {
          queueRef.current.push(base64ToBlobUrl(payload.audioBase64, payload.mimeType || "audio/webm"));
          duck();
          if (!playingRef.current) playNext();
        } catch { /* */ }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ role: "listener", at: Date.now() }).catch(() => {});
      });

    return () => {
      supabase.removeChannel(channel);
      if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
      queueRef.current.forEach((u) => URL.revokeObjectURL(u));
      queueRef.current = [];
      voiceAudioRef.current?.pause();
      restore();
    };
  }, [onRadioLivePage]);

  return null;
};
