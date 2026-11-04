# Rejestr decyzji — GrouAI

Format: data · decyzja · uzasadnienie · kto zdecydował.

| Data | Decyzja | Uzasadnienie | Kto |
| --- | --- | --- | --- |
| 2026-11-04 | Praca według ADLC z poziomami autonomii L0–L4 (master prompt v2). Nic nie trafia na `main` (produkcję) bez zgody Grzegorza | Push na `main` wdraża produkcję od razu; brak stagingu i testów w CI | Grzegorz |
| 2026-11-04 | Audyt L0 przeprowadzony; wyniki w `docs/audit/2026-11-audit.md` i `docs/agent-todo.md` | Zadanie inicjalne z §3 promptu | Grzegorz (zgoda), agent (wykonanie) |
| 2026-11-04 | Lovable omijać całkowicie: żadnych narzędzi Lovable (ani agenta `send_message`, ani zapytań SQL `query_database`). Odczyt bazy produkcyjnej tylko przez endpointy diagnostyczne na Vercelu (klucz anon), pełny dostęp SQL dopiero po migracji na własny Supabase (MCP Supabase) | Koszt kredytów i uniezależnienie od Lovable | Grzegorz |
