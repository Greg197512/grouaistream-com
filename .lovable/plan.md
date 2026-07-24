## Cel
Każda okładka utworu (wgrane zdjęcie, AI-cover, import) ma być automatycznie zamieniana na krótki teledysk (image-to-video). Na listach, w albumach, w playerze i wszędzie tam, gdzie dziś pokazuje się okładka, ma się wyświetlać wideo (autoplay, muted, loop), z fallbackiem do zdjęcia gdy wideo jeszcze się renderuje.

## Zakres

### 1. Backend — auto-konwersja
- Nowa edge function **`auto-cover-video`**: przyjmuje `track_id`, pobiera `cover_url`, wywołuje istniejący `cover-video-generate` w trybie `image-to-video` (wan-2.2-i2v-fast → Hailuo-02 fallback), zapisuje wynik do `tracks.video_url`. Pracuje w tle (fire-and-forget z klienta), więc UX nie czeka.
- Guard: pomijaj, jeśli `video_url` już istnieje (chyba że `force: true`).

### 2. Trigger — wszędzie gdzie ustawiana jest okładka
Wywołanie `auto-cover-video` (fire-and-forget, bez blokowania UI) po:
- `TrackOptionsMenu` — „Wgraj zdjęcie 📷", „AI okładka ⚡", Cover Studio (upload/text-to-image/image-to-image)
- `Upload.tsx` — po wgraniu utworu z okładką
- `FileUploadModal.tsx` — analogicznie
- `ImportYouTube.tsx` — po zaimportowaniu (używa thumbnaila YT jako okładki)
- `Suno.tsx` / studio — po wygenerowaniu utworu z okładką

Toast: „🎬 Kręcę teledysk z okładki w tle…" + `track-list-changed` po sukcesie, żeby listy odświeżyły klip.

### 3. Frontend — jednolity komponent `<CoverMedia>`
Nowy komponent `src/components/media/CoverMedia.tsx`:
- Props: `coverUrl`, `videoUrl`, `alt`, `className`, `autoplay=true`
- Renderuje `<video muted loop playsInline autoPlay poster={coverUrl}>` gdy jest `videoUrl`; w przeciwnym razie `<img>`
- Na mobile (viewport ≤ 640px) — tylko `poster` + odtwarza wideo dopiero przy dotknięciu (oszczędność transferu i baterii)
- Obsługa błędu ładowania wideo → fallback do `<img>`

### 4. Podmiana `<img>` na `<CoverMedia>`
W miejscach, gdzie wyświetlana jest okładka utworu:
- `src/components/cards/TrackRow.tsx`, `PlaylistCard.tsx`, `ArtistCard.tsx`
- `src/components/layout/PlayerBar.tsx` (mały cover w pasku)
- `src/pages/Library.tsx`, `MyTracks.tsx`, `LikedSongs.tsx`, `Search.tsx`, `PlaylistDetail.tsx`, `AlbumCreator.tsx`, `RadioLive.tsx`, `Server.tsx`
- `src/components/player/QueueSidebar.tsx`

Miejsc z inną semantyką (blog, TikTok, admin) NIE ruszam.

## Szczegóły techniczne

**auto-cover-video (edge function):**
```ts
// body: { track_id: string, force?: boolean }
// 1. select cover_url, video_url from tracks where id=track_id
// 2. if video_url && !force → return { skipped: true }
// 3. invoke cover-video-generate with { image_url: cover_url, quality: "max" }
// 4. update tracks set video_url=<result> where id=track_id
```

**Wywołanie z klienta (helper `src/lib/autoCoverVideo.ts`):**
```ts
export const triggerCoverVideo = (trackId: string) =>
  supabase.functions.invoke("auto-cover-video", { body: { track_id: trackId } })
    .then(() => window.dispatchEvent(new CustomEvent("track-list-changed")))
    .catch((e) => console.warn("[auto-cover-video]", e));
```
Wywołane fire-and-forget (bez `await`) tam, gdzie ustawiana jest okładka.

**CoverMedia — kluczowy fragment:**
```tsx
if (videoUrl) return (
  <video src={videoUrl} poster={coverUrl} muted loop playsInline autoPlay
         onError={() => setFailed(true)} className={className} />
);
return <img src={coverUrl} alt={alt} className={className} loading="lazy" />;
```

## Poza zakresem
- Backfill istniejących utworów bez `video_url` (jeśli chcesz, mogę to zrobić w drugim kroku — job admina „Wygeneruj brakujące teledyski")
- Blog/TikTok/admin — nie ruszam
