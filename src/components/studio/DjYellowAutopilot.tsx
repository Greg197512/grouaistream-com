// Niewidoczny strażnik: gdy właściciel jest zalogowany, raz dziennie zleca 2 utwory DJ Yellow (Nowe + radio).
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { DJ_OWNER, DJ_YELLOW_USER_ID, djDailyTick } from "@/lib/djYellow";
import { certifyStudioTrack } from "@/lib/releasePipeline";

export function DjYellowAutopilot() {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.email?.toLowerCase() !== DJ_OWNER && user?.id !== DJ_YELLOW_USER_ID) return;
    const t = window.setTimeout(() => {
      void djDailyTick((r) => {
        const fresh = (r.tracks ?? []).filter((x) => x.id && x.audio);
        const made = fresh.map((x) => x.title);
        if (made.length) toast.success(`🟡 DJ Aurexis: ${made.join(" · ")} — już w „Nowych” i w radiu`, { duration: 9000 });
        else if (!r.ok) toast.error(`DJ Aurexis: ${r.error ?? r.step}`);
        // Studio GrouAI: mastering −14 LUFS, WAV, pakiet Spotify i znaczek „✓ GrouAI Studio” (okładka z jego zdjęciem zostaje).
        void (async () => {
          for (const t of fresh) {
            const pkg = await certifyStudioTrack({ audioUrl: t.audio!, coverUrl: t.cover ?? null, title: t.title, artist: "DJ Aurexis", genre: "Electronic", instrumental: true, userId: user!.id, trackId: t.id!, keepCover: true });
            if (pkg) toast.success(`🎛️ Studio GrouAI: „${t.title}” zmasterowany (${pkg.lufs} LUFS) ✓`, { duration: 6000 });
          }
        })();
      });
    }, 8000); // po starcie strony, żeby nie spowalniać
    return () => clearTimeout(t);
  }, [user?.email, user?.id]);
  return null;
}
