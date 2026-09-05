# -*- coding: utf-8 -*-
# Применяет поправки полос этажей (floor-bands.json) к манифесту, собранному make-manifest.py.
#
# ЗАЧЕМ. `make-manifest.py` строит `layers[]` из EFT_MAP_CONFIG, но конфиг писался под фильтр
# МАРКЕРОВ, а не под резку геометрии. Часть полос там непригодна: у Берега «подземелье»
# [-1000,-5] накрывает 98 % рельефа (карта в основном море), у Терминала полос нет вовсе
# и слой стен молча не делал НИЧЕГО. Поправки выведены из геометрии клиента и живут
# в `floor-bands.json` рядом — с обоснованием на каждую. Держать их в манифесте на диске
# нельзя: пересборка рамки их затирает.
#
# Запуск: python scripts/eft-map-layers/apply-bands.py <map> <manifest.json>
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if len(sys.argv) < 3:
    sys.exit('использование: python scripts/eft-map-layers/apply-bands.py <map> <manifest.json>')
MAP, MAN = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(HERE, 'floor-bands.json'), encoding='utf-8'))['maps'].get(MAP)
man = json.load(open(MAN, encoding='utf-8'))

if not spec:
    print('%s: поправок нет — полосы конфига как есть (%d)' % (MAP, len(man.get('layers') or [])))
    sys.exit(0)
if spec.get('_todo'):
    print('%s: ⚠ %s' % (MAP, spec['_todo']))

layers = man.get('layers') or []
by_id = {L['id']: L for L in layers}
changed = []

main = next((L for L in layers if L.get('isMain')), None)
if 'main' in spec and main is not None:
    for k, v in spec['main'].items():
        if k.startswith('_'):
            continue
        main[k] = v
        changed.append('main.%s' % k)

for lid, patch in (spec.get('patch') or {}).items():
    if lid not in by_id:
        print('  ! полосы «%s» в манифесте нет — поправка пропущена' % lid)
        continue
    for k, v in patch.items():
        if k.startswith('_'):
            continue
        by_id[lid][k] = v
        changed.append('%s.%s' % (lid, k))

for add in (spec.get('add') or []):
    add = {k: v for k, v in add.items() if not k.startswith('_')}
    if add['id'] in by_id:
        by_id[add['id']].update(add)
        changed.append('%s (обновлена)' % add['id'])
    else:
        layers.append(add)
        changed.append('%s (добавлена)' % add['id'])

# Порядок: наземная первой, затем по низу полосы — так читаются и логи, и имена файлов.
layers.sort(key=lambda L: (0 if L.get('isMain') else 1,
                           (L.get('heights') or [-1e9])[0]))
man['layers'] = layers
man['bandsNote'] = spec.get('_why', '') + ' | Поправки применены из floor-bands.json.'
json.dump(man, open(MAN, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('%s: применено %d поправок -> %s' % (MAP, len(changed), ', '.join(changed) or '—'))
for L in layers:
    print('   %-12s %-34s heights=%-16s minAbove=%-5s drop=%s'
          % (L['id'], str(L.get('name'))[:34], L.get('heights'),
             L.get('minAboveGround'), L.get('dropClasses')))
