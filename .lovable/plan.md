## Cel

Zablokować upload plików/katalogów na **Media Serwer** dla użytkowników bez planu PRO. Free user widzi przycisk, ale po kliknięciu dostaje toast i zostaje przekierowany na `/pricing`.

Limit dla PRO pozostaje na **15 utworach** (jak teraz). Auto-kategoryzacja AI + generowanie okładek również tylko dla PRO.

## Co się zmieni

### 1. `src/components/modals/FileUploadModal.tsx`
- Dodać `useSubscription()` i odczytać `isPro`.
- Owinąć handlery `handleFileSelect`, `handleDrop`, `handleDragOver` w guard:
  - jeśli `!isPro` → `toast.error("Upload utworów wymaga planu PRO")` + `navigate("/pricing")` + `onClose()`.
- Wyszarzyć przyciski **„Wybierz pliki"** i **„+ Dodaj katalog"** dla Free (opacity, ikona kłódki obok napisów), ale nadal klikalne — żeby kliknięcie odpaliło toast + redirect (zgodnie z wybraną opcją „Toast + przekierowanie do /pricing").
- Strefa drag & drop dla Free: zmieniony tekst na **„🔒 Upload tylko dla PRO — kliknij, by zobaczyć cennik"**, kliknięcie/drop = redirect.
- Banner AI auto-kategoryzacji: dla Free zmienić tekst na **„✨ Auto-kategoryzacja AI i okładki — dostępne w PRO"**.

### 2. Backend — zabezpieczenie po stronie serwera
W edge function obsługującej upload (sprawdzę którą — `upload-track`, `process-upload` lub podobna w `supabase/functions/`):
- Dodać sprawdzenie aktywnej subskrypcji PRO przez `has_active_subscription(auth.uid())` lub query do `subscriptions` z filtrem `environment`.
- Zwrócić `403` z komunikatem `"PRO subscription required"` jeśli brak.
- Zachować obecny limit 15 utworów dla PRO.

To jest kluczowe — sam frontend nie wystarczy, bo można obejść UI.

### 3. Drobne UI w innych miejscach uploadu (jeśli istnieją)
- Sprawdzę `src/pages/Server.tsx` i `src/pages/LocalPlayer.tsx` — jeśli mają osobne wejścia do uploadu, dodać ten sam guard.

## Logika dla użytkownika

| Scenariusz | Zachowanie |
|---|---|
| Free user otwiera modal Upload | Modal się otwiera, przyciski wyszarzone z kłódką, banner mówi „Upload wymaga PRO" |
| Free user klika „Wybierz pliki" / „Dodaj katalog" / drop | Toast „Upload wymaga PRO" + redirect na `/pricing` + zamknięcie modala |
| PRO user | Wszystko działa jak teraz, limit 15 utworów |
| PRO user przekroczy 15 | Obecny komunikat o limicie (bez zmian) |

## Szczegóły techniczne

- `useSubscription` zwraca już `isPro` (z PaddleEnv-filtrowanej tabeli `subscriptions` + legacy + trial), więc nie trzeba nowej logiki.
- Toast: `import { toast } from "sonner"`.
- Redirect: `useNavigate()` z `react-router-dom` → `navigate("/pricing")`.
- Backend guard idzie do edge function — sprawdzę nazwę przed implementacją i użyję service role key + zapytania:
  ```sql
  SELECT 1 FROM subscriptions 
  WHERE user_id = $1 AND environment = $2 
    AND status IN ('active','trialing','past_due') 
    AND (current_period_end IS NULL OR current_period_end > now())
  ```
- Brak zmian w schemacie DB.
- Brak zmian w cenniku Paddle.

## Pliki do edycji

1. `src/components/modals/FileUploadModal.tsx` — guard + UI lock
2. `supabase/functions/<upload-handler>/index.ts` — server-side guard (nazwę zidentyfikuję na starcie implementacji)
3. Ewentualnie `src/pages/Server.tsx` jeśli ma osobny wpis uploadu