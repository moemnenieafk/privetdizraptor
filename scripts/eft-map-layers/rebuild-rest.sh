#!/bin/bash
cd /c/cta-project
FRAMES="D:/eft-export/frames"
LOG=/d/eft-export/night-logs-2026-09-04/REBUILD-REST.log
: > "$LOG"
run_map () {
  echo "" >> "$LOG"; echo "################ $1  ($(date +%H:%M:%S)) ################" >> "$LOG"
  python scripts/eft-terrain/make-manifest.py "$1" "$FRAMES" 16384 >> "$LOG" 2>&1
  python scripts/eft-map-layers/apply-bands.py "$1" "$FRAMES/$1/manifest.json" >> "$LOG" 2>&1
  python scripts/eft-map-layers/run-all.py "$1" --raster-root "$FRAMES" --only "$2" --force-step "$2" >> "$LOG" 2>&1
  echo "### $1 ЗАВЕРШЕНА код=$? ($(date +%H:%M:%S))" >> "$LOG"
}
for M in interchange shoreline woods; do
  run_map "$M" "frame,zone,roads,stones,walls,obstacles,vegetation,render"
done
for M in streets-of-tarkov ground-zero terminal icebreaker; do
  run_map "$M" "frame,zone,roads,stones,walls,obstacles"
done
echo "" >> "$LOG"; echo "======== ОСТАТОК ЗАВЕРШЁН $(date +%H:%M:%S) ========" >> "$LOG"
