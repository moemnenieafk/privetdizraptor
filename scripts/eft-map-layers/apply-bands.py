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

if spec and spec.get('_todo'):
    print('%s: ⚠ %s' % (MAP, spec['_todo']))

layers = man.get('layers') or []

# ─────────────── ВЫСОТЫ ПОЛОС ИЗ СТАРОГО МАНИФЕСТА РАСТРА
#
# Рамку мы строим из геометрии (арт врал пиксельной сеткой), но ВЫСОТЫ полос в старых
# манифестах из растра — данные хорошие: они пришли из maps.json the-hideout и у части
# карт точнее конфига. У Таможни там 5 полос с отметками, у Ледокола 16 палуб
# (18.92-19.56, 19.57-22.1, ...), а в EFT_MAP_CONFIG у этих слоёв поля `height` НЕТ ВООБЩЕ.
#
# Без этого полоса получает heights=None, превращается в «всю карту» и все палубы выходят
# ОДИНАКОВЫМИ: Ледокол дал 14 слоёв по 1 110 экземпляров и 2.73 % каждый, Таможня — четыре
# слоя по 9 701. Считать это рабочим результатом нельзя.
#
# Поэтому: если у не-главных полос высот нет, а в старом манифесте они есть — берём
# ОТТУДА весь layers[] целиком (id и высоты), а рамку оставляем геометрическую.
RASTER_MAN = os.path.join('D:/Games/raster', MAP, 'manifest.json')
need = [L for L in layers if not L.get('isMain') and not L.get('heights')]
if need and os.path.exists(RASTER_MAN):
    try:
        old_layers = json.load(open(RASTER_MAN, encoding='utf-8')).get('layers') or []
    except Exception:
        old_layers = []
    old_ok = [L for L in old_layers if L.get('heights')]
    if old_ok:
        print('  %d полос без высот -> беру layers[] из старого манифеста растра (%d полос с высотами)'
              % (len(need), len(old_ok)))
        layers = [dict(id=L['id'], name=L.get('name') or L['id'],
                       heights=L.get('heights'), isMain=bool(L.get('isMain')))
                  for L in old_layers]
        if not any(L['isMain'] for L in layers) and layers:
            layers[0]['isMain'] = True
        man['layers'] = layers
elif need:
    print('  ⚠ %d полос БЕЗ ВЫСОТ и старого манифеста нет — они дадут одинаковые слои'
          % len(need))

by_id = {L['id']: L for L in layers}
changed = []

if not spec:
    # Поправок нет, но подстановка высот выше могла поменять layers[] — сохранить обязательно.
    man['layers'] = layers
    json.dump(man, open(MAN, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('%s: поправок нет; полос %d' % (MAP, len(layers)))
    for L in layers:
        print('   %-14s %-30s heights=%s' % (L['id'], str(L.get('name'))[:30], L.get('heights')))
    sys.exit(0)

# `replace` — выбросить полосы манифеста и поставить свои. Нужен там, где старые полосы
# не дополняются, а ОТМЕНЯЮТСЯ: у Резерва единственная полоса бункеров [-10000, -7.27]
# стояла не на том уровне и её надо убрать, а не дополнить (иначе она осталась бы
# и продолжала тянуть помещения в наземный слой).
if spec.get('replace'):
    layers[:] = [{k: v for k, v in b.items() if not k.startswith('_')}
                 for b in spec['replace']]
    by_id.clear()
    by_id.update({L['id']: L for L in layers})
    changed.append('ПОЛОСЫ ЗАМЕНЕНЫ ЦЕЛИКОМ (%d шт: %s)'
                   % (len(layers), ', '.join(L['id'] for L in layers)))

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
