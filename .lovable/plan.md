## Cel
Przyciski trybów na stronie Radio (Chill, Energetic, Focus, Party) mają realnie zmieniać to, co gra stacja — dla wszystkich słuchaczy — używając AI do doboru utworów i n8n do orkiestracji.

## Jak to ma działać (flow)

```text
[User klika "Energetic"]
        │
        ▼
[Radio.tsx → edge: radio-mood-switch]  (sprawdza rolę admin/DJ)
        │
        ▼
[Webhook n8n: grouai-radio-mood]
        │
        ├── 1. Pobiera kandydatów z tabeli `tracks` (audio_url, genre, mood, energy)
        ├── 2. Lovable AI (gemini-3-flash) → scoring utworów do trybu (zwraca ranking 60-100 id)
        ├── 3. Filtr: min 2:00, brak duplikatów artysty pod rząd, miks gatunków
        ├── 4. POST do edge: `radio-apply-mood-schedule` (czyści ogon + wstawia 60 nowych pozycji)
        └── 5. Loguje do `agent_events` (mood.radio.switched)
        │
        ▼
[radio_config.mode = 'mood:energetic', started_at = now()]
[Realtime → wszyscy słuchacze widzą zmianę bez F5]
```

## Zakres zmian

### Frontend (`src/pages/Radio.tsx` + nowy komponent)
- Komponent `RadioMoodSwitcher` z 4 przyciskami (Chill / Energetic / Focus / Party) w neonowo-pomarańczowym stylu.
- Aktywny tryb podświetlony, loader podczas przełączania, toast "🎧 AI buduje nową playlistę…".
- Wywołuje edge `radio-mood-switch`. Tylko admin/DJ widzi przyciski przełączania globalnego (zwykli użytkownicy widzą tylko aktualny tryb jako badge "Now playing: Energetic").

### Edge Functions (nowe)
1. **`radio-mood-switch`** — wejściówka z frontu, weryfikuje JWT + rolę admin, woła webhook n8n z `mood` i tokenem serwisowym.
2. **`radio-apply-mood-schedule`** — callback z n8n; przyjmuje listę `track_ids`, czyści przyszłe pozycje (position > current), wstawia nowe, aktualizuje `radio_config.mode` i `started_at`.

### n8n Workflow (nowy: `GrouAI — Radio Mood Selector`)
- **Webhook** `/grouai-radio-mood` (POST, body: `{mood, requested_by}`).
- **HTTP Request** → Supabase REST: pobiera ~200 kandydatów z `tracks` (filtr `duration >= 120`, `audio_url is not null`, kolejność losowa/po popularności).
- **AI Agent** (Lovable AI Gateway, gemini-3-flash) z promptem per-mood:
  - Chill = ambient/acoustic/lo-fi, BPM 60-90, low energy
  - Energetic = rock/EDM/hip-hop, BPM 120-160, high energy
  - Focus = instrumental/lo-fi/post-rock, BPM 70-110, brak wokali dominujących
  - Party = dance/house/pop, BPM 110-135, high danceability
  - Zwraca JSON `{tracks: [{id, score, reason}]}` — top 60.
- **Code node** — deduplikacja artystów obok siebie, shuffle wewnątrz koszyków.
- **HTTP Request** → callback `radio-apply-mood-schedule` z listą ID.
- **OnError: continueRegularOutput** + log do `aurora_n8n_runs`.

### Baza danych (migracja)
- `radio_config`: dodać kolumnę `mode text` (już istnieje wg schema) — używamy wartości `'mood:chill'`, `'mood:energetic'`, `'mood:focus'`, `'mood:party'`, `'24h'` (default).
- Brak nowych tabel — wykorzystujemy istniejący `radio_schedule` i `agent_events`.

## Co użytkownik dostanie
- 4 przyciski na `/radio`, klik = realne przerzucenie stacji na nowy nastrój w ~5-10 sekund.
- AI tłumaczy w toaście dlaczego wybrało taki set ("Wieczorne wyciszenie, ambient z polskiej sceny indie…").
- Globalna zmiana dla wszystkich (jak chciałeś) — kontrola tylko dla admin/DJ.

## Po wdrożeniu (Twoje ręczne kroki w n8n)
- Otworzyć workflow, kliknąć "Activate".
- Sprawdzić że HTTP Request do Supabase ma działający Service Role w credentials (już używany w innych workflow).

Mogę zacząć budować?
