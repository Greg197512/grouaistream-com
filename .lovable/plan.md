

# ☕ "Włącz krany" — kawa w PlayerBar + tip-jar na każdym utworze

## Co dziś jest, a czego brakuje

| Element | Stan |
|---|---|
| `BuyCoffeeButton` (Paddle, real money, 1€/3€/5€, z `recipientUserId` + `recipientTrackId`) | ✅ istnieje, ale **nigdzie nie używany przy utworach** |
| `TipModal` w PlayerBar (portfel wewnętrzny, doładowywany przez admina) | ✅ działa, **zostaje bez zmian** |
| Real-money kawa dla aktualnie granego utworu | ❌ brak |
| Real-money kawa z poziomu listy utworów (Liked, Recently Played, Queue, wyniki wyszukiwania) | ❌ brak |
| Sprawdzenie, że Paddle webhook poprawnie zapisuje `recipientTrackId`/`recipientUserId` i nabija `creator_earnings` typu `tip` | ❓ do weryfikacji |

## Co dokładnie zrobię

### 1. Kawa w PlayerBar (obok obecnego serduszka tipa)
W `src/components/layout/PlayerBar.tsx` obok przycisku `DollarSign` (TipModal z portfela) dodam **drugi mikro-przycisk z ikoną `Coffee`** — odpalający `BuyCoffeeButton` z parametrami aktualnego utworu:

```
recipientUserId  = currentTrack.uploaded_by  (lub creator_id)
recipientTrackId = currentTrack.id
recipientName    = currentTrack.artist
```

Wizualnie: bursztynowy mikro-IconButton (`text-amber-400/70`), tooltip „Postaw kawę twórcy ☕ (1€ / 3€ / 5€)". Otwiera istniejący Dialog z 3 opcjami → Paddle Checkout → po sukcesie toast „☕ wysłano kawę dla {artist}".

**Różnica vs istniejący 💲 tip:**
- 💲 = portfel wewnętrzny (saldo, bez wypłaty) — istniejące
- ☕ = realne € z karty przez Paddle, 90% trafia do twórcy do wypłaty — **nowe**

### 2. „Tip-jar na każdym utworze" — przez TrackOptionsMenu
W `src/components/menus/TrackOptionsMenu.tsx` (używany w TrackRow, RecentlyPlayed, Queue, Liked, Search wyniki — czyli **wszędzie gdzie jest utwór**) dodam nowy item w dropdownie:

```
☕  Postaw kawę twórcy   →  otwiera BuyCoffeeButton dialog
```

Item pojawia się tylko gdy utwór ma `uploaded_by/creator_id` ≠ aktualny user (nie można fundować kawy samemu sobie — taką regułę webhook i tak musi mieć, ale ukrywam item żeby nie kusić).

Aby uniknąć duplikacji, wyrenderuję `BuyCoffeeButton` **bez własnego buttona** — wyciągnę z niego logikę dialogu do małego sub-komponentu `CoffeeDialog` (otwierany kontrolowanym `open`/`onOpenChange`), a w obu miejscach (PlayerBar item, TrackOptionsMenu item) podpinam tylko trigger.

### 3. Weryfikacja flow Paddle → DB → twórca
- Sprawdzę edge function `payments-webhook` że dla `transaction.completed` z `priceId IN (grouai_coffee_*)`:
  - zapisuje wpis do `one_time_purchases` (już jest)
  - **nabija `creator_earnings`** typu `tip` z `amount = 0.9 * price` na `recipientUserId` z `customData`
  - emituje `agent_event` typu `tip.received` (pojawi się w dzwoneczku notyfikacji — `useNotificationsFeed` już to obsługuje)
- Jeśli czegoś brakuje — dopiszę do webhook. Jeśli już jest — tylko potwierdzę.

### 4. Drobny FX po sukcesie
Po powrocie z Paddle z `?coffee=success` w URL — istniejący już handler pokaże toast. Dorzucę tylko **floating coffee emoji** (analogiczny do `FloatingHearts`) wokół coveru utworu, jeśli utwór wciąż gra — żeby było widać efekt „strumienia kawy".

## Co użytkownik dostaje

1. **W PlayerBar** dwa mikro-przyciski przy każdym graniu: 💲 (tip z portfela) + ☕ (real-money kawa)
2. **W KAŻDEJ liście utworów** (Liked, Recently Played, Search, Queue, Albumy) — w trzykropku „⋯" nowa opcja **„Postaw kawę twórcy"**
3. **Twórca dostaje 90%** każdej kawy do wypłaty (creator_earnings type=`tip`) i widzi powiadomienie w dzwoneczku
4. **Ty (admin)** zobaczysz nowe wpływy w panelu Break-even MTD od pierwszej kawy

## Szczegóły techniczne (dla mnie do wykonania)

- **Plik nowy**: `src/components/payments/CoffeeDialog.tsx` — rozbity dialog z `BuyCoffeeButton` (kontrolowany open/close)
- **Refaktor**: `BuyCoffeeButton.tsx` → używa `CoffeeDialog` (zachowany API)
- **Edycja**: `src/components/layout/PlayerBar.tsx` — drugi przycisk + state `showCoffeeDialog`
- **Edycja**: `src/components/menus/TrackOptionsMenu.tsx` — DropdownMenuItem „☕ Postaw kawę twórcy" + state `showCoffeeDialog`, props rozszerzone o `trackOwnerId?: string`
- **Edycja consumerów TrackOptionsMenu** (TrackRow, RecentlyPlayed, QueueSidebar, FullscreenPlayer) — przekazanie `trackOwnerId` z danych utworu (kolumna `uploaded_by` w `catalog`)
- **Weryfikacja edge function**: `supabase/functions/payments-webhook/index.ts` — branch dla coffee priceId → insert `creator_earnings` + emit `agent_event`
- **Brak nowych migracji** — `creator_earnings` i `one_time_purchases` już istnieją

