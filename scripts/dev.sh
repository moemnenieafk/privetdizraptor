#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ОДНА КОМАНДА ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ: SSH-туннель к БД на VPS + Next.js dev.
#
# Зачем: порт БД 5432 закрыт наружу (CLAUDE.md §13). Локальный dev ходит в боевую
# базу ТОЛЬКО через шифрованный SSH-туннель. Нет туннеля → любая страница/ручка с
# БД отдаёт 500 (не-DB страницы 200). Этот скрипт поднимает туннель и запускает dev.
#
# Запуск:
#   • VS Code: Ctrl+Shift+B  (или Terminal → Run Task → «▶ Dev + туннель БД»)
#   • Терминал: npm run dev:tunnel   ИЛИ   bash scripts/dev.sh
#
# Требует git-bash (Windows). Ctrl+C гасит и dev, и туннель (если поднимал его сам).
# ─────────────────────────────────────────────────────────────────────────────
set -u

KEY="$HOME/.ssh/cta_hetzner_ed25519"       # приватный SSH-ключ к VPS
VPS="root@201.51.20.217"                    # Timeweb VPS (Амстердам)
DB="supabase-db-ebq1smxegyuwgj6j7tgqhdjq"   # имя docker-контейнера БД (IP ищем динамически)

# Корень проекта = папка на уровень выше этого скрипта (работает из любого места).
PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TUN=""
# Туннель уже поднят другим окном? Переиспользуем, свой не открываем.
if netstat -ano 2>/dev/null | grep -qE "127\.0\.0\.1:5432 .*LISTENING"; then
  echo "✓ туннель на 127.0.0.1:5432 уже поднят — переиспользую"
else
  echo "→ ищу IP контейнера БД на VPS…"
  IP=$(ssh -i "$KEY" -o StrictHostKeyChecking=no "$VPS" \
    "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $DB")
  if [ -z "$IP" ]; then
    echo "✗ не нашёл IP supabase-db. Проверь: VPS доступен? SSH-ключ на месте ($KEY)?"
    exit 1
  fi
  echo "→ поднимаю туннель 127.0.0.1:5432 → $IP:5432 …"
  ssh -i "$KEY" -o StrictHostKeyChecking=no -N -L "127.0.0.1:5432:$IP:5432" "$VPS" &
  TUN=$!
  # Закрыть туннель при выходе (Ctrl+C / завершение dev).
  trap '[ -n "$TUN" ] && kill "$TUN" 2>/dev/null; echo "✓ туннель закрыт"' EXIT
  sleep 2
  echo "✓ туннель поднят (pid $TUN)"
fi

echo "→ запускаю Next.js dev в $PROJ …"
cd "$PROJ" && npm run dev
