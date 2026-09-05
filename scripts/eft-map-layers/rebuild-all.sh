#!/bin/bash
# Пересборка всех карт от геометрии: рамка -> поправки полос -> слои.
cd /c/cta-project
FRAMES="D:/eft-export/frames"
LOG=${LOG:-/d/eft-export/night-logs-2026-09-04/REBUILD-ALL.log}
# RESUME=1 — дописывать в лог и не терять запись уже закрытых карт
[ -n "$RESUME" ] || : > "$LOG"

# ЗАМОК: два пакета, пишущих в один каталог gen/<карта>, портят выход друг друга.
# Так уже случилось 05.09: прогон 02:50 пережил свою сессию, второй стартовал поверх
# и обе Развязки писались вперемешку. mkdir атомарен — годится как замок.
LOCKDIR=/tmp/cta-rebuild-all.lock
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "ОТКАЗ: пакет уже идёт (замок $LOCKDIR, pid $(cat "$LOCKDIR/pid" 2>/dev/null))." >&2
  echo "Если это призрак прошлой сессии — проверь процессы и сними замок: rm -rf $LOCKDIR" >&2
  exit 3
fi
echo $$ > "$LOCKDIR/pid"
trap 'rm -rf "$LOCKDIR"' EXIT INT TERM

# карты с террейном (можно растительность и рендер) и без него
# списки переопределяются из окружения — так пакет перезапускается с места обрыва
WITH_TERRAIN=${WITH_TERRAIN-"customs lighthouse reserve interchange shoreline woods"}
NO_TERRAIN=${NO_TERRAIN-"streets-of-tarkov ground-zero terminal icebreaker"}

run_map () {
  local M=$1; local STEPS=$2
  echo "" >> "$LOG"
  echo "################ $M  ($(date +%H:%M:%S)) ################" >> "$LOG"
  python scripts/eft-terrain/make-manifest.py "$M" "$FRAMES" 16384 >> "$LOG" 2>&1
  python scripts/eft-map-layers/apply-bands.py "$M" "$FRAMES/$M/manifest.json" >> "$LOG" 2>&1
  python scripts/eft-map-layers/run-all.py "$M" --raster-root "$FRAMES" \
      --only "$STEPS" --force-step "$STEPS" >> "$LOG" 2>&1
  echo "### $M ЗАВЕРШЕНА код=$? ($(date +%H:%M:%S))" >> "$LOG"
}

for M in $WITH_TERRAIN; do
  run_map "$M" "frame,zone,roads,stones,walls,obstacles,vegetation,render"
done
for M in $NO_TERRAIN; do
  run_map "$M" "frame,zone,roads,stones,walls,obstacles"
done
echo "" >> "$LOG"
echo "======== ПАКЕТ ЗАВЕРШЁН $(date +%H:%M:%S) ========" >> "$LOG"
