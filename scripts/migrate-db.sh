#!/usr/bin/env bash
# Przeniesienie bazy GrouAI ze starego projektu (Lovable) do nowego projektu Supabase.
#
# Uruchamiaj z maszyny, która ma dostęp do hostów db.<ref>.supabase.co (port 5432).
# Sandbox agenta takiego dostępu nie ma. Wymaga: pg_dump / pg_restore / psql (PostgreSQL 15+).
#
# Użycie:
#   OLD_DB_URL='postgresql://postgres:HASLO@db.bvstvawnigyczvofzhps.supabase.co:5432/postgres' \
#   NEW_DB_URL='postgresql://postgres:HASLO@db.sbmfliylgpqyteezrrtn.supabase.co:5432/postgres' \
#   bash scripts/migrate-db.sh
#
# Hasła podajesz tylko w swoim terminalu — nie w czacie ani w repo.
set -euo pipefail

: "${OLD_DB_URL:?Ustaw OLD_DB_URL (stara baza)}"
: "${NEW_DB_URL:?Ustaw NEW_DB_URL (nowa baza grouaistream-prod)}"

WORK="${WORK_DIR:-./db-migration}"
mkdir -p "$WORK"
DUMP="$WORK/grouai-$(date +%Y%m%d-%H%M%S).dump"

echo "1/4 Sprawdzam, że nowa baza jest pusta (schemat public)…"
TABLES=$(psql "$NEW_DB_URL" -tAc "select count(*) from information_schema.tables where table_schema='public'")
if [ "$TABLES" != "0" ]; then
  echo "STOP: nowa baza nie jest pusta (public ma $TABLES tabel). Przerywam, żeby niczego nie nadpisać." >&2
  exit 1
fi

echo "2/4 Zrzut starej bazy (schematy public + auth, z danymi)…"
pg_dump "$OLD_DB_URL" \
  --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth \
  --file="$DUMP"
echo "    zapisano: $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "3/4 Odtwarzanie w nowej bazie…"
pg_restore --dbname="$NEW_DB_URL" --no-owner --no-privileges --exit-on-error "$DUMP" \
  || { echo "Odtwarzanie przerwane — zobacz błąd powyżej. Nowa baza może być w połowie wypełniona." >&2; exit 1; }

echo "4/4 Kontrola: liczby wierszy w kluczowych tabelach"
for t in tracks profiles radio_schedule radio_config; do
  printf "    %-16s old=%s new=%s\n" "$t" \
    "$(psql "$OLD_DB_URL" -tAc "select count(*) from public.$t" 2>/dev/null || echo '-')" \
    "$(psql "$NEW_DB_URL" -tAc "select count(*) from public.$t" 2>/dev/null || echo '-')"
done
echo "    auth.users     old=$(psql "$OLD_DB_URL" -tAc 'select count(*) from auth.users' 2>/dev/null || echo '-') new=$(psql "$NEW_DB_URL" -tAc 'select count(*) from auth.users' 2>/dev/null || echo '-')"

cat <<'NEXT'

GOTOWE. Co dalej (po Twojej stronie):
  1. Edge Functions: wdróż je do nowego projektu (supabase functions deploy) i ustaw im sekrety
     (SUNO_API_KEY, OPENROUTER_API_KEY itd.) — sekrety NIE przenoszą się automatycznie.
  2. Vercel → grouaistream-com → Environment Variables (Production):
       VITE_SUPABASE_URL              = https://sbmfliylgpqyteezrrtn.supabase.co
       VITE_SUPABASE_PUBLISHABLE_KEY  = (klucz anon nowego projektu)
     i zrób redeploy.
  3. Sprawdź: grouaistream.com/api/health → db:"up", logowanie, radio.
NEXT
