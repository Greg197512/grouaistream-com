// Revenue Optimizer Agent — daily anomaly detection, ROI report, milestone hints.
// Cron: daily at 07:00 UTC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface StreamRow { user_id: string; track_id: string; streamed_at: string; }
interface TipRow { recipient_id: string; amount: number; created_at: string; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ─── 1. Stream anomaly detection ─────────────────────────────────
    // Per-track: streams in last 24h vs avg of previous 7 days
    const { data: streams24h } = await supabase
      .from('stream_events')
      .select('track_id, user_id, streamed_at')
      .eq('counted', true)
      .gte('streamed_at', since24h)
      .limit(5000);

    const { data: streams7d } = await supabase
      .from('stream_events')
      .select('track_id')
      .eq('counted', true)
      .gte('streamed_at', since7d)
      .lt('streamed_at', since24h)
      .limit(20000);

    const counts24h = new Map<string, number>();
    const uniqueListeners24h = new Map<string, Set<string>>();
    for (const s of (streams24h ?? []) as StreamRow[]) {
      counts24h.set(s.track_id, (counts24h.get(s.track_id) ?? 0) + 1);
      if (!uniqueListeners24h.has(s.track_id)) uniqueListeners24h.set(s.track_id, new Set());
      uniqueListeners24h.get(s.track_id)!.add(s.user_id);
    }
    const counts7d = new Map<string, number>();
    for (const s of (streams7d ?? []) as { track_id: string }[]) {
      counts7d.set(s.track_id, (counts7d.get(s.track_id) ?? 0) + 1);
    }

    const botFlags: Array<{ track_id: string; streams_24h: number; unique_listeners: number; ratio: number; baseline_daily: number }> = [];
    const trending: Array<{ track_id: string; streams_24h: number; baseline_daily: number; multiplier: number }> = [];

    for (const [trackId, c24] of counts24h.entries()) {
      const baselineDaily = (counts7d.get(trackId) ?? 0) / 6; // 6 days
      const unique = uniqueListeners24h.get(trackId)?.size ?? 0;
      const ratio = unique > 0 ? c24 / unique : c24; // streams per listener

      // Bot flag: >50 streams in 24h, ratio > 8 (one user spamming), or baseline near 0
      if (c24 >= 50 && ratio >= 8) {
        botFlags.push({ track_id: trackId, streams_24h: c24, unique_listeners: unique, ratio: Math.round(ratio * 10) / 10, baseline_daily: Math.round(baselineDaily * 10) / 10 });
      }
      // Trending: 24h ≥ 5× baseline AND ≥ 30 streams AND ≥ 5 unique listeners
      if (baselineDaily > 0 && c24 >= baselineDaily * 5 && c24 >= 30 && unique >= 5) {
        trending.push({ track_id: trackId, streams_24h: c24, baseline_daily: Math.round(baselineDaily * 10) / 10, multiplier: Math.round((c24 / baselineDaily) * 10) / 10 });
      }
    }

    // Enrich top trending with track meta
    trending.sort((a, b) => b.multiplier - a.multiplier);
    const topTrending = trending.slice(0, 5);
    if (topTrending.length > 0) {
      const ids = topTrending.map((t) => t.track_id);
      const { data: trackMeta } = await supabase
        .from('tracks')
        .select('id, title, artist, genre')
        .in('id', ids);
      const metaMap = new Map((trackMeta ?? []).map((t: any) => [t.id, t]));
      for (const t of topTrending) Object.assign(t, metaMap.get(t.track_id) ?? {});
    }

    // ─── 2. Tips ROI ─────────────────────────────────────────────────
    const { data: tips24h } = await supabase
      .from('tip_transactions')
      .select('recipient_id, amount, artist_amount, platform_fee, created_at')
      .gte('created_at', since24h);
    const totalTipVolume = (tips24h ?? []).reduce((s, t: any) => s + Number(t.amount ?? 0), 0);
    const totalPlatformFee = (tips24h ?? []).reduce((s, t: any) => s + Number(t.platform_fee ?? 0), 0);

    // ─── 3. Milestone hints — users near a claimable bonus ──────────
    // Anyone with 40-49 uploads / 40-49 ratings / 4 studio tracks / 40-49 likes
    const { data: nearUploads } = await supabase.rpc('get_users_near_milestone', {}).single();
    // Fallback if RPC not present: simple per-user track count via RPC won't run; use direct queries
    let nearUploadList: Array<{ user_id: string; current: number; type: string }> = [];
    if (!nearUploads) {
      const { data: rows } = await supabase
        .from('tracks')
        .select('user_id')
        .not('user_id', 'is', null)
        .limit(50000);
      const counts = new Map<string, number>();
      for (const r of rows ?? []) counts.set(r.user_id!, (counts.get(r.user_id!) ?? 0) + 1);
      for (const [uid, c] of counts.entries()) {
        if (c >= 40 && c < 50) nearUploadList.push({ user_id: uid, current: c, type: 'uploads_50' });
      }
    }

    // ─── 4. Build report snapshot ───────────────────────────────────
    const snapshot = {
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      streams: {
        total_24h: streams24h?.length ?? 0,
        unique_tracks_24h: counts24h.size,
        bot_flags: botFlags.length,
        trending_count: topTrending.length,
      },
      tips: {
        count_24h: tips24h?.length ?? 0,
        volume_eur: Math.round(totalTipVolume * 100) / 100,
        platform_fee_eur: Math.round(totalPlatformFee * 100) / 100,
      },
      milestones: {
        near_uploads_50: nearUploadList.length,
      },
    };

    // ─── 5. Emit events ─────────────────────────────────────────────
    const events: Array<{ event_type: string; payload: any; priority: number }> = [];

    // Always emit revenue.report
    events.push({
      event_type: 'revenue.report',
      payload: {
        snapshot,
        top_trending: topTrending.slice(0, 5),
        near_milestones: nearUploadList.slice(0, 10),
      },
      priority: 6,
    });

    // High-priority bot flags
    for (const flag of botFlags.slice(0, 10)) {
      events.push({
        event_type: 'alert.stream_anomaly',
        payload: flag,
        priority: 2,
      });
    }

    // Trending → recommendations for promotion
    for (const t of topTrending.slice(0, 3)) {
      events.push({
        event_type: 'agent.recommendation',
        payload: {
          type: 'promote_track',
          track_id: t.track_id,
          reason: `Trending: ${t.multiplier}× baseline (${t.streams_24h} streams w 24h)`,
          ...t,
        },
        priority: 4,
      });
    }

    if (events.length > 0) {
      await supabase.from('agent_events').insert(
        events.map((e) => ({
          event_type: e.event_type,
          source: 'revenue-optimizer',
          priority: e.priority,
          payload: e.payload,
        })),
      );
    }

    // Save report to brain_memory for long-term context
    await supabase.from('brain_memory').insert({
      memory_type: 'platform_insight',
      title: `Raport finansowy ${new Date().toISOString().slice(0, 10)}`,
      content: JSON.stringify(snapshot),
      summary: `${snapshot.streams.total_24h} streamów / ${snapshot.tips.count_24h} tipów (${snapshot.tips.volume_eur}€) / ${botFlags.length} flag botów / ${topTrending.length} trendów`,
      importance: botFlags.length > 0 ? 8 : 5,
      metadata: { agent: 'revenue-optimizer', date: new Date().toISOString().slice(0, 10) },
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Update agent_registry
    await supabase
      .from('agent_registry')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'ok',
        success_count: 1,
      })
      .eq('name', 'revenue-optimizer');

    return new Response(
      JSON.stringify({ ok: true, snapshot, events_emitted: events.length, bot_flags: botFlags.length, trending: topTrending.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('revenue-optimizer error', err);
    await supabase
      .from('agent_registry')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'error',
        last_error: String(err),
        error_count: 1,
      })
      .eq('name', 'revenue-optimizer');
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
