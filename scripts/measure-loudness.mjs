#!/usr/bin/env node
// Pomiar głośności utworów radia (EBU R128) i wykrywanie martwych/cichych plików.
// Uruchamiane w GitHub Actions (ffmpeg + dostęp do R2). Wynik: public/radio-loudness.json,
// z którego radio bierze wyrównanie głośności (do −14 LUFS) i listę plików do pominięcia.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bvstvawnigyczvofzhps.supabase.co";
// Klucz publiczny (anon) — ten sam, który ma przeglądarka; bierzemy go z api/diag-tracks.ts.
const ANON = process.env.SUPABASE_ANON_KEY || (readFileSync("api/diag-tracks.ts", "utf8").match(/const ANON = "([^"]+)"/) || [])[1];
const OUT = "public/radio-loudness.json";
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const MAX_AGE_DAYS = 30;

async function tracks() {
  const all = [];
  for (let off = 0; off < 5000; off += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks?select=id,title,audio_url&audio_url=not.is.null&order=id&limit=1000&offset=${off}`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } });
    if (!r.ok) throw new Error(`tracks ${r.status}`);
    const rows = await r.json();
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

function measure(url) {
  return new Promise((resolve) => {
    const args = ["-hide_banner", "-nostats", "-t", "900", "-i", url, "-vn", "-af", "ebur128=framelog=quiet,silencedetect=n=-50dB:d=8", "-f", "null", "-"];
    const p = spawn("ffmpeg", args);
    let err = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), 150_000);
    p.stderr.on("data", (d) => { err += d.toString(); if (err.length > 2_000_000) err = err.slice(-200_000); });
    p.on("close", (code) => {
      clearTimeout(timer);
      const I = err.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/);
      const dur = err.match(/Duration: (\d+):(\d+):([\d.]+)/);
      const durSec = dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : null;
      const silence = [...err.matchAll(/silence_duration: ([\d.]+)/g)].reduce((a, m) => a + parseFloat(m[1]), 0);
      if (code !== 0 || !I) return resolve({ dead: true, why: (err.match(/(Server returned [^\n]+|HTTP error [^\n]+|Invalid data[^\n]*|No such file[^\n]*)/) || ["ffmpeg"])[0].slice(0, 80) });
      resolve({ l: Math.round(parseFloat(I[1]) * 10) / 10, s: Math.round(silence), d: durSec ? Math.round(durSec) : null });
    });
  });
}

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { tracks: {} };
const list = await tracks();
const now = Date.now();
const out = {};
let measured = 0, reused = 0;
const queue = [...list];
async function worker() {
  for (let t = queue.shift(); t; t = queue.shift()) {
    const old = prev.tracks?.[t.id];
    if (old && old.u === t.audio_url && old.at && now - old.at < MAX_AGE_DAYS * 864e5 && !old.dead) { out[t.id] = old; reused++; continue; }
    if (/cdn1\.suno\.ai/i.test(t.audio_url)) { out[t.id] = { dead: true, why: "suno 403", u: t.audio_url, at: now }; continue; }
    const r = await measure(t.audio_url);
    out[t.id] = { ...r, u: t.audio_url, at: now };
    measured++;
    if (measured % 20 === 0) console.log(`zmierzone: ${measured}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const vals = Object.values(out);
const dead = Object.entries(out).filter(([, v]) => v.dead).map(([id]) => id);
const silent = Object.entries(out).filter(([, v]) => !v.dead && (v.l < -40 || (v.d && v.s / v.d > 0.4))).map(([id]) => id);
const report = { updatedAt: new Date().toISOString(), checked: vals.length, measured, reused, dead: dead.length, silent: silent.length, tracks: out };
writeFileSync(OUT, JSON.stringify(report));
console.log(`gotowe: ${vals.length} utworów (zmierzone ${measured}, z pamięci ${reused}), martwe ${dead.length}, ciche ${silent.length}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const titles = new Map(list.map((t) => [t.id, t.title]));
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Zdrowie anteny GrouaRadio\n\n- utworów: ${vals.length}\n- martwe pliki: ${dead.length}\n- ciche / puste: ${silent.length}\n\n${[...dead, ...silent].slice(0, 60).map((id) => `- ${titles.get(id) ?? id}: ${out[id].dead ? "martwy (" + out[id].why + ")" : "cichy"}`).join("\n")}\n`, { flag: "a" });
}
