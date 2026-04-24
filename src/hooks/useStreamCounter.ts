import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts a stream after 45+ seconds of continuous playback.
 * Calls the record_stream DB function which handles deduplication,
 * stream counting, and earnings generation.
 */
export function useStreamCounter(
  trackId: string | null,
  isPlaying: boolean,
  userId: string | null,
  source: string = "direct"
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

    if (!isPlaying || !trackId) return;

    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;

      // After 45 seconds, record the stream (only for logged-in users)
      if (elapsedRef.current >= 45 && countedRef.current !== trackId && userId) {
        countedRef.current = trackId;
        supabase.rpc("record_stream", {
          _track_id: trackId,
          _user_id: userId,
          _duration_played: elapsedRef.current,
          _source: source,
        }).then(({ error }) => {
          if (error) console.error("[StreamCounter] Error:", error);
          else console.log("[StreamCounter] Stream recorded for track:", trackId, "source:", source);
        });
        // Emit to brain event bus (fire-and-forget)
        supabase.rpc("emit_agent_event", {
          _event_type: "stream.recorded",
          _source: "stream-counter",
          _actor_user_id: userId,
          _target_type: "track",
          _target_id: trackId,
          _payload: { duration_played: elapsedRef.current, source },
          _priority: 6,
        }).then(() => {}, () => {});
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, trackId, userId, source]);
}
