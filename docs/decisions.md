# Rejestr decyzji — GrouAI

Format: data · decyzja · uzasadnienie · kto zdecydował.

| Data | Decyzja | Uzasadnienie | Kto |
| --- | --- | --- | --- |
| 2026-11-04 | Praca według ADLC z poziomami autonomii L0–L4 (master prompt v2). Nic nie trafia na `main` (produkcję) bez zgody Grzegorza | Push na `main` wdraża produkcję od razu; brak stagingu i testów w CI | Grzegorz |
| 2026-11-04 | Audyt L0 przeprowadzony; wyniki w `docs/audit/2026-11-audit.md` i `docs/agent-todo.md` | Zadanie inicjalne z §3 promptu | Grzegorz (zgoda), agent (wykonanie) |
| 2026-11-04 | Lovable omijać całkowicie: żadnych narzędzi Lovable (ani agenta `send_message`, ani zapytań SQL `query_database`). Odczyt bazy produkcyjnej tylko przez endpointy diagnostyczne na Vercelu (klucz anon), pełny dostęp SQL dopiero po migracji na własny Supabase (MCP Supabase) | Koszt kredytów i uniezależnienie od Lovable | Grzegorz |
| 2026-11-04 | Sklep GrouaRock bez Lovable: zamówienia w `aurora_business_orders` (typ `shop`) przez Vercel `api/shop-checkout`, płatność Stripe Checkout (klucz w Vercel). Paddle wyłączony dla sklepu | Tabele `shop_orders`/`gift_codes` nie istnieją w prod, a migracja wymaga Lovable; Paddle zabrania towarów fizycznych | Grzegorz („zrób, aby funkcjonował”), agent (wybór rozwiązania) |
| 2026-11-04 | Sklep w 3 językach (PL/EN/NL); płatność także przelewem na konto Revolut; faktury w `aurora_invoices`, VAT według `SHOP_VAT_MODE` (OSS/krajowy/zwolnienie); sprzedaż tylko w UE | Prośba Grzegorza; ZAŁOŻENIE: sprzedaż B2C, bez odwrotnego obciążenia dla firm z UE | Grzegorz |
| 2026-11-04 | Sklep jako pośrednik: odzież i dodatki drukuje i wysyła Printful (API), gadżety AI dostawca e-mailowy; po opłaceniu automatyczne e-maile do klienta i na grouarock@gmail.com; przelew na Revolut (konto + @grouaaistream) | Prośba Grzegorza; Printful ma produkcję w UE i API; e-maile przez Resend/Brevo (HTTP, działa na edge) | Grzegorz |
| 2026-11-05 | Radio publiczne na autopilocie (ramówka godzinowa, weekend Disco/Electronic/Hip-Hop, bez powtórek, bramka jakości) zamiast grafiku z bazy; grafik ręczny dalej dostępny (tryb `manual`) | Prośba Grzegorza „automatyzacja radia”; bez migracji bazy (logika w kodzie, deterministyczna dla wszystkich słuchaczy) | Grzegorz |
