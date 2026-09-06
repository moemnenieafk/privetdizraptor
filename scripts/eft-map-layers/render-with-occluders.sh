#!/bin/bash
# Полный прогон рендера объектов С РЕЗАКОМ: мир (рельеф + вся геометрия сцены) кладётся
# в кадр невидимым и обрезает камни и растительность. Фон остаётся прозрачным.
#
# Порядок карт: сперва Лес (резак уже собран) и Резерв (там жалоба V4DYA
# «всё вперемешку» — плотная застройка), дальше остальные.
#
# Возобновляемо: дамп резака пропускается, если <map>-occluders.json уже есть.
# Пересобрать резак принудительно — снести его json.
cd /c/cta-project

CLIENT="D:/Games/Escape from Tarkov/EscapeFromTarkov_Data"
FRAMES="D:/eft-export/frames"
GEN="map-exports/OBJECTS-MAPS/gen"
BLENDER="C:/Program Files/Blender Foundation/Blender 5.1/blender.exe"
LOG=${LOG:-/d/eft-export/night-logs-2026-09-04/OCCLUDERS-ALL.log}
MAPS=${MAPS-"woods reserve interchange lighthouse shoreline customs ground-zero streets-of-tarkov"}
LAYERS=${LAYERS-"stones,vegetation"}

# ЗАМОК — та же авария, что 05.09 ночью: два пакета писали в один каталог.
LOCKDIR=/tmp/cta-occluders.lock
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "ОТКАЗ: прогон уже идёт (замок $LOCKDIR, pid $(cat "$LOCKDIR/pid" 2>/dev/null))." >&2
  echo "Если это призрак — проверь процессы и сними: rm -rf $LOCKDIR" >&2
  exit 3
fi
echo $$ > "$LOCKDIR/pid"
trap 'rm -rf "$LOCKDIR"' EXIT INT TERM

[ -n "$RESUME" ] || : > "$LOG"

for M in $MAPS; do
  echo "" >> "$LOG"
  echo "################ $M  ($(date +%H:%M:%S)) ################" >> "$LOG"
  WORK="D:/eft-export/$M/render-objects"
  OCCL="$WORK/$M-occluders.json"

  if [ ! -f "$OCCL" ]; then
    echo "--- дамп резака ($(date +%H:%M:%S))" >> "$LOG"
    python scripts/eft-map-layers/dump-occluders.py \
        "$CLIENT" "$M" "$FRAMES/$M/manifest.json" "$WORK" >> "$LOG" 2>&1
    if [ ! -f "$OCCL" ]; then
      echo "### $M ПРОПУЩЕНА: резак не собрался ($(date +%H:%M:%S))" >> "$LOG"
      continue
    fi
  else
    echo "--- резак уже есть, дамп пропущен" >> "$LOG"
  fi

  echo "--- рендер ($(date +%H:%M:%S))" >> "$LOG"
  python scripts/eft-map-layers/render-objects.py render --map "$M" \
      --client "$CLIENT" \
      --manifest "$FRAMES/$M/manifest.json" \
      --frame "$GEN/$M/rooms/$M-rooms-frame.json" \
      --stones "$GEN/$M/stones/$M-stones.json" \
      --veg "$GEN/$M/ground/$M-vegetation.json" \
      --work "$WORK" --out "$GEN/$M/render" --blender "$BLENDER" \
      --engine eevee --tile 2048 --layers "$LAYERS" \
      --ground auto --ground-mode holdout --occluders auto >> "$LOG" 2>&1
  echo "### $M ЗАВЕРШЕНА код=$? ($(date +%H:%M:%S))" >> "$LOG"

  # приёмка сразу: пустой слой при живых счётчиках — та же ловушка, что на Терминале
  python - "$M" >> "$LOG" 2>&1 <<'PY'
import sys, os, json
# stdout прогона живёт в cp1251, и '✖' его роняет UnicodeEncodeError — приёмка
# молча умирала ровно там, где должна была ругаться (Таможня 05.09). Только ASCII.
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
m = sys.argv[1]
fr = json.load(open('D:/eft-export/frames/%s/manifest.json' % m, encoding='utf-8'))['crop']
frame = (fr['width'], fr['height'])
base = 'map-exports/OBJECTS-MAPS/gen/%s/render' % m
for layer in ('stones', 'vegetation'):
    p = os.path.join(base, '%s-%s-render.png' % (m, layer))
    if not os.path.exists(p):
        print('  ПРИЁМКА %-11s НЕТ ФАЙЛА' % layer)
        continue
    im = Image.open(p).convert('RGBA')
    a = im.getchannel('A')
    nz = sum(a.histogram()[1:])
    pct = 100.0 * nz / (im.size[0] * im.size[1])
    flag = ''
    if im.size != frame:
        flag += '  [!] РАМКА %s != %s' % (im.size, frame)
    if nz == 0:
        flag += '  [!] СЛОЙ ПУСТ'
    print('  ПРИЁМКА %-11s %s непрозрачных %.3f %%%s' % (layer, im.size, pct, flag))
PY
done

echo "" >> "$LOG"
echo "======== ПАКЕТ ЗАВЕРШЁН $(date +%H:%M:%S) ========" >> "$LOG"
