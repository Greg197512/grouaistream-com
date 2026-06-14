## Plan: Radio — dodaj świeże utwory + ułatwienie na przyszłość

**Stan na teraz:** w bazie jest 9 utworów dodanych w ciągu ostatnich 2 dni (z `audio_url` i czasem ≥ 2 min), które jeszcze nie są w `radio_schedule`. Dorzucam je do anteny i dokładam wygodny przycisk, żebyś w przyszłości robił to jednym kliknięciem.

### 1. Jednorazowe dodanie 9 świeżych utworów (insert do `radio_schedule`)
- Wyfiltrowanie utworów z ostatnich 2 dni: `audio_url IS NOT NULL`, `duration >= 120`, brak w `radio_schedule`, brak blokady artysty w `radio_artist_blocks`.
- Wstawienie ich na koniec rozkładu (kolejne `position` po obecnym maxie), `item_type = 'track'`.
- Sortowanie: najnowsze pierwsze, ale przeplatane wg artysty (żeby ten sam wykonawca nie leciał obok siebie).

### 2. Przycisk "Dodaj nowości z ostatnich N dni" w `RadioStationManager`
- Nad timeline'em (`src/components/admin/RadioTimeline.tsx` / `RadioStationManager.tsx`) dodaję mały panel: input liczby dni (domyślnie 2) + przycisk **"Dodaj nowe utwory (N dni)"**.
- Klik → query do `tracks` z filtrem `created_at > now() - N days`, pomija to, co już jest w `radio_schedule`, pomija zablokowanych artystów, wrzuca na koniec rozkładu.
- Toast: "Dodano X nowych utworów do radia" + odświeżenie listy.
- Bezpieczniki: minimum 2 min długości, deduplikacja po `track_id`, limit 50 utworów na jeden klik (żeby przez przypadek nie zalać anteny).

### 3. Drobne usprawnienie odtwarzania (kontynuacja poprzedniej naprawy)
- W `RadioLive.tsx` po dodaniu nowych pozycji `schedule` aktualizuje się tylko w ref — odtwarzacz NIE restartuje bieżącego utworu, świeże pojawią się dopiero w następnej rotacji. Już działa — tylko potwierdzam, że nowe wpisy nie urwą tego, co właśnie leci.

### Pliki do zmiany
- `src/components/admin/RadioStationManager.tsx` — funkcja `addRecentTracks(days)` + UI panelu.
- `src/components/admin/RadioTimeline.tsx` — miejsce na przycisk (lub nowy mały komponent `AddRecentTracksButton`).
- **Insert danych** (jednorazowo, przez tool insert, bez migracji) — dorzucenie 9 utworów już teraz, żebyś od razu słyszał je na antenie.

### Czego NIE zmieniam
- Schematu bazy, RLS, edge functions, brzmienia strumienia HLS, logiki rozkładu 24h.

Zatwierdź, to wykonuję od razu.
