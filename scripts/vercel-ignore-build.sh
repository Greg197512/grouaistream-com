#!/usr/bin/env bash
# =============================================================================
# Vercel "Ignored Build Step" — pomija build, gdy commit NIE dotyka niczego, co
# wpływa na produkcyjną paczkę. Oszczędza Build CPU Minutes.
#
# Ustaw w każdym projekcie: Settings → Git → Ignored Build Step → "Run my command":
#     bash scripts/vercel-ignore-build.sh
#
# Konwencja Vercel: exit 1 = BUDUJ, exit 0 = POMIŃ build.
# Zasada bezpieczeństwa: w razie wątpliwości BUDUJEMY (nigdy nie pomijamy
# prawdziwej zmiany kodu).
# =============================================================================
set -u

# 1) Zawsze buduj, gdy nie mamy historii do porównania (shallow clone itp.).
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "Brak HEAD^ (płytki klon) → BUDUJ"
  exit 1
fi

CHANGED="$(git diff --name-only HEAD^ HEAD 2>/dev/null)"
if [ $? -ne 0 ] || [ -z "$CHANGED" ]; then
  echo "Brak/niepusty diff → BUDUJ"
  exit 1
fi

# 2) Wzorce plików, które NIE wpływają na produkcyjny build (można pominąć):
#    dokumentacja, testy, stories, konfiguracja lint/format, meta repo.
IGNORE_RE='(^|/)(README|LICENSE|CHANGELOG|DOKUMENTACJA)([.-].*)?(\.md)?$'
IGNORE_RE="$IGNORE_RE|\.md$|^docs/|^\.github/|^\.vscode/|^\.idea/"
IGNORE_RE="$IGNORE_RE|^\.storybook/|\.stories\.[jt]sx?$|\.(test|spec)\.[jt]sx?$"
IGNORE_RE="$IGNORE_RE|^tests?/|^e2e/|(^|/)__tests__/|(^|/)__mocks__/"
IGNORE_RE="$IGNORE_RE|^\.eslintrc|(^|/)\.eslintrc|^eslint\.config\.|\.prettier|^\.editorconfig$"
IGNORE_RE="$IGNORE_RE|^\.gitignore$|^\.gitattributes$|^\.nvmrc$"

# 3) Jeśli KTÓRYKOLWIEK zmieniony plik NIE pasuje do wzorca „ignoruj" → BUDUJ.
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if ! printf '%s\n' "$f" | grep -Eq "$IGNORE_RE"; then
    echo "Zmiana wpływająca na build: $f → BUDUJ"
    exit 1
  fi
done <<EOF
$CHANGED
EOF

echo "Zmiany tylko w dokumentacji/testach/konfiguracji → POMIŃ build"
exit 0
