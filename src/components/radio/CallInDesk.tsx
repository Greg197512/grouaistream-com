// Studio (admin): kolejka telefonów od słuchaczy — odbierz (głos na żywo do wszystkich), odrzuć, rozłącz.
import { useEffect, useRef, useState } from "react";
import { callin, CALL_MAX_SEC, readPresence, type CallerInfo, type CallinEvent } from "@/lib/radioCallin";

export function CallInDesk({ sourceId }: { sourceId: string }) {
  const [callers, setCallers] = useState<CallerInfo[]>([]);
  const [onAir, setOnAir] = useState<CallerInfo | null>(null);
  const [since, setSince] = useState(0);
  const [, tick] = useState(0);
  const chRef = useRef<ReturnType<typeof callin> | null>(null);
  const onAirRef = useRef<CallerInfo | null>(null);
  onAirRef.current = onAir;

  useEffect(() => {
    const ch = callin(sourceId);
    chRef.current = ch;
    ch.track({ role: "studio", at: Date.now() }).catch(() => {});
    const off = ch.listen((event, payload) => {
      if (event === "presence") {
        const { callers: list } = readPresence((payload.state ?? {}) as never);
        setCallers(list);
        // Dzwoniący zniknął (zamknął stronę) w trakcie rozmowy → zakończ dla wszystkich.
        const cur = onAirRef.current;
        if (cur && !list.some((c) => c.callId === cur.callId)) finish(cur);
      } else if (event === "end") {
        const cur = onAirRef.current;
        if (cur && payload?.callId === cur.callId && payload.by === "caller") finish(cur, false);
      }
    });
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => { off(); window.clearInterval(id); ch.untrack().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const send = (event: CallinEvent, payload: Record<string, unknown>) => chRef.current?.send(event, payload);

  const accept = (c: CallerInfo) => {
    if (onAirRef.current) finish(onAirRef.current);
    setOnAir(c); setSince(Date.now());
    send("onair", { callId: c.callId, name: c.name, city: c.city });
    window.setTimeout(() => send("accept", { callId: c.callId }), 4500); // najpierw zapowiedź Novy, potem mikrofon
  };
  function finish(c: CallerInfo, notifyCaller = true) {
    if (notifyCaller) send("end", { callId: c.callId, by: "studio" });
    send("offair", { callId: c.callId, name: c.name });
    setOnAir(null);
  }

  const waiting = callers.filter((c) => c.callId !== onAir?.callId);
  const secs = onAir ? Math.floor((Date.now() - since) / 1000) : 0;
  return (
    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <b>📞 Telefony od słuchaczy</b>
        <span className="text-xs text-foreground/60">kolejka: {waiting.length}</span>
      </div>
      {onAir && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-red-500/15 p-2">
          <span><b className="text-red-400">🔴 Na antenie:</b> {onAir.name}{onAir.city ? `, ${onAir.city}` : ""} <span className="tabular-nums text-xs text-foreground/60">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} / {CALL_MAX_SEC / 60}:00</span></span>
          <button type="button" onClick={() => finish(onAir)} className="h-8 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white">Rozłącz</button>
        </div>
      )}
      {waiting.length === 0 && !onAir && <p className="text-xs text-foreground/60">Nikt nie dzwoni. Słuchacze widzą, że studio jest online.</p>}
      <ul className="space-y-1">
        {waiting.map((c) => (
          <li key={c.callId} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2">
            <span>{c.name}{c.city ? `, ${c.city}` : ""} <span className="text-xs uppercase text-foreground/50">{c.lang}</span></span>
            <span className="flex gap-1">
              <button type="button" onClick={() => accept(c)} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">Odbierz</button>
              <button type="button" onClick={() => send("reject", { callId: c.callId })} className="h-8 rounded-lg border border-white/20 px-3 text-xs">Odrzuć</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-foreground/50">Rozmawiasz z dzwoniącym przez „Live Mic Booth” — Twój głos też idzie na antenę. Limit rozmowy: {CALL_MAX_SEC / 60} min.</p>
    </div>
  );
}
