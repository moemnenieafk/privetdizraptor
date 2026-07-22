#!/usr/bin/env bash
# Vercel "Ignored Build Step" — решает, нужен ли билд.
# Контракт Vercel: exit 0 = SKIP (билд пропускается), любой ≠0 = BUILD.
#
# Политика: билдим, если с последнего успешного деплоя изменилось что-то
# КРОМЕ docs/ и CHANGELOG.md (заметки-валта и автолог коммитов ребилд не требуют —
# экономим билд-минуты и egress, а заодно автокоммит бота `update-changelog` больше
# не вытесняет ещё летящий прод-билд фичи, помечая его failure).
#
# Почему не inline `git diff HEAD^ HEAD` (эволюция, см. docs/decisions/done/vercel-skip-docs-builds.md):
#  v1  `HEAD^..HEAD` видел только вершину пуша → docs-коммит на вершине прятал
#      код под собой (яма 2026-07-01: ff-мерж спринта → прод не собрался).
#  v2  `$VERCEL_GIT_PREVIOUS_SHA..HEAD` берёт весь диапазон пуша, но Vercel
#      клонирует shallow → далёкий PREV мог отсутствовать (`fatal: bad object`).
#  v3  (этот скрипт) — тот же диапазон + подтягиваем PREV, если его нет в клоне.

set -u

PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"

# Первый деплой ветки — предыдущего нет → билдим.
if [ -z "$PREV" ]; then
  echo "[vercel-ignore] нет PREVIOUS_SHA (первый деплой) → BUILD"
  exit 1
fi

# Shallow-clone может не содержать PREV. Пытаемся точечно, затем углубляем историю.
if ! git cat-file -e "${PREV}^{commit}" 2>/dev/null; then
  echo "[vercel-ignore] $PREV нет в shallow-клоне — fetch…"
  git fetch --depth=1 origin "$PREV" 2>/dev/null \
    || git fetch --unshallow 2>/dev/null \
    || true
fi

# Всё ещё недоступен → fail-safe BUILD (лишний билд лучше пропущенного нужного).
if ! git cat-file -e "${PREV}^{commit}" 2>/dev/null; then
  echo "[vercel-ignore] $PREV недоступен даже после fetch → fail-safe BUILD"
  exit 1
fi

# Изменилось ли что-то вне docs/ и CHANGELOG.md? diff --quiet: exit 0 = нет (SKIP), 1 = есть (BUILD).
if git diff --quiet "$PREV" HEAD -- \
    ':(exclude)docs/' ':(exclude)CHANGELOG.md' \
    ':(exclude).github/' ':(exclude).gitignore' \
    ':(exclude)scripts/encode-bg-patterns.sh' ':(exclude)scripts/vercel-ignore.sh'; then
  echo "[vercel-ignore] с $PREV изменились только docs/CHANGELOG/CI-файлы → SKIP"
  exit 0
else
  echo "[vercel-ignore] есть изменения, влияющие на сборку → BUILD"
  exit 1
fi
