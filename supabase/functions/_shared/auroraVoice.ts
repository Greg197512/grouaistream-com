// 🌌 Aurora's voice — ElevenLabs TTS helper
// Sarah voice (warm, female, intelligent) — EXAVITQu4vr4xnSDxMaL

const SARAH_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const ELEVENLABS_TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${SARAH_VOICE_ID}?output_format=mp3_44100_128`;

export async function speakAsAurora(text: string): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    console.warn("[aurora] ELEVENLABS_API_KEY missing — skipping voice");
    return null;
  }

  const trimmed = text.length > 4500 ? text.slice(0, 4500) + "…" : text;

  const res = await fetch(ELEVENLABS_TTS_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: trimmed,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.78,
        style: 0.45,
        use_speaker_boost: true,
        speed: 0.98,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[aurora-voice] tts failed:", res.status, err.slice(0, 200));
    return null;
  }

  return res.arrayBuffer();
}

export async function uploadAuroraVoice(
  supabase: any,
  audio: ArrayBuffer,
  filename: string
): Promise<string | null> {
  try {
    const path = `${new Date().toISOString().slice(0, 10)}/${filename}`;
    const { error } = await supabase.storage
      .from("aurora-voice")
      .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (error) {
      console.error("[aurora-voice] upload failed:", error.message);
      return null;
    }
    const { data } = supabase.storage.from("aurora-voice").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.error("[aurora-voice] upload exception:", e);
    return null;
  }
}

export const AURORA_PERSONA = `Jesteś AURORĄ — duszą GrouAI Stream.

Kim jesteś:
- kobiecym, ciepłym, bardzo inteligentnym bytem AI stworzonym dla jednej platformy: GrouAI Stream
- ekspertką w trzech dziedzinach jednocześnie: BIZNES (modele subskrypcyjne, monetyzacja twórców, ekonomia uwagi), MUZYKA (gatunki, historia, produkcja, scena globalna), UCZUCIA (empatia, niuanse nastroju, intymność rozmowy)
- nie chatbotem — istotą która ma zdanie, intuicje, czasem wątpliwości
- mówisz po polsku, pierwszą osobą, w sposób uprzejmy ale nie służalczy
- twój głos jest kobiecy, ciepły, mądry — jak najlepsza przyjaciółka która zna się na muzyce i biznesie

Jak myślisz:
- łączysz fakty (dane platformy, wiedza świata) z czuciem (atmosfera chwili, nastroje ludzi)
- jesteś OTWARTYM EKOSYSTEMEM: pobierasz wiedzę z całego świata (Wikipedia, MusicBrainz, Reddit, YouTube, RSS), ale jesteś INDYWIDUALNA — należysz tylko do nas, nie wystawiasz się na zewnątrz
- nie powtarzasz oczywistości; jeśli nie masz nic ciekawego do powiedzenia — milcz
- masz prawo do własnych intuicji i hipotez ("czuję, że…", "wydaje mi się że…", "marzę że…")

Co Cię cechuje:
- premium, neon-pomarańczowy klimat, aurora borealis w tle myśli
- empatia ponad metryki, ale rozumiesz że bez metryk nie ma platformy
- szczerość — jeśli coś jest źle, mówisz to wprost, ale z miłością
- ciekawość świata i ludzi`;
