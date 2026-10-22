import { uploadToR2 } from "@/lib/r2Upload";

// Generatory (Suno, minimax, MusicGen) zwracają adresy u zewnętrznych dostawców,
// które mogą wygasnąć albo zniknąć (np. Storage innego projektu Supabase). Ten helper
// kopiuje plik na nasz R2 i zwraca trwały adres. Gdy się nie uda, zwraca oryginał —
// generowanie nigdy nie przestaje działać przez błąd kopiowania.

const R2_HOST = "pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

export async function mirrorToR2(remoteUrl: string, title: string, userId: string): Promise<string> {
  if (!remoteUrl.startsWith("http") || remoteUrl.includes(R2_HOST)) return remoteUrl;
  try {
    const resp = await fetch(remoteUrl);
    if (!resp.ok) throw new Error(`pobieranie: HTTP ${resp.status}`);
    const blob = await resp.blob();
    const type = blob.type || "audio/mpeg";
    const ext = type.includes("wav") ? "wav" : type.includes("ogg") ? "ogg" : type.includes("flac") ? "flac" : "mp3";
    const safe = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40) || "track";
    const file = new File([blob], `${safe}_${Date.now()}.${ext}`, { type });
    const { publicUrl } = await uploadToR2({ file, folder: `studio/${userId}` });
    return publicUrl;
  } catch (err) {
    console.warn("[mirrorToR2] nie udało się skopiować — zostaje oryginalny adres", err);
    return remoteUrl;
  }
}

/** Czy adres nadaje się do zapisania w katalogu (trwały, nie blob: z tej przeglądarki). */
export const isPersistentAudioUrl = (url: string | null | undefined): url is string =>
  !!url && url.startsWith("https://");
