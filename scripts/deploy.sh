#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# npm run deploy — пуш + триггер деплоя Coolify ОДНОЙ командой.
#
# Почему по SSH, а не вебхуком: вебхук Coolify (порт 8000) закрыт файрволом Timeweb
# снаружи — осознанный харденинг (docs/decisions/done/hosting-autonomy-migration.md).
# API Coolify жив на localhost:8000 → дёргаем его изнутри VPS скриптом /root/cta-deploy.sh.
# Coolify собирает ветку main. Ключ остаётся только на этой машине (в репо не попадает).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VPS="root@201.51.20.217"
KEY="$HOME/.ssh/cta_hetzner_ed25519"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ ! -f "$KEY" ]; then
  echo "✗ Нет SSH-ключа: $KEY" >&2
  exit 1
fi

if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Ты на ветке '$BRANCH', а Coolify собирает main."
  echo "    Триггер соберёт ТЕКУЩИЙ main на origin, а не эту ветку. Смёржь в main и запусти снова."
fi

echo "→ git push origin $BRANCH"
git push origin "$BRANCH"

echo "→ триггер деплоя Coolify (по SSH)"
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$VPS" '/root/cta-deploy.sh'

echo ""
echo "✓ Деплой в очереди. Билд идёт на сервере ~несколько минут → https://cta.quest"
echo "  (Coolify свапает контейнер только на успешном билде — прод не упадёт при ошибке сборки.)"
