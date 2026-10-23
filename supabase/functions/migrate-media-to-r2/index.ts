// Przenosi media utworów (audio, okładki, pliki wideo) z zewnętrznych hostów na Cloudflare R2
// i podmienia adresy w public.tracks.
//
// Wywołanie: POST { "limit": 60, "after_id": "<uuid|null>" }
//   → { processed, moved, failed, next_after_id, done, results[] }
// Wołaj w pętli, przekazując next_after_id, aż done = true. Kursor (after_id) sprawia, że
// nieudane pozycje nie blokują kolejnych partii. Każde wywołanie mieści się w budżecie czasu,
// więc nie kończy się 504 IDLE_TIMEOUT.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { archiveToR2 } from '../_shared/r2.ts';

const R2_BASE = Deno.env.get('R2_PUBLIC_BASE') || 'https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev';
const TIME_BUDGET_MS = 100_000;  // limit platformy to 150 s bez odpowiedzi
const FETCH_TIMEOUT_MS = 15_000; // pojedyncze pobranie źródła
const CONCURRENCY = 6;

const isR2 = (u: string | null) => !!u && u.startsWith(R2_BASE);
const isHttp = (u: string | null) => !!u && /^https?:\/\//i.test(u);

// Wideo przenosimy tylko jako plik. Linki do YouTube/Vimeo to strony, nie pliki.
const isVideoFile = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

const needsMove = (field: 'audio_url' | 'cover_url' | 'video_url', u: string | null): u is string =>
  isHttp(u) && !isR2(u) && (field !== 'video_url' || isVideoFile(u!));

function guess(url: string, kind: 'audio' | 'image' | 'video') {
  const clean = url.split('?')[0].toLowerCase();
  const m = clean.match(/\.([a-z0-9]{2,4})$/);
  const fallback = kind === 'audio' ? 'mp3' : kind === 'video' ? 'mp4' : 'jpg';
  const ext = m?.[1] || fallback;
  const types: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', ogg: 'audio/ogg',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4',
  };
  const contentType = types[ext] || (kind === 'audio' ? 'audio/mpeg' : kind === 'video' ? 'video/mp4' : 'image/jpeg');
  return { ext: types[ext] ? ext : fallback, contentType };
}

type Row = { id: string; audio_url: string | null; cover_url: string | null; video_url: string | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let limit = 60;
    let afterId: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.limit === 'number') limit = Math.min(Math.max(body.limit, 1), 200);
      if (typeof body?.after_id === 'string' && body.after_id) afterId = body.after_id;
    } catch (_) { /* brak body */ }

    // Kandydaci filtrowani w SQL: tylko wiersze z mediami poza R2, w kolejności id (kursor).
    // Wiersz trafia do partii, gdy którekolwiek pole nie wskazuje na R2 (NULL odpada w SQL);
    // dokładną decyzję (http, plik wideo) podejmuje needsMove() niżej.
    const notR2 = `"${R2_BASE}%"`;
    let q = admin
      .from('tracks')
      .select('id, audio_url, cover_url, video_url')
      .or(`audio_url.not.like.${notR2},cover_url.not.like.${notR2},video_url.not.like.${notR2}`)
      .order('id', { ascending: true })
      .limit(limit);
    if (afterId) q = q.gt('id', afterId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []) as Row[];

    const results: { id: string; moved: string[]; failed: string[] }[] = [];
    let lastId: string | null = afterId;
    let index = 0;

    const worker = async () => {
      while (index < rows.length && Date.now() - started < TIME_BUDGET_MS) {
        const t = rows[index++];
        const patch: Record<string, string> = {};
        const failed: string[] = [];
        for (const field of ['audio_url', 'cover_url', 'video_url'] as const) {
          const url = t[field];
          if (!needsMove(field, url)) continue;
          const kind = field === 'audio_url' ? 'audio' : field === 'cover_url' ? 'image' : 'video';
          const { ext, contentType } = guess(url, kind);
          const newUrl = await archiveToR2({
            sourceUrl: url,
            folder: field === 'audio_url' ? 'tracks' : field === 'cover_url' ? 'covers' : 'videos',
            id: `${t.id}-${field}`,
            ext,
            contentType,
            timeoutMs: FETCH_TIMEOUT_MS,
          });
          if (newUrl) patch[field] = newUrl; else failed.push(field);
        }
        if (Object.keys(patch).length) {
          const { error: upErr } = await admin.from('tracks').update(patch).eq('id', t.id);
          if (upErr) failed.push(`update:${upErr.message}`);
        }
        results.push({ id: t.id, moved: Object.keys(patch), failed });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // Kursor = największe id spośród PRZETWORZONYCH wierszy (te w kolejności id).
    const processedIds = new Set(results.map((r) => r.id));
    for (const r of rows) if (processedIds.has(r.id)) lastId = r.id; else break;

    const moved = results.reduce((n, r) => n + r.moved.length, 0);
    const failedCount = results.reduce((n, r) => n + r.failed.length, 0);
    const done = rows.length < limit && results.length === rows.length;

    return new Response(JSON.stringify({
      processed: results.length,
      moved,
      failed: failedCount,
      next_after_id: lastId,
      done,
      ms: Date.now() - started,
      results: results.filter((r) => r.failed.length).slice(0, 20),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
