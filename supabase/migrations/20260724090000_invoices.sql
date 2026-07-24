-- Faktury generowane automatycznie przez aurora-invoice-bot
create table if not exists public.invoices (
  id            bigserial primary key,
  number        text not null,
  order_id      text,
  client_email  text,
  client_name   text,
  service_type  text,
  currency      text not null default 'PLN',
  net           numeric(12,2) not null default 0,
  vat           numeric(12,2) not null default 0,
  gross         numeric(12,2) not null default 0,
  status        text not null default 'issued',  -- issued | paid | cancelled
  html          text,
  pdf_url       text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_invoices_created on public.invoices(created_at);
create index if not exists idx_invoices_number  on public.invoices(number);
create index if not exists idx_invoices_status  on public.invoices(status);

-- RLS: dostęp tylko przez service_role (edge functions). Brak polityk = brak dostępu publicznego.
alter table public.invoices enable row level security;
