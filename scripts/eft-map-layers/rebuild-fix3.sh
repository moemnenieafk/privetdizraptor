#!/bin/bash
cd /c/cta-project
FRAMES="D:/eft-export/frames"
LOG=/d/eft-export/night-logs-2026-09-04/REBUILD-FIX3.log
: > "$LOG"
STEPS="frame,zone,roads,stones,walls,obstacles"

for M in terminal icebreaker; do
  echo "" >> "$LOG"; echo "######## $M ($(date +%H:%M:%S)) ########" >> "$LOG"
  python scripts/eft-map-layers/apply-bands.py "$M" "$FRAMES/$M/manifest.json" >> "$LOG" 2>&1
  python scripts/eft-map-layers/run-all.py "$M" --raster-root "$FRAMES" --only "$STEPS" --force-step "$STEPS" >> "$LOG" 2>&1
  echo "### $M код=$? ($(date +%H:%M:%S))" >> "$LOG"
done

echo "" >> "$LOG"; echo "######## customs ($(date +%H:%M:%S)) ########" >> "$LOG"
python scripts/eft-rooms/dump-rooms.py "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" customs D:/eft-export/customs >> "$LOG" 2>&1
python scripts/eft-terrain/make-manifest.py customs "$FRAMES" 16384 --from-rooms D:/eft-export/customs/customs-rooms.json >> "$LOG" 2>&1
python scripts/eft-map-layers/apply-bands.py customs "$FRAMES/customs/manifest.json" >> "$LOG" 2>&1
python scripts/eft-map-layers/run-all.py customs --raster-root "$FRAMES" --only "$STEPS" --force-step "$STEPS" >> "$LOG" 2>&1
echo "### customs код=$? ($(date +%H:%M:%S))" >> "$LOG"
echo "" >> "$LOG"; echo "======== ГОТОВО $(date +%H:%M:%S) ========" >> "$LOG"
