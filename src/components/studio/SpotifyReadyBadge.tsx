import { useState } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import type { SpotifyReadyCheck } from "@/lib/loudness";

/** Znaczek "gotowe na Spotify" — sprawdza parametry techniczne (głośność,
 *  piki, długość, próbkowanie) wg publicznych wytycznych Spotify. NIE wysyła
 *  nigdzie — to tylko kontrola jakości przed wgraniem przez dystrybutora
 *  (DistroKid, TuneCore itp.), bo Spotify nie przyjmuje plików bezpośrednio. */
export function SpotifyReadyBadge({ check }: { check: SpotifyReadyCheck }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
          check.ready
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
            : "border-amber-400/40 bg-amber-500/10 text-amber-300"
        }`}
      >
        {check.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {check.ready ? "Gotowe na Spotify" : "Wymaga poprawek przed Spotify"}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-white/10 bg-[#0f0f1e] p-2.5 text-[11px] text-gray-400 space-y-1 max-w-xs">
          <p className="text-gray-300">{check.lufs.toFixed(1)} LUFS · peak ~{check.truePeakDb.toFixed(1)} dBTP · {check.durationSec.toFixed(0)}s · {check.sampleRate} Hz</p>
          {check.issues.length > 0 ? (
            <ul className="list-disc list-inside space-y-0.5 text-amber-300/90">
              {check.issues.map((i, k) => <li key={k}>{i}</li>)}
            </ul>
          ) : (
            <p className="text-emerald-300/90">Parametry techniczne w normie Spotify.</p>
          )}
          <p className="text-gray-600 pt-1">Orientacyjna kontrola na podstawie publicznych wytycznych Spotify — nie wysyła nigdzie. Dystrybucję (DistroKid, TuneCore itp.) robisz sam, Spotify nie przyjmuje plików bezpośrednio od artystów.</p>
        </div>
      )}
    </div>
  );
}
