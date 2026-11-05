// Karta DJ Yellow w Studio Pro (tylko właściciel): dzisiejsze utwory + „Zrób teraz”.
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { DJ_OWNER, djRunNow, djStatus, type DjTrack } from "@/lib/djYellow";

export function DjYellowCard() {
  const { user } = useAuth();
  const [today, setToday] = useState<DjTrack[]>([]);
  const [latest, setLatest] = useState<DjTrack[]>([]);
  const [busy, setBusy] = useState(false);
  const owner = user?.email?.toLowerCase() === DJ_OWNER;
  const load = () => void djStatus().then((s) => { if (s) { setToday(s.today); setLatest(s.latest); } });
  useEffect(() => { if (owner) load(); }, [owner]);
  if (!owner) return null;
  const go = async () => {
    setBusy(true);
    try {
      for (let i = 0; i < 4; i++) {
        const r = await djRunNow();
        if (r.step === "waiting") { toast.info("Suno komponuje… sprawdzam za 90 s"); await new Promise((res) => setTimeout(res, 90_000)); continue; }
        const made = (r.tracks ?? []).filter((x) => x.id).map((x) => x.title);
        if (made.length) toast.success(`Gotowe: ${made.join(" · ")}`);
        else if (r.step === "done-today") toast.info("Dzisiejsze 2 utwory już są");
        else if (!r.ok) toast.error(r.error ?? r.step);
        break;
      }
    } finally { setBusy(false); load(); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#FFD400]/40 bg-gradient-to-r from-[#FFD400]/15 via-[#FF9500]/10 to-transparent p-3 text-white">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFD400] font-black text-black">DJ</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">DJ Yellow · codziennie 2 utwory elektroniczne</p>
        <p className="text-xs text-white/70">Dziś: {today.length}/2 · pomysł od asystenta AI, okładki, „Nowe” i radio. Robi się samo, gdy jesteś zalogowany.</p>
      </div>
      <div className="flex -space-x-2">
        {(today.length ? today : latest).slice(0, 4).map((t) => t.cover_url
          ? <img key={t.id} src={t.cover_url} alt={t.title} title={t.title} className="h-10 w-10 rounded-lg border-2 border-black object-cover" />
          : null)}
      </div>
      <button type="button" onClick={() => void go()} disabled={busy || today.length >= 2}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[#FFD400] px-4 text-sm font-bold text-black transition hover:bg-[#ffe066] disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{today.length >= 2 ? "Dziś gotowe" : "Zrób teraz"}
      </button>
    </div>
  );
}
