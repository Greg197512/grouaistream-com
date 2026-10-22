#!/usr/bin/env node
/**
 * Snapshot katalogu utworów → dist/tracks.json (uruchamiane po `vite build`).
 *
 * Po co: gdy produkcyjny Supabase nie odpowiada (uśpiony/limit/awaria), front
 * sięga po ten statyczny snapshot i gra dalej prosto z R2 (pliki audio są na R2,
 * w bazie jest tylko „spis treści"). Build na Vercelu MA dostęp do Supabase, więc
 * snapshot odświeża się przy każdym deployu.
 *
 * Bezpieczne: jeśli pobranie się nie powiedzie lub zwróci pustkę — nie nadpisuje
 * istniejącego snapshotu (zostawia to, co vite skopiował z public/), a w ostatniej
 * instancji zapisuje pusty placeholder, żeby /tracks.json nie było 404.
 */
import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "..", "dist");
const OUT = resolve(DIST, "tracks.json");

// Env na Vercelu; fallback do publicznych wartości (anon key i tak jest publiczny).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://bvstvawnigyczvofzhps.supabase.co";
const ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";

const SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood,created_at";
const LIMIT = 1000;

async function main() {
  if (!existsSync(DIST)) {
    console.warn("[export-tracks] brak dist/ — pomijam");
    return;
  }
  try {
    const u =
      `${SUPABASE_URL}/rest/v1/tracks?select=${encodeURIComponent(SELECT)}` +
      `&or=(audio_url.not.is.null,video_url.not.is.null)&order=created_at.desc&limit=${LIMIT}`;
    const r = await fetch(u, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    if (!r.ok) throw new Error("REST " + r.status);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("pusta/niepoprawna odpowiedź");
    const snapshot = { generated_at: new Date().toISOString(), count: rows.length, tracks: rows };
    writeFileSync(OUT, JSON.stringify(snapshot));
    console.log(`[export-tracks] zapisano ${rows.length} utworów → dist/tracks.json`);
  } catch (e) {
    console.warn("[export-tracks] nie pobrano katalogu:", e?.message || e);
    if (existsSync(OUT)) {
      console.warn("[export-tracks] zostawiam istniejący dist/tracks.json");
      return;
    }
    writeFileSync(OUT, JSON.stringify({ generated_at: null, count: 0, tracks: [] }));
    console.warn("[export-tracks] zapisano pusty placeholder");
  }
}

main();
