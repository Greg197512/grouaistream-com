import { useEffect, useMemo, useState } from "react";
import { buildDailyRadio, type DailyRadio } from "@/lib/radioDaily";
import { BLOCKS, type BlockId } from "@/lib/radioClock";

const hhmm = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;

/** Podgląd dzisiejszej ramówki autopilota: bloki, liczba utworów, okno bez powtórek. */
export function RadioAutopilotPreview() {
  const [plan, setPlan] = useState<DailyRadio | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { buildDailyRadio("public").then(setPlan).catch(() => setErr(true)); }, []);

  const segments = useMemo(() => {
    if (!plan?.blocks || !plan.starts) return [];
    const out: { block: BlockId; from: number; count: number; sample: string[] }[] = [];
    plan.blocks.forEach((b, i) => {
      const last = out[out.length - 1];
      const t = plan.tracks[i];
      if (last && last.block === b) { last.count++; if (last.sample.length < 3) last.sample.push(`${t.artist} – ${t.title}`); }
      else out.push({ block: b, from: plan.starts![i], count: 1, sample: [`${t.artist} – ${t.title}`] });
    });
    return out;
  }, [plan]);

  if (err) return <p className="text-xs text-destructive">Nie udało się zbudować podglądu ramówki.</p>;
  if (!plan) return <p className="text-xs text-muted-foreground">Układam dzisiejszą ramówkę…</p>;
  const nowSec = (Date.now() - new Date(plan.startedAtISO).getTime()) / 1000;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/60 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <b>Autopilot: ramówka na {plan.dayKey}</b>
        <span className="text-xs text-muted-foreground">
          {plan.tracks.length} utworów · bez powtórek przez {Math.round((plan.windowSec ?? 0) / 360) / 10} h · odrzucone przez bramkę jakości: {plan.rejected ?? 0}
        </span>
      </div>
      <ol className="space-y-1">
        {segments.map((s, i) => {
          const next = segments[i + 1]?.from ?? 86400;
          const live = nowSec >= s.from && nowSec < next;
          return (
            <li key={i} className={`rounded-lg px-2 py-1 ${live ? "bg-primary/15 ring-1 ring-primary/40" : ""}`}>
              <span className="tabular-nums text-muted-foreground">{hhmm(s.from)}–{hhmm(Math.min(next, 86400))}</span>{" "}
              <b>{BLOCKS[s.block].label}</b> <span className="text-muted-foreground">({s.count})</span>{live && <span className="ml-1 text-primary">● na antenie</span>}
              <div className="truncate text-xs text-muted-foreground">{s.sample.join(" · ")}</div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">Zasady w src/lib/radioClock.ts: noc chill, poranek pop, dzień mix, popołudnie electronic, wieczór hip-hop; od piątku 18:00 do niedzieli 6:00 bloki Disco/Electronic/Hip-Hop; niedziela spokój. Bramka: audio, 45 s–15 min, bez martwych plików i audycji.</p>
    </div>
  );
}
