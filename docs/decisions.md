# Rejestr decyzji — GrouAI

Format: data · decyzja · uzasadnienie · kto zdecydował.

| Data | Decyzja | Uzasadnienie | Kto |
| --- | --- | --- | --- |
| 2026-11-04 | Praca według ADLC z poziomami autonomii L0–L4 (master prompt v2). Nic nie trafia na `main` (produkcję) bez zgody Grzegorza | Push na `main` wdraża produkcję od razu; brak stagingu i testów w CI | Grzegorz |
| 2026-11-04 | Audyt L0 przeprowadzony; wyniki w `docs/audit/2026-11-audit.md` i `docs/agent-todo.md` | Zadanie inicjalne z §3 promptu | Grzegorz (zgoda), agent (wykonanie) |
| 2026-11-01 | Nie używać agenta Lovable (`send_message` zużywa kredyty). ZAŁOŻENIE do potwierdzenia: same zapytania SQL do bazy (`query_database`) są dozwolone, bo nie uruchamiają agenta | Koszt | Grzegorz |
