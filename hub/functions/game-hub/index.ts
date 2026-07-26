// GROUAI HUB — game-hub
// Gra „Wygraj swoją płytę": losy za aktywność, żywa czołówka, wyłanianie
// zwycięzcy (losowanie ważone), panel wyboru 10 utworów + nośnika.
// Auth użytkownika: JWT z LIVE (bvstv). Draw: x-hub-token (cron).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-token",
};
const BVSTV_URL = "https://bvstvawnigyczvofzhps.supabase.co";
const BVSTV_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function hubToken(): Promise<string> {
  const { data } = await admin().from("hub_config").select("value").eq("key", "hub_token").maybeSingle();
  return (data?.value as string) || "";
}
async function cfgVal(key: string): Promise<string> {
  const { data } = await admin().from("hub_config").select("value").eq("key", key).maybeSingle();
  return (data?.value as string) || "";
}

// Punkty i dzienne limity dla akcji (anty-spam).
const RULES: Record<string, { pts: number; cap: number }> = {
  listen: { pts: 1, cap: 30 },
  like:   { pts: 2, cap: 20 },
  vote:   { pts: 5, cap: 12 },
};

async function getUserId(auth: string): Promise<{ id: string; email: string; name: string } | null> {
  if (!auth) return null;
  const live = createClient(BVSTV_URL, BVSTV_ANON, { global: { headers: { Authorization: auth } } });
  const { data } = await live.auth.getUser();
  const u = data?.user;
  if (!u) return null;
  return { id: u.id, email: u.email || "", name: (u.user_metadata?.display_name as string) || (u.email?.split("@")[0] ?? "Gracz") };
}

async function activeRound(db: ReturnType<typeof admin>) {
  const { data } = await db.from("game_rounds").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const db = admin();
  const url = new URL(req.url);
  let body: Record<string, any> = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* */ } }
  const action = body.action || url.searchParams.get("action") || "state";

  try {
    // ── DRAW (cron): zamknij zakończone rundy, wylosuj zwycięzcę, otwórz nową ──
    if (action === "draw") {
      const token = req.headers.get("x-hub-token") || url.searchParams.get("t") || "";
      if (!token || token !== (await hubToken())) return json({ error: "unauthorized" }, 401);

      const { data: due } = await db.from("game_rounds").select("*").eq("status", "active").lt("ends_at", new Date().toISOString());
      const results: any[] = [];
      for (const r of due || []) {
        const { data: entries } = await db.from("game_entries").select("user_id, email, display_name, tickets").eq("round_id", r.id).gt("tickets", 0);
        let winner: any = null;
        if (entries && entries.length) {
          const total = entries.reduce((s, e) => s + e.tickets, 0);
          let pick = Math.random() * total;                 // losowanie ważone losami
          for (const e of entries) { pick -= e.tickets; if (pick <= 0) { winner = e; break; } }
          if (!winner) winner = entries[entries.length - 1];
        }
        await db.from("game_rounds").update({
          status: "closed",
          winner_user_id: winner?.user_id ?? null,
          winner_email: winner?.email ?? null,
          winner_name: winner?.display_name ?? null,
        }).eq("id", r.id);
        results.push({ round: r.id, winner: winner?.display_name ?? null });
      }
      // Zawsze utrzymuj jedną aktywną rundę (koniec bieżącego miesiąca).
      const cur = await activeRound(db);
      if (!cur) {
        await db.from("game_rounds").insert({
          ends_at: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString(),
        });
      }
      return json({ ok: true, closed: results });
    }

    const round = await activeRound(db);
    if (!round) return json({ ok: true, round: null, leaderboard: [], me: null });

    const auth = req.headers.get("Authorization") ?? "";

    // ── STATE: runda + czołówka + moje losy ──
    if (action === "state") {
      const [{ data: top }, { count: players }] = await Promise.all([
        db.from("game_entries").select("user_id, display_name, tickets").eq("round_id", round.id).order("tickets", { ascending: false }).limit(10),
        db.from("game_entries").select("*", { count: "exact", head: true }).eq("round_id", round.id),
      ]);
      let me: any = null;
      const u = await getUserId(auth);
      if (u) {
        const { data: mine } = await db.from("game_entries").select("tickets").eq("round_id", round.id).eq("user_id", u.id).maybeSingle();
        const tickets = mine?.tickets ?? 0;
        const { count: better } = await db.from("game_entries").select("*", { count: "exact", head: true }).eq("round_id", round.id).gt("tickets", tickets);
        me = { tickets, rank: (better ?? 0) + 1, is_winner: round.winner_user_id === u.id };
      }
      return json({
        ok: true,
        round: { id: round.id, title: round.title, ends_at: round.ends_at, status: round.status },
        players: players ?? 0,
        leaderboard: (top || []).map((e, i) => ({ rank: i + 1, name: e.display_name || "Gracz", tickets: e.tickets })),
        me,
      });
    }

    // ── VOTE: dolicz losy za akcję (z dziennym limitem) ──
    if (action === "vote") {
      const u = await getUserId(auth);
      if (!u) return json({ error: "Zaloguj się, aby grać" }, 401);
      const kind = String(body.kind || "");
      const today = new Date().toISOString().slice(0, 10);

      const { data: e } = await db.from("game_entries").select("*").eq("round_id", round.id).eq("user_id", u.id).maybeSingle();
      const entry = e || { tickets: 0, day_counts: {}, last_daily: null };
      let add = 0;
      const dc: Record<string, any> = (entry.day_counts?.date === today) ? entry.day_counts : { date: today };

      if (kind === "daily") {
        if (entry.last_daily === today) return json({ ok: true, added: 0, tickets: entry.tickets, reason: "already_claimed" });
        add = 10;
      } else if (RULES[kind]) {
        const used = dc[kind] || 0;
        if (used >= RULES[kind].cap) return json({ ok: true, added: 0, tickets: entry.tickets, reason: "daily_cap" });
        add = RULES[kind].pts; dc[kind] = used + 1;
      } else {
        return json({ error: "unknown_kind" }, 400);
      }

      const newTickets = (entry.tickets || 0) + add;
      await db.from("game_entries").upsert({
        round_id: round.id, user_id: u.id, email: u.email, display_name: u.name,
        tickets: newTickets, day_counts: dc,
        last_daily: kind === "daily" ? today : entry.last_daily,
        updated_at: new Date().toISOString(),
      }, { onConflict: "round_id,user_id" });

      return json({ ok: true, added: add, tickets: newTickets });
    }

    // ── REFER: zaproszony rejestruje polecenie → +50 losów dla zapraszającego ──
    if (action === "refer") {
      const u = await getUserId(auth);
      if (!u) return json({ error: "unauthorized" }, 401);
      const ref = String(body.ref || "").trim();
      if (!ref || ref === u.id) return json({ ok: true, awarded: 0, reason: "self_or_empty" });
      // Zapisz polecenie (unikat: zaproszony raz na rundę).
      const ins = await db.from("game_referrals").insert({ round_id: round.id, referred_user_id: u.id, referrer_user_id: ref }).select().maybeSingle();
      if (ins.error) return json({ ok: true, awarded: 0, reason: "already" });
      // Limit: max 20 poleceń/rundę na zapraszającego (anty-abuse).
      const { count } = await db.from("game_referrals").select("*", { count: "exact", head: true }).eq("round_id", round.id).eq("referrer_user_id", ref);
      if ((count ?? 0) <= 20) {
        const { data: e } = await db.from("game_entries").select("tickets").eq("round_id", round.id).eq("user_id", ref).maybeSingle();
        await db.from("game_entries").upsert({ round_id: round.id, user_id: ref, tickets: (e?.tickets || 0) + 50, updated_at: new Date().toISOString() }, { onConflict: "round_id,user_id" });
      }
      return json({ ok: true, awarded: 50 });
    }

    // ── CLAIM: zwycięzca wybiera 10 utworów + nośnik + adres ──
    if (action === "claim") {
      const u = await getUserId(auth);
      if (!u) return json({ error: "unauthorized" }, 401);
      if (round.winner_user_id && round.winner_user_id !== u.id) return json({ error: "not_winner" }, 403);
      // Przyjmujemy obiekty {id,title} (do podglądu w adminie) albo same id.
      const trackIds = Array.isArray(body.tracks) ? body.tracks.slice(0, 10)
        : Array.isArray(body.track_ids) ? body.track_ids.slice(0, 10) : [];
      const medium = ["vinyl", "cd", "nfc"].includes(body.medium) ? body.medium : "vinyl";
      await db.from("game_winner_picks").upsert({
        round_id: round.id, user_id: u.id, track_ids: trackIds, medium,
        ship_name: String(body.ship_name || "").slice(0, 200),
        ship_address: String(body.ship_address || "").slice(0, 800),
        ship_email: String(body.ship_email || u.email).slice(0, 200),
        status: "submitted",
      }, { onConflict: "round_id,user_id" });
      // Powiadom admina
      await db.from("hub_log").insert({ source: "game-hub", level: "info", message: `🏆 Zwycięzca ${u.name} wybrał ${trackIds.length} utworów (${medium}) — do wysyłki`, data: { round: round.id, user: u.id } });
      return json({ ok: true });
    }

    // ── ADMIN: podgląd zwycięzców (PIN wspólny z panelami B2B) ──
    if (action === "admin_list") {
      const pin = String(body.pin || "");
      if (!pin || pin !== (await cfgVal("pricing_pin"))) return json({ error: "bad_pin" }, 403);
      const { data: rounds } = await db.from("game_rounds").select("*").order("created_at", { ascending: false }).limit(12);
      const { data: picks } = await db.from("game_winner_picks").select("*");
      const byRound: Record<string, any> = {};
      for (const p of picks || []) byRound[p.round_id] = p;
      const out = (rounds || []).map((r) => ({
        id: r.id, title: r.title, status: r.status, ends_at: r.ends_at,
        winner_name: r.winner_name, winner_email: r.winner_email, winner_user_id: r.winner_user_id,
        pick: byRound[r.id]
          ? { medium: byRound[r.id].medium, tracks: byRound[r.id].track_ids,
              ship_name: byRound[r.id].ship_name, ship_address: byRound[r.id].ship_address,
              ship_email: byRound[r.id].ship_email, status: byRound[r.id].status }
          : null,
      }));
      // Statystyka aktualnej rundy.
      const active = out.find((r) => r.status === "active");
      let players = 0;
      if (active) { const { count } = await db.from("game_entries").select("*", { count: "exact", head: true }).eq("round_id", active.id); players = count ?? 0; }
      return json({ ok: true, rounds: out, active_players: players });
    }

    if (action === "admin_mark_shipped") {
      const pin = String(body.pin || "");
      if (!pin || pin !== (await cfgVal("pricing_pin"))) return json({ error: "bad_pin" }, 403);
      await db.from("game_winner_picks").update({ status: body.status === "shipped" ? "shipped" : "submitted" }).eq("round_id", body.round_id);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
