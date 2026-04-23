

# GrouAI Studio — "wpisz po ludzku, dostań muzykę"

## Problem teraz
- Czat tylko gada, nie generuje (brak tool-calling)
- Router idzie przez n8n — pojedynczy punkt awarii
- AI nie rozumie naturalnego języka 4 językach

## Co budujemy

**Jeden edge function `studio-prompt-engine`** — mózg, który zamienia "zrób mi smutną piosenkę o miłości po polsku, 2 minuty, gitarą" → strukturalny plan → wywołanie odpowiedniego silnika → gotowe audio w bibliotece.

### Architektura

```text
User pisze (PL/EN/NL/UK)
        ↓
[studio-prompt-engine]  ← NOWY edge function
        ↓
   Lovable AI (Gemini 3 Pro)
   z TOOL CALLING — wymusza JSON:
   {
     genre, subgenre, mood, bpm, key,
     duration_seconds, instrumental,
     has_vocals, vocal_gender, language,
     lyrics_theme, reference_artists,
     engine_recommendation
   }
        ↓
   Auto-router (bez n8n):
   - wokal + długie → Suno
   - krótkie premium wokal → ElevenLabs
   - instrumental / tanio → MusicGen
        ↓
   Bezpośrednie wywołanie istniejących funkcji:
   suno-generate / elevenlabs-music / replicate-musicgen
        ↓
   Zapis do studio_generations + tracks
        ↓
   Stream postępu do UI (SSE)
```

### Klucze techniczne

1. **Tool calling** — Gemini ZWRACA structured output przez `tools` + `tool_choice`, nie zwykły JSON (gwarancja poprawności pól)
2. **Multilingual NLU** — system prompt rozpoznaje PL/EN/NL/UK automatycznie po wpisie
3. **Fallback bez n8n** — `studio-prompt-engine` wywołuje silniki bezpośrednio przez `supabase.functions.invoke`. n8n staje się opcjonalny
4. **Smart defaults** — jeśli user nie podał BPM/key, AI dobiera typowe dla gatunku (np. trap=140, ambient=70)
5. **Walidacja Zod** dla payloadu z AI (zabezpieczenie przed halucynacjami)

### Frontend

Nowy komponent `<MusicPromptBox>` na `/suno` (i opcjonalnie `/`) — jedno duże pole tekstowe w stylu Suno:

```
┌─────────────────────────────────────────────┐
│ 🎵 Powiedz mi co zagrać...                  │
│                                             │
│ "smutny lo-fi z deszczem, 90 BPM, 2 minuty" │
│                                             │
│ [PL] [EN] [NL] [UK]   [⚙ Ustawienia]  [▶] │
└─────────────────────────────────────────────┘

Po kliknięciu ▶:
  → Spinner "Rozumiem co chcesz..." (AI parsing)
  → "Komponuję..." (engine call) z animacją fal
  → Auto-play + zapis do biblioteki
  → Sugestia: "Zrobić wersję z wokalem?" / "Dłuższą?"
```

### Pliki do stworzenia/zmiany

| Plik | Akcja |
|---|---|
| `supabase/functions/studio-prompt-engine/index.ts` | **NOWY** — mózg parser + router |
| `src/components/studio/MusicPromptBox.tsx` | **NOWY** — UI jednego pola |
| `src/components/studio/GenerationProgress.tsx` | **NOWY** — animowany progress |
| `src/pages/Suno.tsx` | dodać `<MusicPromptBox />` na górze |
| `supabase/functions/studio-router/index.ts` | dodać fallback gdy n8n nie odpowiada → przekierowanie do `studio-prompt-engine` |

### Co zostaje bez zmian
- `suno-generate`, `replicate-musicgen`, `elevenlabs-music` (silniki — działają)
- `studio-chat` (czat zostaje jak jest, dla rozmów typu "wytłumacz mi BPM")
- Tabela `studio_generations` (schemat OK)

### Model AI
- **Parsing promptu**: `google/gemini-3-flash-preview` — szybkie, świetne w structured output, multilingual
- Opcjonalnie ciężkie przypadki (długi opis): `google/gemini-3.1-pro-preview`

### Po wdrożeniu
1. Wpisujesz po polsku/holendersku/angielsku/ukraińsku → AI rozumie
2. Wyciąga gatunek, BPM, mood, długość, wokal/instrumental
3. Sam wybiera silnik (Suno dla wokalu, MusicGen dla tanich instrumentali, ElevenLabs dla krótkich premium)
4. Pokazuje postęp i puszcza utwór w playerze
5. Działa bez n8n (n8n staje się opcjonalnym dodatkiem)

