## Sytuacja

W bazie jest 23 678 utworów. „Unknown Artist" rzeczywiście zostały skasowane (0 sztuk). Dużą liczbę robi masowy import bibliotek royalty‑free:

- Bensound, Kevin MacLeod, Scott Buckley, Purple Planet, Audionautix — łącznie **23 400 utworów**, wszystkie bez `user_id` (nie należą do żadnego użytkownika)
- Utwory realnych twórców i generacji ze Studio (Jarosław Szafran, DaWi, Mr.Gregorius, GENESIS 2.0, GrouaRock, Lantana Everbleed, GrouAI Studio itd.) — **272 utwory**, wszystkie z `user_id`

Twoja intencja: zostawić tylko to, co naprawdę powstało przez platformę (Suno/Studio/uploady userów), reszta stockowa do kasacji, bez psucia UI.

## Co zrobię

### 1. Czyszczenie bazy (jedna operacja `DELETE`)

Skasuję wszystkie utwory bez `user_id` (`DELETE FROM tracks WHERE user_id IS NULL`). To dokładnie 23 406 utworów = cała paczka stockowa. Zachowane zostanie 272 utwory społeczności / Studio.

Najpierw posprzątam zależności, żeby nic nie pękło:
- `radio_schedule` — 8 wpisów wskazujących na utwory stockowe → usuwam te wpisy (harmonogram radia zostanie wygenerowany od nowa z dostępnych utworów)
- `listening_history` — 5 wpisów → usuwam
- `playlist_tracks`, `liked_songs`, `favorites`, `track_ratings`, `radio_likes` — 0 powiązań ze stockiem, bezpieczne

### 2. Zabezpieczenie UI po cięciu

Po usunięciu zostaną 272 utwory. Sekcje gatunkowe na stronie głównej trzeba dostosować, żeby nie było pustych pasków:

| Sekcja | Dostępnych utworów |
|---|---|
| Pop, Rock, Hip-Hop, Electronic, Folk, Country, Indie, Jazz, „Inne odkrycia" | sprawdzę po cięciu i zostawię tylko te z ≥4 utworami |

Plan techniczny:
- `src/pages/Index.tsx` — po DELETE odpytam bazę, policzę utwory na gatunek i zostawię tylko sekcje, które mają sens (≥4 utwory). Reszta gatunków idzie do „Inne odkrycia" / „Nowości".
- `src/components/sections/GenreSection.tsx` — dorzucę warunek „nie renderuj sekcji jeśli brak utworów" (`return null` gdy lista pusta), żeby nigdy nie powstał pusty pasek.
- `src/components/sections/NewOnServer.tsx` — zostawiam, działa na `created_at desc` z dostępnego katalogu.
- Radio (`RadioLive`, `RadioEmbed`, `RadioStationManager`, `radioSchedule.ts`) — schedule jest generowany dynamicznie z `tracks`, więc po cięciu pójdzie po realnym katalogu. Sprawdzę, czy generator radia nie zakłada minimum X utworów; jeśli tak — obniżę próg do tego co mamy.

### 3. Weryfikacja

Po migracji:
1. `SELECT COUNT(*) FROM tracks` — powinno być ~272
2. Otworzę `/` w preview i sprawdzę, że żadna sekcja nie jest pusta i wszystkie okładki + audio_url ładują się
3. Otworzę `/radio` i sprawdzę, że timeline + „teraz gra" działa
4. Sprawdzę logi konsoli i sieci pod kątem 404 / pustych odpowiedzi

### Czego NIE robię

- Nie ruszam `studio_generations`, `user_voices`, `playlists`, paneli admina i radia jako UI — tylko dane + warunki renderowania pustych sekcji
- Nie ruszam żadnych ustawień autoryzacji, RLS, edge funkcji
- Nie usuwam utworów społeczności (nawet jeśli mają < 2:00 — to osobny temat)

## Detale techniczne

Kolejność migracji/operacji danych:
```sql
DELETE FROM radio_schedule WHERE track_id IN (SELECT id FROM tracks WHERE user_id IS NULL);
DELETE FROM listening_history WHERE track_id IN (SELECT id FROM tracks WHERE user_id IS NULL);
DELETE FROM tracks WHERE user_id IS NULL;
```

(wszystko przez `supabase--insert`, nie migracja — to operacje na danych, nie schemacie)

Po tym etapie minimalna edycja `Index.tsx` i `GenreSection.tsx` aby ukryć puste sekcje.
