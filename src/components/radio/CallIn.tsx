// „Zadzwoń do radia”: słuchacz zgłasza się do kolejki, studio (admin) odbiera, głos idzie na żywo do wszystkich.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { callin, CALL_MAX_SEC, newCallId, readPresence } from "@/lib/radioCallin";
import { openCallerMic, startLiveSender } from "@/lib/radioLiveSend";
import { callerLabel, hostLang, type HostLang } from "@/lib/radioHost";

const T: Record<HostLang, Record<string, string>> = {
  pl: { call: "📞 Zadzwoń do radia", offline: "Studio jest teraz offline. Zadzwoń, gdy na antenie jest prowadzący.", login: "Zaloguj się, aby zadzwonić", name: "Imię (usłyszą je wszyscy)", city: "Miasto (opcjonalnie)", consent: "Wiem, że mój głos usłyszą na żywo wszyscy słuchacze. Najlepiej w słuchawkach.", go: "Dzwonię", cancel: "Anuluj", waiting: "Czekasz na połączenie ze studiem… Jesteś {n}. w kolejce.", rejected: "Studio nie może teraz odebrać. Spróbuj później!", onair: "🔴 Jesteś na antenie", hang: "Rozłącz", ended: "Dzięki za telefon!", mic: "Brak dostępu do mikrofonu. Zezwól na mikrofon w przeglądarce.", lost: "Połączenie z anteną przerwane." },
  en: { call: "📞 Call the radio", offline: "The studio is offline right now. Call when a host is on air.", login: "Log in to call", name: "Name (everyone will hear it)", city: "City (optional)", consent: "I know all listeners will hear my voice live. Headphones recommended.", go: "Call", cancel: "Cancel", waiting: "Waiting for the studio… You are no. {n} in the queue.", rejected: "The studio can't take your call right now. Try later!", onair: "🔴 You're on air", hang: "Hang up", ended: "Thanks for calling!", mic: "No microphone access. Allow the microphone in your browser.", lost: "Connection to the air was lost." },
  nl: { call: "📞 Bel de radio", offline: "De studio is nu offline. Bel als er een presentator in de lucht is.", login: "Log in om te bellen", name: "Naam (iedereen hoort hem)", city: "Plaats (optioneel)", consent: "Ik weet dat alle luisteraars mijn stem live horen. Liefst met koptelefoon.", go: "Bellen", cancel: "Annuleren", waiting: "Wachten op de studio… Je bent nr. {n} in de rij.", rejected: "De studio kan nu niet opnemen. Probeer het later!", onair: "🔴 Je bent live", hang: "Ophangen", ended: "Bedankt voor het bellen!", mic: "Geen toegang tot de microfoon. Sta de microfoon toe in je browser.", lost: "Verbinding met de uitzending verbroken." },
  ua: { call: "📞 Подзвонити на радіо", offline: "Студія зараз офлайн. Телефонуй, коли в ефірі ведучий.", login: "Увійди, щоб подзвонити", name: "Ім'я (почують усі)", city: "Місто (необов'язково)", consent: "Я знаю, що мій голос наживо почують усі слухачі. Краще в навушниках.", go: "Дзвоню", cancel: "Скасувати", waiting: "Чекаєш на студію… Ти {n}-й у черзі.", rejected: "Студія зараз не може відповісти. Спробуй пізніше!", onair: "🔴 Ти в ефірі", hang: "Завершити", ended: "Дякуємо за дзвінок!", mic: "Немає доступу до мікрофона. Дозволь мікрофон у браузері.", lost: "З'єднання з ефіром перервано." },
};

type Phase = "idle" | "form" | "waiting" | "onair" | "done";

export function CallIn({ language, sourceId }: { language: string; sourceId: string }) {
  const lang = hostLang(language);
  const t = T[lang];
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studioOnline, setStudioOnline] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [queuePos, setQueuePos] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState(() => (user?.user_metadata?.display_name as string) || (user?.user_metadata?.full_name as string) || "");
  const [city, setCity] = useState("");
  const [agree, setAgree] = useState(false);
  const [left, setLeft] = useState(CALL_MAX_SEC);
  const chRef = useRef<ReturnType<typeof callin> | null>(null);
  const callIdRef = useRef<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const endLocal = (msg: string | null) => {
    if (stopRef.current) window.dispatchEvent(new CustomEvent("grouai:callin-onair", { detail: false }));
    stopRef.current?.(); stopRef.current = null;
    chRef.current?.untrack().catch(() => {});
    callIdRef.current = null;
    setNote(msg);
    setPhase(msg ? "done" : "idle");
  };

  useEffect(() => {
    const ch = callin(sourceId);
    chRef.current = ch;
    const off = ch.listen(async (event, payload) => {
      if (event === "presence") {
        const { studioOnline: on, callers } = readPresence((payload.state ?? {}) as never);
        setStudioOnline(on);
        const i = callers.findIndex((c) => c.callId === callIdRef.current);
        if (i >= 0) setQueuePos(i + 1);
        return;
      }
      const mine = !!callIdRef.current && payload?.callId === callIdRef.current;
      if (event === "accept" && mine && phaseRef.current === "waiting") {
        try {
          const stream = await openCallerMic();
          setPhase("onair"); setLeft(CALL_MAX_SEC);
          window.dispatchEvent(new CustomEvent("grouai:callin-onair", { detail: true })); // ścisz muzykę u dzwoniącego (mniej echa)
          stopRef.current = startLiveSender(stream, sourceId, "caller", (ok) => { if (!ok && phaseRef.current === "onair") setNote(t.lost); });
        } catch {
          ch.send("end", { callId: callIdRef.current, by: "caller" });
          endLocal(t.mic);
        }
      } else if (event === "reject" && mine) endLocal(t.rejected);
      else if (event === "end" && mine && payload.by !== "caller") endLocal(t.ended);
    });
    return () => { off(); stopRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, lang]);

  // Limit czasu rozmowy na antenie.
  useEffect(() => {
    if (phase !== "onair") return;
    const id = window.setInterval(() => setLeft((s) => {
      if (s <= 1) { hangUp(); return 0; }
      return s - 1;
    }), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const dial = async () => {
    const n = callerLabel(name);
    if (!n || !agree || !chRef.current) return;
    const callId = newCallId();
    callIdRef.current = callId;
    setNote(null);
    setPhase("waiting");
    await chRef.current.track({ role: "caller", callId, name: n, city: callerLabel(city), lang, at: Date.now(), userId: user?.id ?? null });
  };

  function hangUp() {
    const id = callIdRef.current;
    if (id) chRef.current?.send("end", { callId: id, by: "caller" });
    endLocal(t.ended);
  }

  const box = "rounded-xl border border-white/15 bg-white/5 p-3 space-y-2 text-sm";
  const inp = "h-10 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm";

  if (phase === "onair") return (
    <div className={`${box} border-red-500/50 bg-red-500/10`}>
      <div className="flex items-center justify-between"><b className="text-red-400">{t.onair}</b><span className="tabular-nums text-xs text-foreground/70">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span></div>
      {note && <p className="text-xs text-amber-300">{note}</p>}
      <button type="button" onClick={hangUp} className="h-10 w-full rounded-lg bg-red-600 font-semibold text-white">{t.hang}</button>
    </div>
  );
  if (phase === "waiting") return (
    <div className={box}>
      <p className="animate-pulse">{t.waiting.replace("{n}", String(queuePos || 1))}</p>
      <button type="button" onClick={() => { chRef.current?.untrack().catch(() => {}); endLocal(null); }} className="h-9 w-full rounded-lg border border-white/20">{t.cancel}</button>
    </div>
  );
  if (phase === "form") return (
    <div className={box}>
      <input className={inp} placeholder={t.name} aria-label={t.name} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
      <input className={inp} placeholder={t.city} aria-label={t.city} value={city} maxLength={24} onChange={(e) => setCity(e.target.value)} />
      <label className="flex items-start gap-2 text-xs text-foreground/70"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />{t.consent}</label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setPhase("idle")} className="h-10 rounded-lg border border-white/20">{t.cancel}</button>
        <button type="button" disabled={!agree || !callerLabel(name)} onClick={dial} className="h-10 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">{t.go}</button>
      </div>
    </div>
  );
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => { if (!user) return navigate("/auth?next=/radio-live"); if (studioOnline) { setNote(null); setPhase("form"); } }}
        disabled={!!user && !studioOnline}
        className="h-10 w-full rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-sm font-semibold text-emerald-300 disabled:opacity-50"
      >
        {t.call}{studioOnline && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" />}
      </button>
      {!user ? <p className="text-[11px] text-foreground/50">{t.login}</p> : !studioOnline && <p className="text-[11px] text-foreground/50">{t.offline}</p>}
      {note && <p className="text-xs text-foreground/70">{note}</p>}
    </div>
  );
}

