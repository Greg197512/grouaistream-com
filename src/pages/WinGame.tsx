import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Ticket, Disc3, Gift, Truck, Loader2, Check, Users } from "lucide-react";
import { fetchGameState, gameVote, gameClaim, gameRefer, type GameState } from "@/lib/hubGame";
import { gt } from "@/lib/gameI18n";

const MEDIA = [
  { id: "vinyl", emoji: "🟠", nameKey: "m.vinyl", descKey: "m.vinylD" },
  { id: "cd", emoji: "⚪", nameKey: "m.cd", descKey: "m.cdD" },
  { id: "card", emoji: "💳", nameKey: "m.card", descKey: "m.cardD" },
] as const;

function useCountdown(endsAt?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!endsAt) return { d: 0, h: 0, m: 0, s: 0 };
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms / 3600000) % 24), m: Math.floor((ms / 60000) % 60), s: Math.floor((ms / 1000) % 60) };
}

export default function WinGame() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const L = (k: string, v?: Record<string, string | number>) => gt(language, k, v);
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cd = useCountdown(state?.round?.ends_at);

  const load = useCallback(async () => { setState(await fetchGameState()); }, []);
  useEffect(() => { void load(); const i = setInterval(() => void load(), 15000); return () => clearInterval(i); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref || ref === user.id) return;
    const key = `gv-ref-done-${ref}`;
    if (localStorage.getItem(key)) return;
    void gameRefer(ref).then((r) => { if (r?.ok) localStorage.setItem(key, "1"); });
  }, [user]);

  const inviteLink = user ? `https://grouaistream.com/wygraj?ref=${user.id}` : "https://grouaistream.com/wygraj";
  const invite = async () => {
    if (!user) { toast.error(L("toast.inviteLogin")); return; }
    try {
      if (navigator.share) await navigator.share({ title: L("badge.l2"), text: L("invite.text"), url: inviteLink });
      else { await navigator.clipboard.writeText(inviteLink); toast.success(L("toast.copied")); }
    } catch { /* anulowano */ }
  };

  const doVote = async (kind: "daily" | "vote") => {
    if (!user) { toast.error(L("toast.login")); return; }
    setBusy(kind);
    try {
      const r = await gameVote(kind);
      if (r?.error) throw new Error(r.error);
      if (r?.reason === "already_claimed") toast.info(L("toast.dailyDone"));
      else if (r?.reason === "daily_cap") toast.info(L("toast.cap"));
      else if (r?.added) toast.success(L("toast.added", { a: r.added, n: r.tickets }));
      await load();
    } catch (e: any) { toast.error(e?.message || "Error"); }
    finally { setBusy(null); }
  };

  const me = state?.me;

  return (
    <MainLayout>
      <style>{`@keyframes gv-spin{to{transform:rotate(360deg)}} .gv-disc{animation:gv-spin 6s linear infinite}
        @media (prefers-reduced-motion:reduce){.gv-disc{animation:none}}`}</style>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-14">

        {/* HERO */}
        <section className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#FFB020]">{L("hero.eyebrow")}</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl font-extrabold leading-tight">
              {L("hero.h1a")}<br />
              <span className="bg-gradient-to-r from-[#FF7A1A] via-[#FFB020] to-[#B026FF] bg-clip-text text-transparent">{L("hero.h1b")}</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-md">{L("hero.lede")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" className="gap-2 bg-gradient-to-br from-[#FF7A1A] to-[#FFB020] text-black font-bold"
                disabled={busy === "vote"} onClick={() => void doVote("vote")}>
                {busy === "vote" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} {L("hero.play")}
              </Button>
              <Button size="lg" variant="outline" className="gap-2" disabled={busy === "daily"} onClick={() => void doVote("daily")}>
                <Gift className="h-4 w-4" /> {L("hero.daily")}
              </Button>
            </div>
            <div className="mt-6 flex gap-2">
              {([["d", cd.d, "cd.d"], ["h", cd.h, "cd.h"], ["m", cd.m, "cd.m"], ["s", cd.s, "cd.s"]] as const).map(([k, v, lk]) => (
                <div key={k} className="rounded-xl border border-border bg-card px-3.5 py-2 text-center min-w-[60px]">
                  <b className="block font-display text-2xl font-extrabold tabular-nums">{String(v).padStart(2, "0")}</b>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{L(lk)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* realistyczna, obracająca się płyta CD */}
          <div className="relative mx-auto w-full max-w-[360px] aspect-square grid place-items-center">
            <div className="relative w-[84%] aspect-square rounded-full overflow-hidden" style={{ boxShadow: "0 30px 70px -18px #000, 0 0 46px rgba(176,38,255,.28)" }}>
              <div className="gv-disc absolute inset-0 rounded-full" style={{
                background: [
                  "radial-gradient(circle at 50% 50%, hsl(var(--background)) 0 6.5%, transparent 7%)",
                  "radial-gradient(circle at 50% 50%, #e6e9ef 7% 10.5%, #9aa0ab 10.5% 12%, transparent 12.3%)",
                  "radial-gradient(circle at 50% 50%, transparent 12.3% 19.5%, rgba(0,0,0,.28) 19.8% 20.6%, transparent 21%)",
                  "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,.07) 1px 2.6px)",
                  "conic-gradient(from 0deg, #ff5db1, #ffd24d, #7dff9e, #5de1ff, #a98bff, #ff7ad9, #ffd24d, #ff5db1)",
                ].join(","),
              }} />
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                background: ["radial-gradient(circle at 32% 26%, rgba(255,255,255,.22), transparent 42%)", "linear-gradient(115deg, transparent 37%, rgba(255,255,255,.30) 47%, rgba(255,255,255,.06) 51%, transparent 60%)"].join(","),
              }} />
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: "inset 0 0 22px rgba(0,0,0,.55)" }} />
            </div>
            <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-extrabold text-black" style={{ background: "linear-gradient(135deg,#FF7A1A,#FFB020)" }}>{L("ribbon")}</div>
          </div>
        </section>

        {/* how */}
        <section>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#FFB020] mb-1">{L("how.title")}</p>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-4">{L("how.sub")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[["▶️", "how.1t", "how.1p"], ["🎟️", "how.2t", "how.2p"], ["🏆", "how.3t", "how.3p"], ["💿", "how.4t", "how.4p"]].map(([ic, tk, pk], i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5">
                <div className="text-2xl">{ic}</div>
                <div className="mt-2 text-xs font-bold text-muted-foreground">{L("how.step")} {i + 1}</div>
                <h3 className="mt-1 font-display font-bold">{L(tk)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{L(pk)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* leaderboard + my tickets */}
        <section className="grid lg:grid-cols-[1.3fr_.9fr] gap-5 items-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-extrabold tracking-widest text-[#ff5a4d] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#ff5a4d] animate-pulse" /> {L("lb.live")}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{L("lb.players", { n: state?.players ?? 0 })}</span>
            </div>
            {(state?.leaderboard?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{L("lb.empty")}</p>
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
                  <div className="font-display font-extrabold text-sm tabular-nums">{e.tickets.toLocaleString()} <span className="text-[11px] text-muted-foreground font-semibold">{L("lb.tickets")}</span></div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="rounded-xl border border-border bg-gradient-to-br from-[#1e1229] to-[#160d20] p-4 text-center mb-4">
              <span className="text-xs text-muted-foreground">{L("my.title")}</span>
              <b className="block font-display text-3xl font-extrabold tabular-nums">{me?.tickets?.toLocaleString() ?? "0"}</b>
              <span className="text-xs text-muted-foreground">{me ? L("my.place", { r: me.rank, n: state?.players ?? 0 }) : L("my.login")}</span>
            </div>
            <p className="text-xs font-bold tracking-widest uppercase text-[#FFB020] mb-2">{L("earn.title")}</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex justify-between"><span>{L("earn.listen")}</span><span className="font-display font-extrabold text-[#38E8A0]">+1</span></li>
              <li className="flex justify-between"><span>{L("earn.like")}</span><span className="font-display font-extrabold text-[#38E8A0]">+2</span></li>
              <li className="flex justify-between"><span>{L("earn.vote")}</span><span className="font-display font-extrabold text-[#38E8A0]">+5</span></li>
              <li className="flex justify-between"><span>{L("earn.daily")}</span><span className="font-display font-extrabold text-[#38E8A0]">+10</span></li>
              <li className="flex justify-between"><span>{L("earn.invite")}</span><span className="font-display font-extrabold text-[#38E8A0]">+50</span></li>
            </ul>
            <Button className="w-full mt-4 gap-2" disabled={busy === "daily"} onClick={() => void doVote("daily")}>
              {busy === "daily" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} {L("earn.claimBtn")}
            </Button>
            <Button variant="outline" className="w-full mt-2 gap-2" onClick={() => void invite()}>
              <Users className="h-4 w-4" /> {L("earn.inviteBtn")} <span className="text-[#38E8A0] font-bold">+50</span>
            </Button>
          </div>
        </section>

        {/* prize */}
        <section>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#FFB020] mb-1">{L("prize.eyebrow")}</p>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold">{L("prize.title")}</h2>
          <p className="text-muted-foreground mt-2 mb-5">{L("prize.sub")}</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {MEDIA.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border p-5" style={{ background: "linear-gradient(180deg,#1a0f27,#120b1b)" }}>
                <div className="text-2xl">{m.emoji}</div>
                <h3 className="mt-2 font-display font-bold">{L(m.nameKey)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{L(m.descKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {me?.is_winner && <WinnerClaim onDone={load} L={L} />}

        <section className="rounded-2xl border border-border p-6 text-center" style={{ background: "linear-gradient(100deg,#26130a,#1a0f27)" }}>
          <Disc3 className="h-8 w-8 mx-auto text-[#FFB020]" />
          <h2 className="mt-2 font-display text-xl font-extrabold">{L("cta.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{L("cta.sub")}</p>
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            <Button asChild><Link to="/studio">{L("cta.studio")}</Link></Button>
            <Button variant="outline" asChild><a href="https://grouaistream.com" target="_blank" rel="noreferrer">grouaistream.com</a></Button>
          </div>
        </section>

      </div>
    </MainLayout>
  );
}

function WinnerClaim({ onDone, L }: { onDone: () => void; L: (k: string, v?: Record<string, string | number>) => string }) {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<{ id: string; title: string }[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [medium, setMedium] = useState<"vinyl" | "cd" | "card">("vinyl");
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
    else { if (Object.keys(p).filter((k) => p[k]).length >= 10) { toast.info(L("toast.max10")); return p; } n[id] = true; }
    return n;
  });

  const submit = async () => {
    if (chosen.length === 0) { toast.error(L("toast.pickTrack")); return; }
    if (!name.trim() || !addr.trim()) { toast.error(L("toast.addr")); return; }
    setSaving(true);
    try {
      const r = await gameClaim({ tracks: chosen, medium, ship_name: name, ship_address: addr, ship_email: email });
      if (r?.error) throw new Error(r.error);
      setDone(true); toast.success(L("toast.claimed")); onDone();
    } catch (e: any) { toast.error(e?.message || "Error"); }
    finally { setSaving(false); }
  };

  if (done) return (
    <section className="rounded-2xl border border-[#38E8A0]/40 bg-[#38E8A0]/5 p-6 text-center">
      <Check className="h-8 w-8 mx-auto text-[#38E8A0]" />
      <h2 className="mt-2 font-display text-xl font-extrabold">{L("win.doneTitle")}</h2>
      <p className="text-muted-foreground text-sm mt-1">{L("win.doneSub", { m: medium.toUpperCase() })}</p>
    </section>
  );

  return (
    <section className="rounded-2xl border-2 p-6" style={{ borderImage: "linear-gradient(135deg,#FF7A1A,#B026FF) 1" }}>
      <div className="flex items-center gap-2"><Trophy className="h-6 w-6 text-[#FFB020]" /><h2 className="font-display text-2xl font-extrabold">{L("win.title")}</h2></div>
      <p className="text-muted-foreground text-sm mt-1">{L("win.sub")}</p>

      <div className="mt-5">
        <p className="text-sm font-bold mb-2">{L("win.step1", { n: chosen.length })}</p>
        <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {tracks.length === 0 && <p className="text-sm text-muted-foreground">{L("win.noTracks")}</p>}
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
        <p className="text-sm font-bold mb-2">{L("win.step2")}</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {MEDIA.map((m) => (
            <button key={m.id} onClick={() => setMedium(m.id as any)}
              className={`rounded-xl border p-3 text-left transition ${medium === m.id ? "border-[#FF7A1A] bg-[#FF7A1A]/10" : "border-border hover:border-[#FF7A1A]/50"}`}>
              <div className="text-xl">{m.emoji}</div>
              <div className="font-display font-bold text-sm mt-1">{L(m.nameKey)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <div><p className="text-sm font-bold mb-2">{L("win.step3")}</p><Input placeholder={L("win.name")} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="sm:pt-7"><Input placeholder={L("win.email")} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="sm:col-span-2"><Input placeholder={L("win.addr")} value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
      </div>

      <Button className="mt-5 w-full gap-2 bg-gradient-to-br from-[#FF7A1A] to-[#FFB020] text-black font-bold" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} {L("win.submit")}
      </Button>
    </section>
  );
}
