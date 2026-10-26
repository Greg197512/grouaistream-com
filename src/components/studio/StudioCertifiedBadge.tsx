import { useState } from "react";
import { BadgeCheck, AlertTriangle, ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadReleaseZip, type ReleasePackage } from "@/lib/releasePipeline";

/** Mały znaczek na kartach katalogu (np. „Nowe na serwerze”). */
export function StudioCertifiedChip({ className = "" }: { className?: string }) {
  return (
    <span
      title="Przeszedł przez GrouAI Studio: mastering −14 LUFS, WAV 44,1 kHz/16 bit, okładka 3000×3000 — gotowy do dystrybucji na Spotify"
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 ${className}`}
    >
      <BadgeCheck className="h-3 w-3" /> GrouAI Studio
    </span>
  );
}

/** Znaczek pakietu wydania w historii Studia: wyniki kontroli + ZIP dla dystrybutora. */
export function StudioCertifiedBadge({ pkg }: { pkg: ReleasePackage }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = pkg.status === "ready";

  const download = async () => {
    setBusy(true);
    try {
      await downloadReleaseZip(pkg);
    } catch (e) {
      toast.error(`Nie udało się przygotować paczki: ${e instanceof Error ? e.message : "błąd"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
          ready ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-amber-400/40 bg-amber-500/10 text-amber-300"
        }`}
      >
        {ready ? <BadgeCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {ready ? "✓ GrouAI Studio · gotowe do Spotify" : "GrouAI Studio · do poprawy"}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 max-w-xs space-y-1.5 rounded-lg border border-white/10 bg-[#0f0f1e] p-2.5 text-[11px] text-gray-400">
          <ul className="space-y-0.5">
            {pkg.checks.map((c) => (
              <li key={c.id} className={c.ok ? "text-emerald-300/90" : "text-amber-300/90"}>
                {c.ok ? "✓" : "✗"} {c.label} <span className="text-gray-500">— {c.detail}</span>
              </li>
            ))}
          </ul>
          {pkg.explicit && <p className="text-amber-300/90">Tekst zawiera wulgaryzmy — oznacz utwór jako „Explicit”.</p>}
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/40 px-2 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Pakiet dla dystrybutora (WAV, okładka, tekst)
          </button>
          <p className="pt-1 text-gray-600">
            Spotify nie przyjmuje plików bezpośrednio — wgraj pakiet u dystrybutora (DistroKid, Amuse, TuneCore)
            i zaznacz w formularzu, że przy tworzeniu użyto narzędzi AI.
          </p>
        </div>
      )}
    </div>
  );
}
