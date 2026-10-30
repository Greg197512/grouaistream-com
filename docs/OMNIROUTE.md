# OmniRoute i słuchowiska radia — uruchomienie

## Co jest w repo
- `deploy/omniroute/docker-compose.yml` — OmniRoute jako osobna usługa (nie na Vercel).
- `supabase/functions/_shared/chatGateway.ts` — bramka czatu. Gdy ustawione są
  `OMNIROUTE_BASE_URL` i `OMNIROUTE_API_KEY`, używa OmniRoute (model `OMNIROUTE_MODEL`,
  domyślnie `auto`). W przeciwnym razie Gemini, potem OpenRouter.
- `supabase/functions/radio-drama/index.ts` — słuchowisko co 3 godziny w PL, EN, NL, UA.

## Zmienne (Supabase → Edge Functions → Secrets)
| Zmienna | Co robi |
|---|---|
| `OMNIROUTE_BASE_URL` | adres OmniRoute, np. `https://omniroute.twojadomena.pl` |
| `OMNIROUTE_API_KEY` | klucz utworzony w panelu OmniRoute |
| `OMNIROUTE_MODEL` | opcjonalnie, domyślnie `auto` |
| `RADIO_DRAMA_ENABLED` | `1` włącza generowanie. Bez tego funkcja nic nie robi |
| `RADIO_DRAMA_SECRET` | sekret w nagłówku `x-cron-secret`, wymagany przez funkcję |

## Harmonogram (co 3 godziny)
Supabase → SQL Editor (uruchom dopiero po ustawieniu sekretów). Wartości `<...>` uzupełnij:

```sql
select cron.schedule(
  'radio-drama-3h',
  '0 */3 * * *',
  $$ select net.http_post(
       url := '<SUPABASE_URL>/functions/v1/radio-drama',
       headers := jsonb_build_object('x-cron-secret', '<RADIO_DRAMA_SECRET>', 'Content-Type', 'application/json'),
       body := '{}'::jsonb
     ) $$
);
```

Wymaga włączonych rozszerzeń `pg_cron` i `pg_net`.

## Koszty
Każde uruchomienie to 4 scenariusze (LLM) i 4 nagrania TTS, czyli 8 odcinków dziennie.
Głos to darmowy Edge TTS. Przed włączeniem ustal limit wydatków u dostawców w OmniRoute.

## Stan
Nie uruchomiono i nie wdrożono: brak kluczy dostawców, brak hostowanego OmniRoute,
brak wdrożonej funkcji `radio-drama`, brak harmonogramu. Odtwarzanie w radiu
nie zostało jeszcze podpięte pod nowe pliki (działa przez `radio_schedule`).
