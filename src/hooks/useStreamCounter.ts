import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts a stream after 30+ seconds of continuous playback.
 * Calls the record_stream DB function which handles deduplication,
 * stream counting, and earnings generation.
 */
export function useStreamCounter(
  trackId: string | null,
  isPlaying: boolean,
  userId: string | null
) {
  const elapsedRef = useRef(0);
  const countedRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Reset when track changes
    elapsedRef.current = 0;
    countedRef.current = null;
  }, [trackId]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isPlaying || !trackId || !userId) return;

    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;

      // After 30 seconds, record the stream
      if (elapsedRef.current >= 30 && countedRef.current !== trackId) {
        countedRef.current = trackId;
        supabase.rpc("record_stream", {
          _track_id: trackId,
          _user_id: userId,
          _duration_played: elapsedRef.current,
        }).then(({ error }) => {
          if (error) console.error("[StreamCounter] Error:", error);
        });
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, trackId, userId]);
}
