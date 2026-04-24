

# 🛠 Fix „Wyślij do wszystkich" — masowa wysyłka mailowa

## Co jest zepsute (twardo z kodu i logów)

Logi edge function pokazują dokładnie:
```
mass-email-dispatch error: TypeError: (data || []).filter is not a function
at index.ts:332:33
```

Powód:
- `mass-email-dispatch` woła RPC `get_all_users_for_admin()` przez klienta **service-role** (`supaAdmin`).
- W tej funkcji w bazie pierwsza linia to `IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN json_build_object('error', 'unauthorized')`.
- Klient service-role nie ma JWT użytkownika → `auth.uid()` = `NULL` → `has_role(NULL, 'admin')` = `false` → RPC zwraca **obiekt** `{"error":"unauthorized"}`, a nie tablicę.
- Kod robi `(data || []).filter(...)` → crash → 500 → toast „Błąd masowej wysyłki" w UI.

Bonus bug: nawet gdyby autoryzacja przeszła, dla zera użytkowników `json_agg(...)` zwraca `NULL`, co też wywaliłoby `.filter`.

Admin został już zweryfikowany wcześniej w funkcji (linie 320–325) przez `has_role` z prawdziwym `user.id`, więc nie trzeba drugi raz sprawdzać uprawnień przez RPC.

## Plan naprawy (1 plik)

**Plik:** `supabase/functions/mass-email-dispatch/index.ts`

W bloku `else` (audience = `all_users`, ~linia 343–346) **zamiast** wołania zepsutego RPC:

1. **Pobierz userów bezpośrednio przez Supabase Admin API** — `supaAdmin.auth.admin.listUsers({ page, perPage: 1000 })` z paginacją w pętli aż do wyczerpania.
2. Zbierz `id` i `email` ze wszystkich stron, odfiltruj wpisy bez `email`.
3. **Pobierz `display_name` z `profiles`** jednym zapytaniem `in('user_id', ids)` i zmapuj na recipientów.
4. Zwróć `recipients = [{ email, name }]` — dokładnie taki kształt, jakiego oczekuje reszta funkcji.

Dodatkowe zabezpieczenia:
- `Array.isArray(data) ? data : []` jako twardy guard (gdyby kiedyś coś znów zwróciło nie-tablicę, nie wywali całego flow).
- Krótki log: ilu odbiorców wyciągnięto + ilu po filtrze suppressed (ułatwi przyszły debug).
- Jeśli odbiorców jest 0 → zwróć od razu `200 { success: true, recipientCount: 0, queued: 0 }` z toast info zamiast iść w generowanie obrazka i copy AI (oszczędność kredytów).

Po edycie funkcja edge automatycznie się zredeployuje.

## Czego NIE ruszamy

- `get_all_users_for_admin()` zostaje — używają go inne miejsca w panelu admina, gdzie jest wołany przez **klienta z JWT admina** (czyli działa poprawnie). Naprawiamy tylko jedno wywołanie z złego kontekstu.
- Nie trzeba żadnej migracji DB.
- Nie trzeba zmian w UI (`AdminEmailDashboard.tsx`) — bug jest 100% po stronie edge function.
- Tryb `n8n` i pojedynczy „test e-mail" nie były dotknięte tym bugiem — działały, dotykamy tylko ścieżki direct/all_users.

## Efekt po wdrożeniu

- Klik **„Wyślij do wszystkich (bezpośrednio)"** → pobranie wszystkich emaili → odfiltrowanie suppressed → wygenerowanie hero grafiki + copy AI per język → zakolejkowanie maila do każdego odbiorcy przez `send-transactional-email`.
- Toast pokaże `🚀 N odbiorców (zakolejkowano: N, błędy: 0)`.
- W tabeli „Logi e-maili" pojawią się wpisy `pending` → `sent` w czasie rzeczywistym (live subscription już działa).

