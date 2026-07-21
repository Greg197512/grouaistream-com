import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Fire-and-forget: po ustawieniu okładki utworu uruchamia w tle generację
 * krótkiego teledysku (image-to-video) i zapisuje wynik do tracks.video_url.
 * Nie blokuje UI. Po sukcesie dispatchuje `track-list-changed`, żeby listy
 * podmieniły <img> na <video> natychmiast.
 */
export function triggerCoverVideo(trackId: string, opts?: { silent?: boolean; force?: boolean }) {
  if (!trackId) return;
  if (!opts?.silent) {
    toast.info("🎬 Kręcę teledysk z okładki w tle…", { duration: 4000 });
  }
  supabase.functions
    .invoke("auto-cover-video", { body: { track_id: trackId, force: !!opts?.force } })
    .then(({ data, error }) => {
      if (error) {
        console.warn("[auto-cover-video] failed:", error);
        return;
      }
      if (data?.ok) {
        window.dispatchEvent(new CustomEvent("track-list-changed"));
        if (!opts?.silent) toast.success("🎬 Teledysk gotowy!");
      }
    })
    .catch((e) => console.warn("[auto-cover-video] threw:", e));
}
