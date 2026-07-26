# Automatyzacja faktur — Aurora + n8n + Discord

Kompletny, gotowy do włączenia obieg faktur B2B. Aurora/Paddle wystawia zdarzenie
→ edge function buduje fakturę → Discord dostaje powiadomienie → n8n robi PDF,
wysyła mailem i archiwizuje.

```
Zamówienie (Aurora / Paddle)
      │
      ▼
aurora-invoice-bot (edge function)  ──►  Discord (#faktury)  [embed z podsumowaniem]
      │  event: invoice.created
      ▼
n8n workflow  ──►  HTML→PDF (Gotenberg)  ──►  Discord (PDF w załączniku)
      │
      └──►  send-transactional-email  ──►  klient dostaje fakturę mailem
```

## 1. „Programik do faktur" — czym generujemy PDF

Nie potrzeba płatnego programu. Używamy open-source **Gotenberg** (Docker) do
zamiany HTML faktury na PDF. Faktura (numer, VAT 23%, pozycje, dane stron) jest
budowana po naszej stronie w `aurora-invoice-bot`, więc Gotenberg tylko renderuje.

Uruchomienie Gotenberga (jedna komenda):
```bash
docker run --rm -p 3000:3000 gotenberg/gotenberg:8
```
Ustaw potem w n8n zmienną `GOTENBERG_URL=http://gotenberg:3000` (albo adres Twojego hosta).

> Alternatywa, jeśli chcesz pełny system fakturowy z księgą: **Invoice Ninja**
> (też open-source, ma API i node w n8n). Wtedy w workflow zamień węzeł
> „HTML → PDF" na wywołanie API Invoice Ninja `POST /api/v1/invoices`. Reszta
> obiegu (Discord + e-mail) zostaje bez zmian.

## 2. Discord — kanał #faktury

1. Discord → ustawienia serwera → **Integracje → Webhooki → Nowy webhook**,
   wskaż kanał `#faktury`, skopiuj URL.
2. Wklej ten URL jako sekret **`DISCORD_INVOICE_WEBHOOK_URL`** w:
   - Supabase → Settings → Secrets (dla `aurora-invoice-bot`),
   - n8n → zmienne środowiskowe (dla węzła „Wyślij PDF na Discord").

`aurora-invoice-bot` wysyła od razu **embed z podsumowaniem** (kto, za co, ile,
termin). n8n dosyła później **PDF w załączniku**.

## 3. Sekrety (Supabase → Settings → Secrets)

| Sekret | Do czego |
|--------|----------|
| `DISCORD_INVOICE_WEBHOOK_URL` | powiadomienia na Discord |
| `N8N_INVOICE_WEBHOOK_URL` | adres webhooka n8n (fallback: `N8N_WEBHOOK_URL`) |
| `INVOICE_SELLER_JSON` | (opcjonalnie) dane sprzedawcy: `{"name":"...","address":"...","nip":"...","email":"...","iban":"..."}` |

`SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` są ustawione domyślnie.

## 4. Baza — tabela `invoices`

Migracja `supabase/migrations/20260724090000_invoices.sql` tworzy tabelę
`invoices` (numeracja `FV/RRRR/MM/NNN`, netto/VAT/brutto, status, HTML). RLS jest
włączony — dostęp tylko przez `service_role` (edge functions).

## 5. Import workflow do n8n

1. n8n → **Workflows → Import from File** → `docs/n8n-workflows/invoice-automation.json`.
2. Ustaw zmienne środowiskowe n8n: `GOTENBERG_URL`, `DISCORD_INVOICE_WEBHOOK_URL`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Aktywuj workflow. Skopiuj URL webhooka (`.../webhook/grouaistream-invoice`) i
   wstaw go jako `N8N_INVOICE_WEBHOOK_URL` w Supabase.

## 6. Jak wywołać (test)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/aurora-invoice-bot" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Firma XYZ Sp. z o.o.",
    "client_email": "biuro@xyz.pl",
    "client_nip": "5252525252",
    "service_type": "SEO Audit",
    "amount_net": 149,
    "currency": "PLN"
  }'
```

Odpowiedź zawiera pełną fakturę (`invoice`) i status dostarczenia
(`delivered.discord`, `delivered.n8n`). Na Discordzie pojawi się embed, a n8n
(jeśli podłączony) dośle PDF i maila.

## 7. Podpięcie pod realne zdarzenia

- **Po akceptacji zlecenia B2B** (panel admina / `aurora-approve-action`):
  wywołaj `aurora-invoice-bot` z danymi z `aurora_business_orders`.
- **Po płatności Paddle** (`payments-webhook` / Paddle webhook): wywołaj
  `aurora-invoice-bot` ze statusem opłacone, żeby wystawić fakturę końcową.

Punkty wywołania są celowo rozdzielone — proforma przy zamówieniu, faktura VAT
po płatności.
