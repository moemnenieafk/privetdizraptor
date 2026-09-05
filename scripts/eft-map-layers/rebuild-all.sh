#!/bin/bash
# Пересборка всех карт от геометрии: рамка -> поправки полос -> слои.
cd /c/cta-project
FRAMES="D:/eft-export/frames"
LOG=/d/eft-export/night-logs-2026-09-04/REBUILD-ALL.log
: > "$LOG"

# карты с террейном (можно растительность и рендер) и без него
WITH_TERRAIN="customs lighthouse reserve interchange shoreline woods"
NO_TERRAIN="streets-of-tarkov ground-zero terminal icebreaker"

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
