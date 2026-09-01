// Migrates legacy media (Supabase Storage / Suno CDN) for tracks into Cloudflare R2.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { archiveToR2 } from '../_shared/r2.ts';

const R2_BASE = Deno.env.get('R2_PUBLIC_BASE') || 'https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev';

const isR2 = (u: string | null) => !!u && u.startsWith(R2_BASE);

// Only ephemeral / provider-hosted sources are migrated. Third-party artwork
// CDNs (mzstatic, dzcdn, picsum, youtube thumbs) stay where they are.
const MIGRATE_HOSTS = [
  'supabase.co/storage',
  'suno.ai',
  'suno.com',
  'musicfile.removeai.ai',
  'replicate.delivery',
];
const needsMove = (u: string | null) =>
  !!u && /^https?:\/\//.test(u) && !isR2(u) && MIGRATE_HOSTS.some((h) => u.includes(h));

function guess(url: string, kind: 'audio' | 'image') {
  const clean = url.split('?')[0].toLowerCase();
  const m = clean.match(/\.([a-z0-9]{2,4})$/);
  const ext = m?.[1] || (kind === 'audio' ? 'mp3' : 'jpg');
  const types: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', ogg: 'audio/ogg',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', webm: 'video/webm',
  };
  return { ext, contentType: types[ext] || (kind === 'audio' ? 'audio/mpeg' : 'image/jpeg') };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let limit = 25;
    try {
      const body = await req.json();
      if (typeof body?.limit === 'number') limit = Math.min(Math.max(body.limit, 1), 60);
    } catch (_) { /* no body */ }

    const { data: rows, error } = await admin
      .from('tracks')
      .select('id, audio_url, cover_url, video_url')
      .limit(500);
    if (error) throw error;

    const pending = (rows || []).filter((t) =>
      (t.audio_url && !isR2(t.audio_url)) ||
      (t.cover_url && !isR2(t.cover_url)) ||
      (t.video_url && !isR2(t.video_url))
    );

    const results: any[] = [];
    for (const t of pending.slice(0, limit)) {
      const patch: Record<string, string> = {};
      for (const field of ['audio_url', 'cover_url', 'video_url'] as const) {
        const url = (t as any)[field] as string | null;
        if (!url || isR2(url) || !/^https?:\/\//.test(url)) continue;
        const kind = field === 'audio_url' ? 'audio' : 'image';
        const { ext, contentType } = guess(url, kind);
        const newUrl = await archiveToR2({
          sourceUrl: url,
          folder: field === 'audio_url' ? 'tracks' : field === 'cover_url' ? 'covers' : 'videos',
          id: `${t.id}-${field}`,
          ext,
          contentType,
        });
        if (newUrl) patch[field] = newUrl;
      }
      if (Object.keys(patch).length) {
        const { error: upErr } = await admin.from('tracks').update(patch).eq('id', t.id);
        results.push({ id: t.id, moved: Object.keys(patch), ok: !upErr, error: upErr?.message });
      } else {
        results.push({ id: t.id, moved: [], ok: false, error: 'fetch/upload failed' });
      }
    }

    return new Response(JSON.stringify({
      total_pending: pending.length,
      processed: results.length,
      remaining: Math.max(pending.length - results.length, 0),
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
