// Wykrywanie nastroju dla GrouAI Studio: z opisu utworu (PL/EN), z detektora nastroju (kamera/głos)
// i z pory dnia — oraz sugestia stylu, który do tego nastroju pasuje.

export type StudioMoodId = "happy" | "sad" | "energetic" | "chill" | "romantic" | "dark" | "epic";

export const MOOD_META: Record<StudioMoodId, { pl: string; en: string; color: string }> = {
  epic: { pl: "Epicki", en: "Epic", color: "#F5B73B" },
  happy: { pl: "Radosny", en: "Uplifting", color: "#FFD84D" },
  energetic: { pl: "Energetyczny", en: "Energetic", color: "#FF6B3D" },
  chill: { pl: "Spokojny", en: "Calm", color: "#5EC8FF" },
  romantic: { pl: "Romantyczny", en: "Romantic", color: "#FF7AB6" },
  sad: { pl: "Melancholijny", en: "Melancholic", color: "#7C8CFF" },
  dark: { pl: "Mroczny", en: "Tense", color: "#A764FF" },
};

// Rdzenie słów (dopasowanie od początku wyrazu), także nazwy gatunków, które niosą nastrój.
const LEXICON: Record<StudioMoodId, string[]> = {
  epic: ["epic", "epick", "filmow", "cinematic", "orchestr", "orkiestr", "trailer", "zwiastun", "hymn", "anthem", "heroic", "bohater", "kulminac", "climax", "potęż", "monumental", "majestat", "majestic", "gór", "mountain", "wielki"],
  happy: ["happy", "radosn", "wesoł", "joy", "uplift", "pozytyw", "positive", "sun", "słońc", "słoneczn", "lato", "summer", "lekk", "bright", "jasn", "hope", "nadziej", "optymi", "uśmiech", "smile", "pop"],
  energetic: ["energ", "dynamic", "dynamiczn", "fast", "szybk", "power", "mocn", "drive", "driving", "dance", "taneczn", "party", "impreza", "club", "klub", "trening", "workout", "rock", "metal", "edm", "house", "techno", "drum", "agresyw", "adrenalin", "skok"],
  chill: ["chill", "calm", "spokoj", "relaks", "relax", "ambient", "lo-fi", "lofi", "mellow", "łagodn", "soft", "delikatn", "sen", "sleep", "medytac", "meditat", "nauk", "study", "deszcz", "rain", "wieczor", "evening", "kaw", "coffee", "jazz", "contemplat", "kontemplac", "zaduma", "atmospher", "atmosfer"],
  romantic: ["romant", "love", "miłoś", "kocham", "serce", "heart", "tender", "czuł", "intim", "taniec", "first dance", "wesel", "wedding", "r&b", "rnb", "soul", "ballad"],
  sad: ["sad", "smut", "melanchol", "tęskn", "longing", "żal", "łzy", "tears", "samotn", "lonely", "rozstan", "breakup", "nostalg", "jesień", "autumn", "emocjonal", "emotional", "deep", "głęb", "ballad", "piano", "fortepian", "pianin"],
  dark: ["dark", "mrocz", "ciemn", "tense", "napięc", "tension", "mysteri", "tajemn", "horror", "noc", "night", "thriller", "trap", "industrial", "groź", "ominous", "shadow", "cień", "burz", "storm", "dramat", "dramatic"],
};

const words = (t: string) => t.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}&-]+/u).filter(Boolean);

export type MoodAnalysis = {
  scores: { id: StudioMoodId; pct: number }[]; // malejąco
  top: StudioMoodId[];                          // 1–3 dominujące
  confidence: number;                           // 0–100 (0 = za mało słów)
};

/** Analiza nastroju z opisu: trafienia rdzeni słów → procenty; pewność rośnie z liczbą trafień. */
export function analyzeMood(text: string): MoodAnalysis {
  const w = words(text);
  const joined = ` ${w.join(" ")} `;
  const raw = (Object.keys(LEXICON) as StudioMoodId[]).map((id) => {
    let hits = 0;
    for (const stem of LEXICON[id]) {
      if (stem.includes(" ")) { if (joined.includes(` ${stem}`)) hits += 1.5; continue; }
      for (const x of w) if (x.startsWith(stem)) hits += 1;
    }
    return { id, hits };
  });
  const total = raw.reduce((s, r) => s + r.hits, 0);
  if (!total) return { scores: raw.map((r) => ({ id: r.id, pct: 0 })), top: [], confidence: 0 };
  const max = Math.max(...raw.map((r) => r.hits));
  const scores = raw
    .map((r) => ({ id: r.id, pct: r.hits ? Math.round(18 + 77 * (r.hits / max) * Math.min(1, 0.55 + total / 10)) : Math.round(6 + 10 * (total / (total + 6))) }))
    .sort((a, b) => b.pct - a.pct);
  const top = scores.filter((s, i) => i < 3 && raw.find((r) => r.id === s.id)!.hits > 0 && s.pct >= scores[0].pct * 0.6).map((s) => s.id);
  const confidence = Math.min(97, Math.round(45 + 52 * (1 - Math.exp(-total / 3.5)) * (max / total > 0.3 ? 1 : 0.85)));
  return { scores, top, confidence };
}

/** Styl sugerowany do nastroju: gatunek z listy Studia + dopisek do opisu utworu. */
export const MOOD_STYLE: Record<StudioMoodId, { genre: string; prompt: string; promptEn: string; tempo: "slow" | "medium" | "fast" | "very-fast"; intensity: "minimal" | "balanced" | "rich" | "epic" }> = {
  epic: { genre: "Classical", prompt: "epicki, filmowy, orkiestra i chór, narastające napięcie aż do wielkiej kulminacji", promptEn: "epic cinematic orchestra and choir, building tension into a huge climax", tempo: "medium", intensity: "epic" },
  happy: { genre: "Pop", prompt: "radosny, chwytliwy pop z jasnymi syntezatorami i refrenem do śpiewania", promptEn: "uplifting catchy pop, bright synths, sing-along chorus", tempo: "medium", intensity: "rich" },
  energetic: { genre: "Rock", prompt: "energetyczny, mocna perkusja i gitary, szybkie tempo, dużo mocy", promptEn: "high-energy, punchy drums and guitars, fast tempo", tempo: "fast", intensity: "rich" },
  chill: { genre: "Lo-fi", prompt: "spokojny, relaksujący lo-fi, ciepłe pianino, miękki bit", promptEn: "calm relaxing lo-fi, warm keys, soft beat", tempo: "slow", intensity: "minimal" },
  romantic: { genre: "R&B", prompt: "romantyczny, czuły wokal, ciepłe R&B, nastrojowe akordy", promptEn: "romantic tender vocals, warm R&B chords", tempo: "slow", intensity: "balanced" },
  sad: { genre: "Indie", prompt: "melancholijna ballada, fortepian i smyczki, emocjonalny wokal", promptEn: "melancholic ballad, piano and strings, emotional vocals", tempo: "slow", intensity: "balanced" },
  dark: { genre: "Trap", prompt: "mroczny, tajemniczy klimat, głęboki bas, napięcie jak w thrillerze", promptEn: "dark mysterious mood, deep bass, thriller tension", tempo: "medium", intensity: "rich" },
};

/** Nastrój z detektora (kamera/głos) — etykieta bywa po polsku lub angielsku, gatunek pomaga rozstrzygnąć. */
export function moodFromDetector(label: string, genre?: string): StudioMoodId {
  const l = label.toLowerCase();
  if (/(zły|intens|angry|wściek|bunt|rebel)/.test(l)) return "energetic";
  if (/(niepok|anx|fear|lęk|strach)/.test(l)) return "dark";
  if (/(zrelaks|relax|neutral|spokoj)/.test(l)) return "chill";
  if (/(podekscyt|excit|surpris|zaskocz)/.test(l)) return "energetic";
  return analyzeMood(label).top[0] ?? analyzeMood(genre ?? "").top[0] ?? "happy";
}

/** Nastrój pory dnia (gdy nie ma innych sygnałów). */
export function timeOfDayMood(hour = new Date().getHours()): { mood: StudioMoodId; pl: string; en: string } {
  if (hour >= 22 || hour < 5) return { mood: "chill", pl: "noc", en: "night" };
  if (hour < 11) return { mood: "happy", pl: "poranek", en: "morning" };
  if (hour < 17) return { mood: "energetic", pl: "dzień", en: "daytime" };
  return { mood: "romantic", pl: "wieczór", en: "evening" };
}
