// Niewidoczny strażnik: gdy właściciel jest zalogowany, raz dziennie zleca 2 utwory DJ Yellow (Nowe + radio).
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { DJ_OWNER, djDailyTick } from "@/lib/djYellow";

export function DjYellowAutopilot() {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.email?.toLowerCase() !== DJ_OWNER) return;
    const t = window.setTimeout(() => {
      void djDailyTick((r) => {
        const made = (r.tracks ?? []).filter((x) => x.id).map((x) => x.title);
        if (made.length) toast.success(`🟡 DJ Yellow: ${made.join(" · ")} — już w „Nowych” i w radiu`, { duration: 9000 });
        else if (!r.ok) toast.error(`DJ Yellow: ${r.error ?? r.step}`);
      });
    }, 8000); // po starcie strony, żeby nie spowalniać
    return () => clearTimeout(t);
  }, [user?.email]);
  return null;
}
