// Monthly cost report — automatycznie liczy stałe + zmienne koszty platformy
// Cron: 1. dnia miesiąca o 03:00 UTC (zamyka poprzedni miesiąc)
//       Codziennie o 02:00 UTC (live preview bieżącego miesiąca)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Cennik (1 miejsce do edycji jak dostawcy zmienią ceny) ────────
const RATES = {
  R2_STORAGE_PER_GB: 0.015,        // €/GB/mc Cloudflare R2
  R2_EGRESS_PER_GB: 0,             // R2 ma free egress
  ELEVENLABS_PER_1K_CHARS: 0.18,   // €/1k znaków Creator
  SUNO_PER_GENERATION: 0.05,       // €/generacja
  GEMINI_IMAGE_PER_COVER: 0.04,    // €/obraz Gemini Flash Image
  AI_GATEWAY_PER_1K_TOKENS: 0.002, // średnia €/1k tokenów (Gemini Flash)
  PADDLE_PERCENT: 0.05,            // 5% prowizji
  PADDLE_FIXED_PER_TX: 0.50,       // 0,50 € od transakcji
  AVG_TRACK_SIZE_MB: 4.5,          // średni rozmiar mp3 do estymacji R2
  AVG_STREAM_TRANSFER_MB: 4.5,     // ile MB transferu na 1 stream
};

interface CostRow {
  category: 'fixed' | 'variable';
  service_name: string;
  amount_eur: number;
  usage_metric: Record<string, unknown>;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  try {
    let body: { month?: string; manual?: boolean } = {};
    try { body = await req.json(); } catch { /* GET / cron — empty body */ }

    // Domyślnie liczy bieżący miesiąc (live). Jeśli przekazano month, liczy ten miesiąc.
    const now = new Date();
    const targetMonth = body.month
      ? new Date(body.month)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const monthStart = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 1));
    const monthKey = monthStart.toISOString().slice(0, 10);

    console.log(`[cost-report] Liczę miesiąc ${monthKey}`);

    const rows: CostRow[] = [];

    // ─── 1. KOSZTY STAŁE (z operational_costs) ──────────────────────
    const { data: fixedCosts } = await supabase
      .from('operational_costs')
      .select('service_name, monthly_amount, notes')
      .eq('is_active', true);

    for (const f of fixedCosts ?? []) {
      rows.push({
        category: 'fixed',
        service_name: f.service_name,
        amount_eur: Number(f.monthly_amount),
        usage_metric: { type: 'subscription', billing: 'monthly' },
        notes: f.notes ?? undefined,
      });
    }

    // ─── 2. KOSZTY ZMIENNE ──────────────────────────────────────────

    // 2a. R2 Storage — szacunek na podstawie liczby utworów × średni rozmiar
    const { count: trackCount } = await supabase
      .from('tracks')
      .select('id', { count: 'exact', head: true });
    const storageGb = ((trackCount ?? 0) * RATES.AVG_TRACK_SIZE_MB) / 1024;
    const r2Storage = storageGb * RATES.R2_STORAGE_PER_GB;
    rows.push({
      category: 'variable',
      service_name: 'Cloudflare R2 Storage',
      amount_eur: Math.round(r2Storage * 100) / 100,
      usage_metric: { tracks: trackCount, gb: Math.round(storageGb * 10) / 10, rate_per_gb: RATES.R2_STORAGE_PER_GB },
      notes: `${trackCount} utworów × ${RATES.AVG_TRACK_SIZE_MB} MB średnio`,
    });

    // 2b. R2 Egress — z stream_events × średni transfer
    const { count: streamCount } = await supabase
      .from('stream_events')
      .select('id', { count: 'exact', head: true })
      .gte('streamed_at', monthStart.toISOString())
      .lt('streamed_at', monthEnd.toISOString())
      .eq('counted', true);
    const egressGb = ((streamCount ?? 0) * RATES.AVG_STREAM_TRANSFER_MB) / 1024;
    rows.push({
      category: 'variable',
      service_name: 'Cloudflare R2 Egress',
      amount_eur: Math.round(egressGb * RATES.R2_EGRESS_PER_GB * 100) / 100,
      usage_metric: { streams: streamCount, gb: Math.round(egressGb * 10) / 10, rate_per_gb: RATES.R2_EGRESS_PER_GB },
      notes: `R2 ma free egress — koszt 0 €`,
    });

    // 2c. Suno generacje — tracks utworzone w tym miesiącu z audio_url ~ suno
    const { count: sunoCount } = await supabase
      .from('tracks')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())
      .ilike('audio_url', '%suno%');
    rows.push({
      category: 'variable',
      service_name: 'Suno generacje',
      amount_eur: Math.round((sunoCount ?? 0) * RATES.SUNO_PER_GENERATION * 100) / 100,
      usage_metric: { generations: sunoCount, rate: RATES.SUNO_PER_GENERATION },
      notes: `${sunoCount} utworów wygenerowanych przez Suno w tym miesiącu`,
    });

    // 2d. ElevenLabs — szacunek z generations (jeśli replicate/elevenlabs)
    const { count: voiceCount } = await supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())
      .eq('status', 'completed');
    // szacunek: średnio 800 znaków na generację głosu
    const elevenChars = (voiceCount ?? 0) * 800;
    const elevenCost = (elevenChars / 1000) * RATES.ELEVENLABS_PER_1K_CHARS;
    rows.push({
      category: 'variable',
      service_name: 'ElevenLabs TTS overage',
      amount_eur: Math.round(elevenCost * 100) / 100,
      usage_metric: { generations: voiceCount, est_chars: elevenChars, rate_per_1k: RATES.ELEVENLABS_PER_1K_CHARS },
      notes: `Szacunkowo ${voiceCount} generacji × ~800 znaków`,
    });

    // 2e. Cover AI — auto-generated covers w tym miesiącu
    const { count: coverCount } = await supabase
      .from('tracks')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())
      .or('cover_url.ilike.%r2%,cover_url.ilike.%generated%');
    rows.push({
      category: 'variable',
      service_name: 'AI Cover generation',
      amount_eur: Math.round((coverCount ?? 0) * RATES.GEMINI_IMAGE_PER_COVER * 100) / 100,
      usage_metric: { covers: coverCount, rate: RATES.GEMINI_IMAGE_PER_COVER },
      notes: `${coverCount} okładek wygenerowanych przez AI`,
    });

    // 2f. AI Gateway — z brain_memory + agent_events count jako proxy
    const { count: brainOps } = await supabase
      .from('brain_memory')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString());
    const { count: agentOps } = await supabase
      .from('agent_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString());
    const totalAiOps = (brainOps ?? 0) + (agentOps ?? 0);
    // szacunek: średnio 2000 tokenów per operacja AI
    const estTokens = totalAiOps * 2000;
    const aiCost = (estTokens / 1000) * RATES.AI_GATEWAY_PER_1K_TOKENS;
    rows.push({
      category: 'variable',
      service_name: 'Lovable AI Gateway',
      amount_eur: Math.round(aiCost * 100) / 100,
      usage_metric: { brain_ops: brainOps, agent_ops: agentOps, est_tokens: estTokens },
      notes: `${totalAiOps} operacji AI × ~2k tokenów`,
    });

    // 2g. Paddle prowizje
    const { data: txs } = await supabase
      .from('paddle_transactions')
      .select('amount, currency')
      .gte('billed_at', monthStart.toISOString())
      .lt('billed_at', monthEnd.toISOString());
    const txCount = txs?.length ?? 0;
    const txVolume = (txs ?? []).reduce((s, t: any) => s + Number(t.amount ?? 0), 0);
    const paddleFee = (txVolume * RATES.PADDLE_PERCENT) + (txCount * RATES.PADDLE_FIXED_PER_TX);
    rows.push({
      category: 'variable',
      service_name: 'Paddle prowizje',
      amount_eur: Math.round(paddleFee * 100) / 100,
      usage_metric: { transactions: txCount, volume_eur: txVolume, percent: RATES.PADDLE_PERCENT, fixed: RATES.PADDLE_FIXED_PER_TX },
      notes: `${txCount} transakcji × 5% + 0,50 €`,
    });

    // ─── 3. UPSERT do bazy ──────────────────────────────────────────
    for (const row of rows) {
      const { error } = await supabase
        .from('monthly_cost_reports')
        .upsert({
          report_month: monthKey,
          category: row.category,
          service_name: row.service_name,
          amount_eur: row.amount_eur,
          usage_metric: row.usage_metric,
          notes: row.notes,
        }, { onConflict: 'report_month,service_name' });
      if (error) console.error('[cost-report] upsert error', row.service_name, error.message);
    }

    // ─── 4. Podsumowanie + zapis do brain_memory ────────────────────
    const totalFixed = rows.filter(r => r.category === 'fixed').reduce((s, r) => s + r.amount_eur, 0);
    const totalVariable = rows.filter(r => r.category === 'variable').reduce((s, r) => s + r.amount_eur, 0);
    const totalAll = totalFixed + totalVariable;

    // Porównanie z poprzednim miesiącem
    const prevMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
    const { data: prevRows } = await supabase
      .from('monthly_cost_reports')
      .select('amount_eur')
      .eq('report_month', prevMonth.toISOString().slice(0, 10))
      .in('category', ['fixed', 'variable']);
    const prevTotal = (prevRows ?? []).reduce((s, r: any) => s + Number(r.amount_eur), 0);
    const deltaPct = prevTotal > 0 ? Math.round(((totalAll - prevTotal) / prevTotal) * 100) : 0;

    await supabase.from('brain_memory').insert({
      memory_type: 'cost_report',
      title: `Raport kosztów ${monthKey}`,
      content: JSON.stringify({ rows, totalFixed, totalVariable, totalAll, prevTotal, deltaPct }),
      summary: `Stałe ${totalFixed.toFixed(2)} € + Zmienne ${totalVariable.toFixed(2)} € = ${totalAll.toFixed(2)} € (${deltaPct >= 0 ? '+' : ''}${deltaPct}% wzgl. poprz.)`,
      importance: deltaPct > 20 ? 8 : 5,
      metadata: { agent: 'monthly-cost-report', month: monthKey, delta_pct: deltaPct },
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    console.log(`[cost-report] ${monthKey}: stałe ${totalFixed} + zmienne ${totalVariable} = ${totalAll} €`);

    return new Response(
      JSON.stringify({
        ok: true,
        month: monthKey,
        total_fixed: totalFixed,
        total_variable: totalVariable,
        total: totalAll,
        delta_pct: deltaPct,
        rows_inserted: rows.length,
        duration_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[cost-report] error', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
