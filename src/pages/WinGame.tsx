import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Ticket, Disc3, Sparkles, Gift, Truck, Loader2, Check } from "lucide-react";
import { fetchGameState, gameVote, gameClaim, type GameState } from "@/lib/hubGame";

const MEDIA = [
  { id: "vinyl", emoji: "🟠", name: "Winyl", desc: "Limitowany, numerowany — robi wrażenie." },
  { id: "cd", emoji: "⚪", name: "CD", desc: "Klasyk, tani i szybki." },
  { id: "nfc", emoji: "🔵", name: "Karta NFC", desc: "Przyłóż do telefonu — muzyka gra od razu." },
] as const;

function useCountdown(endsAt?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!endsAt) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms / 3600000) % 24),
    m: Math.floor((ms / 60000) % 60),
    s: Math.floor((ms / 1000) % 60),
    done: ms <= 0,
  };
}

export default function WinGame() {
  const { user } = useAuth();
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cd = useCountdown(state?.round?.ends_at);

  const load = useCallback(async () => { setState(await fetchGameState()); }, []);
  useEffect(() => { void load(); const i = setInterval(() => void load(), 15000); return () => clearInterval(i); }, [load]);

  const doVote = async (kind: "daily" | "vote") => {
    if (!user) { toast.error("Zaloguj się, aby grać i zbierać losy"); return; }
    setBusy(kind);
    try {
      const r = await gameVote(kind);
      if (r?.error) throw new Error(r.error);
      if (r?.reason === "already_claimed") toast.info("Dzisiejsze losy już odebrane — wróć jutro 🙌");
      else if (r?.reason === "daily_cap") toast.info("Dzienny limit z tego źródła osiągnięty — spróbuj innego 😉");
      else if (r?.added) toast.success(`+${r.added} losów! Masz teraz ${r.tickets}.`);
      await load();
    } catch (e: any) { toast.error(e?.message || "Nie udało się"); }
    finally { setBusy(null); }
  };

  const me = state?.me;
  const round = state?.round;

  return (
    <MainLayout>
      <style>{`@keyframes gv-spin{to{transform:rotate(360deg)}} .gv-disc{animation:gv-spin 6s linear infinite}
        @media (prefers-reduced-motion:reduce){.gv-disc{animation:none}}`}</style>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-14">

        {/* HERO */}
        <section className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#FFB020]">Konkurs miesiąca · nagroda fizyczna</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl font-extrabold leading-tight">
              Dawaj swoją muzykę.<br />
              <span className="bg-gradient-to-r from-[#FF7A1A] via-[#FFB020] to-[#B026FF] bg-clip-text text-transparent">Wygraj ją na płycie.</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-md">
              Słuchaj i głosuj — za aktywność dostajesz losy. Co miesiąc jedna osoba wygrywa i wybiera
              <b className="text-foreground"> 10 swoich utworów</b> na prawdziwym nośniku: winyl, CD albo karta NFC. Wysyłka gratis.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" className="gap-2 bg-gradient-to-br from-[#FF7A1A] to-[#FFB020] text-black font-bold"
                disabled={busy === "vote"} onClick={() => void doVote("vote")}>
                {busy === "vote" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Zagraj i zdobądź losy
              </Button>
              <Button size="lg" variant="outline" className="gap-2"
                disabled={busy === "daily"} onClick={() => void doVote("daily")}>
                <Gift className="h-4 w-4" /> Odbierz dzienne +10
              </Button>
            </div>
            {/* countdown */}
            <div className="mt-6 flex gap-2">
              {[["d", cd.d, "dni"], ["h", cd.h, "godz"], ["m", cd.m, "min"], ["s", cd.s, "sek"]].map(([k, v, l]) => (
                <div key={k as string} className="rounded-xl border border-border bg-card px-3.5 py-2 text-center min-w-[60px]">
                  <b className="block font-display text-2xl font-extrabold tabular-nums">{String(v).padStart(2, "0")}</b>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* spinning vinyl */}
          <div className="relative mx-auto w-full max-w-[360px] aspect-square grid place-items-center">
            <div className="gv-disc relative w-[82%] aspect-square rounded-full"
              style={{ background: "repeating-radial-gradient(circle at 50% 50%, #0d0d0f 0 2px, #17151b 2px 4px), radial-gradient(circle at 38% 34%, #2a2730, #050506 70%)", boxShadow: "0 30px 70px -20px #000, inset 0 0 60px #000" }}>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] aspect-square rounded-full grid place-items-center text-center"
                style={{ background: "radial-gradient(circle at 40% 35%, #FF7A1A, #B026FF)", boxShadow: "0 0 26px rgba(176,38,255,.5)" }}>
                <b className="font-display text-[11px] font-extrabold text-white leading-tight">WYGRAJ<br />SWOJĄ<br />PŁYTĘ</b>
              </div>
            </div>
            <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-extrabold text-black"
              style={{ background: "linear-gradient(135deg,#FF7A1A,#FFB020)" }}>🏆 1 zwycięzca · limitowany</div>
          </div>
        </section>

        {/* how it works */}
        <section>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#FFB020] mb-4">Jak grać</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { ic: "▶️", t: "Słuchaj i głosuj", p: "Odsłuchania, ♥ i głosy zamieniają się w losy." },
              { ic: "🎟️", t: "Zbieraj losy", p: "Więcej aktywności = większa szansa. Licznik rośnie na żywo." },
              { ic: "🏆", t: "Losowanie", p: "Co miesiąc losujemy zwycięzcę — ważone losami, każdy ma szansę." },
              { ic: "💿", t: "Wybierasz 10 i masz płytę", p: "Zwycięzca wybiera 10 utworów — tłoczymy i wysyłamy gratis." },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5">
                <div className="text-2xl">{s.ic}</div>
                <div className="mt-2 text-xs font-bold text-muted-foreground">KROK {i + 1}</div>
                <h3 className="mt-1 font-display font-bold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* leaderboard + my tickets */}
        <section className="grid lg:grid-cols-[1.3fr_.9fr] gap-5 items-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-extrabold tracking-widest text-[#ff5a4d] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#ff5a4d] animate-pulse" /> NA ŻYWO
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{state?.players ?? 0} graczy</span>
            </div>
            {(state?.leaderboard?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Czołówka jest jeszcze pusta — bądź pierwszy! Kliknij „Zagraj i zdobądź losy".</p>
            ) : state!.leaderboard.map((e) => {
              const max = state!.leaderboard[0]?.tickets || 1;
              return (
                <div key={e.rank} className="grid grid-cols-[26px_1fr_auto] gap-3 items-center py-2.5 border-t border-border first:border-0">
                  <div className={`font-display font-extrabold ${e.rank === 1 ? "text-[#FFB020]" : "text-muted-foreground"}`}>{e.rank}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{e.name}</div>
                    <div className="h-1.5 rounded bg-white/10 mt-1 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#FF7A1A] to-[#B026FF]" style={{ width: `${Math.max(6, (e.tickets / max) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="font-display font-extrabold text-sm tabular-nums">{e.tickets.toLocaleString("pl-PL")} <span className="text-[11px] text-muted-foreground font-semibold">losów</span></div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="rounded-xl border border-border bg-gradient-to-br from-[#1e1229] to-[#160d20] p-4 text-center mb-4">
              <span className="text-xs text-muted-foreground">Twoje losy w tej rundzie</span>
              <b className="block font-display text-3xl font-extrabold tabular-nums">{me?.tickets?.toLocaleString("pl-PL") ?? "0"}</b>
              <span className="text-xs text-muted-foreground">{me ? `miejsce #${me.rank} z ${state?.players ?? 0}` : "zaloguj się, aby grać"}</span>
            </div>
            <p className="text-xs font-bold tracking-widest uppercase text-[#FFB020] mb-2">Zdobądź więcej</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex justify-between"><span>Odsłuchaj utwór do końca</span><span className="font-display font-extrabold text-[#38E8A0]">+1</span></li>
              <li className="flex justify-between"><span>Polub (♥) utwór</span><span className="font-display font-extrabold text-[#38E8A0]">+2</span></li>
              <li className="flex justify-between"><span>Zagłosuj „na winyl"</span><span className="font-display font-extrabold text-[#38E8A0]">+5</span></li>
              <li className="flex justify-between"><span>Codzienne wejście</span><span className="font-display font-extrabold text-[#38E8A0]">+10</span></li>
            </ul>
            <Button className="w-full mt-4 gap-2" disabled={busy === "daily"} onClick={() => void doVote("daily")}>
              {busy === "daily" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Odbierz dzisiejsze losy
            </Button>
          </div>
        </section>

        {/* prize */}
        <section>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#FFB020] mb-1">Nagroda</p>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold">Twoja muzyka. Twój nośnik.</h2>
          <p className="text-muted-foreground mt-2 mb-5">Zwycięzca wybiera 10 utworów i format — do każdego dorzucamy cyfrowy master Hi-Res.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {MEDIA.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border p-5" style={{ background: "linear-gradient(180deg,#1a0f27,#120b1b)" }}>
                <div className="text-2xl">{m.emoji}</div>
                <h3 className="mt-2 font-display font-bold">{m.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* winner panel */}
        {me?.is_winner && <WinnerClaim onDone={load} />}

        {/* footer cta */}
        <section className="rounded-2xl border border-border p-6 text-center" style={{ background: "linear-gradient(100deg,#26130a,#1a0f27)" }}>
          <Disc3 className="h-8 w-8 mx-auto text-[#FFB020]" />
          <h2 className="mt-2 font-display text-xl font-extrabold">Twoja muzyka może wygrać.</h2>
          <p className="text-muted-foreground text-sm mt-1">Wgraj utwory w Studiu, graj codziennie i zapraszaj znajomych.</p>
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            <Button asChild><Link to="/studio">🎧 Stwórz utwór</Link></Button>
            <Button variant="outline" asChild><a href="https://grouaistream.com" target="_blank" rel="noreferrer">grouaistream.com</a></Button>
          </div>
        </section>

      </div>
    </MainLayout>
  );
}

// ── Panel zwycięzcy: wybór 10 utworów + nośnik + adres ──
function WinnerClaim({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<{ id: string; title: string }[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [medium, setMedium] = useState<"vinyl" | "cd" | "nfc">("vinyl");
  const [name, setName] = useState("");
  const [addr, setAddr] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("generations").select("id, title").eq("user_id", user.id)
      .not("audio_url", "is", null).order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setTracks((data as any) || []));
  }, [user]);

  const chosen = useMemo(() => tracks.filter((t) => picked[t.id]), [tracks, picked]);
  const toggle = (id: string) => setPicked((p) => {
    const n = { ...p }; if (n[id]) delete n[id];
    else { if (Object.keys(p).filter((k) => p[k]).length >= 10) { toast.info("Maks. 10 utworów"); return p; } n[id] = true; }
    return n;
  });

  const submit = async () => {
    if (chosen.length === 0) { toast.error("Wybierz przynajmniej 1 utwór"); return; }
    if (!name.trim() || !addr.trim()) { toast.error("Podaj imię i adres wysyłki"); return; }
    setSaving(true);
    try {
      const r = await gameClaim({ tracks: chosen, medium, ship_name: name, ship_address: addr, ship_email: email });
      if (r?.error) throw new Error(r.error);
      setDone(true); toast.success("🏆 Zgłoszone! Zajmiemy się Twoją płytą."); onDone();
    } catch (e: any) { toast.error(e?.message || "Nie udało się zgłosić"); }
    finally { setSaving(false); }
  };

  if (done) return (
    <section className="rounded-2xl border border-[#38E8A0]/40 bg-[#38E8A0]/5 p-6 text-center">
      <Check className="h-8 w-8 mx-auto text-[#38E8A0]" />
      <h2 className="mt-2 font-display text-xl font-extrabold">Gratulacje — nagroda w drodze!</h2>
      <p className="text-muted-foreground text-sm mt-1">Zamawiamy Twoją płytę ({medium.toUpperCase()}) z wybranymi utworami i wyślemy ją na podany adres.</p>
    </section>
  );

  return (
    <section className="rounded-2xl border-2 p-6" style={{ borderImage: "linear-gradient(135deg,#FF7A1A,#B026FF) 1" }}>
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-[#FFB020]" />
        <h2 className="font-display text-2xl font-extrabold">Wygrałeś! Ułóż swoją płytę 🎉</h2>
      </div>
      <p className="text-muted-foreground text-sm mt-1">Wybierz do 10 utworów, nośnik i podaj adres — resztę robimy my.</p>

      <div className="mt-5">
        <p className="text-sm font-bold mb-2">1. Wybierz utwory ({chosen.length}/10)</p>
        <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {tracks.length === 0 && <p className="text-sm text-muted-foreground">Brak utworów z audio w Twoim Studiu.</p>}
          {tracks.map((t) => (
            <button key={t.id} onClick={() => toggle(t.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${picked[t.id] ? "border-[#FF7A1A] bg-[#FF7A1A]/10" : "border-border hover:border-[#FF7A1A]/50"}`}>
              <span className={`h-4 w-4 rounded flex-none grid place-items-center ${picked[t.id] ? "bg-[#FF7A1A] text-black" : "border border-border"}`}>{picked[t.id] && <Check className="h-3 w-3" />}</span>
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold mb-2">2. Nośnik</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {MEDIA.map((m) => (
            <button key={m.id} onClick={() => setMedium(m.id as any)}
              className={`rounded-xl border p-3 text-left transition ${medium === m.id ? "border-[#FF7A1A] bg-[#FF7A1A]/10" : "border-border hover:border-[#FF7A1A]/50"}`}>
              <div className="text-xl">{m.emoji}</div>
              <div className="font-display font-bold text-sm mt-1">{m.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <div><p className="text-sm font-bold mb-2">3. Adres wysyłki</p>
          <Input placeholder="Imię i nazwisko" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="sm:pt-7"><Input placeholder="E-mail do kontaktu" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="sm:col-span-2"><Input placeholder="Ulica, kod, miasto, kraj" value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
      </div>

      <Button className="mt-5 w-full gap-2 bg-gradient-to-br from-[#FF7A1A] to-[#FFB020] text-black font-bold" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Zgłoś moją płytę
      </Button>
    </section>
  );
}
