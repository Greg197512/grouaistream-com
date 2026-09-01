/**
 * GrouAI Stream — Supabase Edge Function: og-proxy
 *
 * Cel: Wykrywa boty społecznościowe (WhatsApp, Facebook, X, Telegram, itp.)
 * i serwuje im HTML z dynamicznymi OG tagami per utwór, żeby udostępniony
 * link (np. z ShareTrackModal: /?play=TRACK_ID) pokazywał ładny podgląd
 * z okładką i tytułem utworu zamiast ogólnej strony GrouAI Stream.
 * Normalni użytkownicy trafiają od razu do React SPA (/?play=TRACK_ID),
 * które odtwarza utwór (patrz Index.tsx).
 *
 * Deploy: supabase functions deploy og-proxy --no-verify-jwt
 * Routing: wywoływana z Vercel przez rewrite w vercel.json — patrz KROK 2
 *          w INSTRUKCJE.md — TYLKO dla botów, żeby nie zaburzać normalnego SPA.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = "https://grouaistream.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

// User-Agents botów społecznościowych i wyszukiwarek
const BOT_AGENTS = [
  "whatsapp", "facebookexternalhit", "twitterbot", "telegrambot",
  "linkedinbot", "slackbot", "discordbot", "applebot", "googlebot",
  "bingbot", "yandexbot", "duckduckbot", "ia_archiver", "pinterest",
  "redditbot", "skypeuripreview",
];

function isSocialBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_AGENTS.some((bot) => ua.includes(bot));
}

interface TrackRow {
  id: string;
  title: string;
  artist: string | null;
  cover_url: string | null;
  audio_url: string | null;
  genre: string | null;
}

/** Generuje HTML z OG tagami dla utworu */
function buildOGHtml(track: TrackRow): string {
  const title = `${track.title}${track.artist ? ` — ${track.artist}` : ""} | GrouAI Stream`;
  const description = `Posłuchaj "${track.title}"${track.artist ? ` od ${track.artist}` : ""}${track.genre ? ` (${track.genre})` : ""} na GrouAI Stream — uczciwy streaming AI bez botów.`;
  const image = track.cover_url || DEFAULT_OG_IMAGE;
  const url = `${SITE_URL}/?play=${track.id}`;
  const audio = track.audio_url || "";

  return `<!DOCTYPE html>
<html lang="pl" prefix="og: http://ogp.me/ns# music: http://ogp.me/ns/music#">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>

  <!-- Primary Meta -->
  <meta name="description" content="${escapeHtml(description)}" />

  <!-- Open Graph (Facebook, WhatsApp, LinkedIn, Telegram) -->
  <meta property="og:type" content="music.song" />
  <meta property="og:site_name" content="GrouAI Stream" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="1200" />
  <meta property="og:image:alt" content="${escapeHtml(track.title)} — okładka" />
  ${audio ? `<meta property="og:audio" content="${audio}" />
  <meta property="og:audio:type" content="audio/mpeg" />` : ""}
  ${track.artist ? `<meta property="music:musician" content="${escapeHtml(track.artist)}" />` : ""}

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@GrouAI" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${image}" />

  <!-- Canonical & redirect dla przeglądarek, które jednak wyrenderują JS -->
  <link rel="canonical" href="${url}" />
  <meta http-equiv="refresh" content="0; url=${url}" />
</head>
<body>
  <p>Ładowanie <a href="${url}">${escapeHtml(track.title)}</a>...</p>
  <script>window.location.replace("${url}");</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const userAgent = req.headers.get("user-agent") || "";

  // ID utworu: /og-proxy?id=TRACK_ID (Vercel rewrite przekazuje ?play= jako ?id=)
  const trackId = url.searchParams.get("id") || url.searchParams.get("play");

  if (!trackId) {
    return Response.redirect(SITE_URL, 302);
  }

  // Jeśli to nie bot — od razu przekieruj do prawdziwej strony (SPA odtworzy utwór)
  if (!isSocialBot(userAgent)) {
    return Response.redirect(`${SITE_URL}/?play=${trackId}`, 302);
  }

  // Bot — pobierz dane utworu z Supabase i zwróć statyczny HTML z OG tagami
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: track, error } = await supabase
    .from("tracks")
    .select("id, title, artist, cover_url, audio_url, genre")
    .eq("id", trackId)
    .single();

  if (error || !track) {
    return Response.redirect(SITE_URL, 302);
  }

  const html = buildOGHtml(track as TrackRow);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
