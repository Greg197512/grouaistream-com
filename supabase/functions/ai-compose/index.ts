import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a music composition AI. Given a description of a song, output a JSON musical score that a browser synthesizer can render.

OUTPUT FORMAT (JSON only, no markdown):
{
  "bpm": number (60-180),
  "key": string ("C","D","E","F","G","A","B"),
  "scale": "major" | "minor" | "pentatonic" | "blues",
  "duration": number (seconds),
  "swing": number (0-0.3, shuffle feel),
  "sections": [
    {
      "name": "intro" | "verse" | "chorus" | "bridge" | "outro",
      "startBeat": number,
      "lengthBeats": number,
      "energy": number (0-1)
    }
  ],
  "melody": [
    { "note": "C4", "beat": 0, "dur": 0.5, "vel": 0.8 }
  ],
  "chords": [
    { "notes": ["C3","Eb3","G3"], "beat": 0, "dur": 4 }
  ],
  "bass": [
    { "note": "C2", "beat": 0, "dur": 1, "vel": 0.9 }
  ],
  "drums": {
    "kick": [0, 4, 8, 12],
    "snare": [2, 6, 10, 14],
    "hihat": [0, 1, 2, 3, 4, 5, 6, 7],
    "clap": []
  },
  "synth": {
    "melody": "sawtooth" | "square" | "sine" | "triangle",
    "pad": "sine" | "triangle",
    "bass": "sawtooth" | "sine",
    "filterCutoff": number (200-8000),
    "reverbMix": number (0-0.6)
  }
}

RULES:
- All beat numbers are in quarter notes (beat 0 = start, beat 4 = second bar in 4/4)
- Generate at least 8 bars (32 beats in 4/4)
- Melody notes should follow the scale and create a catchy motif that repeats with variations
- Chords should follow common progressions (i-iv-v, I-IV-V-I, ii-V-I, etc.)
- Bass follows root notes of chords with occasional walks
- Drums match the genre (4-on-floor for house/disco, boom-bap for hip-hop, sparse for ambient)
- Energy should build through sections
- For lo-fi: slow, jazzy chords, sparse drums, warm sine melody
- For electronic/house: 4-on-floor kick, offbeat hihat, filtered saw lead
- For rock: power chords, driving bass, heavy kick+snare
- For ambient: long pad chords, no drums, slow sine melody
- Keep it musical! Real progressions, not random notes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Lovable AI gateway removed — this feature requires a new AI provider configuration
  return new Response(JSON.stringify({
    error: "AI music composition service is temporarily unavailable. Please configure an alternative AI provider."
  }), {
    status: 503, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
