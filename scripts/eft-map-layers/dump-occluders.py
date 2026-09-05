# -*- coding: utf-8 -*-
"""Геометрия-РЕЗАК для рендера объектов: всё, что может загораживать камни и растения сверху.

Зачем. Рендер камней ничего не знает о мире: он рисует камень целиком, даже если основание
закопано в склон, а сверху крыша. При сборке карты это видно сразу — камень лежит поверх
здания. Лечится не правилами в 2D, а честной сценой: кладём геометрию мира в рендер
НЕВИДИМОЙ (Blender Holdout) и она срезает ровно то, что физически выше по лучу камеры.

Почему ВСЯ геометрия, а не класс `building`. Ветки `BUILDING` в иерархии BSG нет у половины
карт: у Леса и Развязки зданий по классу НОЛЬ, у Резерва 308 против 65 367 `props` —
постройки там падают в `props`. Фильтр по классу на этих картах не срезал бы ничего.

На выход — тот же формат, что у dump-stones.py, чтобы render-objects.py переиспользовал
свою же машинерию преобразования осей и не заводил второго источника правды.

usage: python dump-occluders.py <EscapeFromTarkov_Data> <map> <manifest> <outdir>
                                [--keep-plants] [--max-span 0.7]
"""
import json
import os
import re
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeom as mg                                                  # noqa: E402

t_start = time.time()


def log(msg):
    print('[%6.1fs] %s' % (time.time() - t_start, msg), flush=True)


def die(msg):
    print('ОШИБКА: %s' % msg, file=sys.stderr)
    sys.exit(1)


def opt(flag, default=None):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if flag in ('--keep-plants',):
            return True
        return sys.argv[i + 1]
    return default


ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(ARGS) < 4:
    die(__doc__.strip().splitlines()[-2].strip())
DATA, MAP_ID, MAN_PATH, OUTDIR = ARGS[0], ARGS[1], ARGS[2], ARGS[3]
KEEP_PLANTS = '--keep-plants' in sys.argv
MAX_SPAN = float(opt('--max-span', 0.7))

# Словари те же, что в cut-obstacles.py: камни и растения — это ВИДИМЫЕ слои,
# резать ими самих себя нельзя.
STONE_RX = re.compile(r'stone|rock|kamen|boulder|cliff', re.I)
STONE_NOT_RX = re.compile(r'rocket|rockwool|tombstone', re.I)
PLANT_RX = re.compile(r'(?<![A-Za-z])(tree|bush|pine|spruce|birch|oak|maple|fir|shrub|foliage|'
                      r'leaf|leaves|vetk|kust|derev|palm|reed|fern|hedge|plant|nettle|burdock|'
                      r'wolf|sapling)(?![A-Za-z])', re.I)
PLANT_NOT_RX = re.compile(r'(planter|plantation|plant_pot|power_?plant|plant_station)', re.I)
SKIP_SCENE = re.compile(r'(terrain|sound|culling|background)', re.I)

DROPPED = {'камни': 0, 'растения': 0}


def classify(path, name):
    """Резаком считаем ВСЁ, кроме того, что сами рендерим видимым."""
    if STONE_RX.search(name) and not STONE_NOT_RX.search(name):
        DROPPED['камни'] += 1
        return None
    if not KEEP_PLANTS and PLANT_RX.search(name) and not PLANT_NOT_RX.search(name):
        DROPPED['растения'] += 1
        return None
    return 'occluder'


FR = mg.Frame(MAN_PATH)
log('рамка %s: %dx%d px, %.2f см/px' % (MAP_ID, FR.W, FR.H, FR.mpp * 100))
XMIN, XMAX, ZMIN, ZMAX = FR.XMIN, FR.XMAX, FR.ZMIN, FR.ZMAX
SPAN_X, SPAN_Z = XMAX - XMIN, ZMAX - ZMIN

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')
SCENES, skipped = mg.scene_list(SCENES_JSON, MAP_ID, DATA, SKIP_SCENE)

inst = []
for lvl, nm in SCENES:
    try:
        sc = mg.Scene(DATA, lvl)
    except Exception as ex:
        log('  %s (%s): ОШИБКА чтения — %s' % (lvl, nm, ex))
        continue
    got = mg.collect_meshes(sc, classify)
    inst += got
    log('  %-9s %-46s экземпляров %6d' % (lvl, nm, len(got)))
    del sc
log('сцен пропущено: %d %s' % (len(skipped), skipped))
log('экземпляров-кандидатов всего %d (отсеяно своим: камни %d, растения %d)'
    % (len(inst), DROPPED['камни'], DROPPED['растения']))

# ── отбор по рамке + защита от гигантов ───────────────────────────────────────
# ⚠️ КУПОЛ НЕБА. На картах EFT встречается меш размером во всю сцену (он же однажды залил
# 97 % кадра в слое препятствий). Резаком такой меш накрыл бы карту целиком и слой камней
# вышел бы ПУСТЫМ при бодрых счётчиках — ровно тот сорт вранья, который тут ловится тяжело.
# Поэтому всё, что шире `--max-span` рамки по ОБЕИМ осям, выбрасывается и называется вслух.
MESHES = mg.MeshCache(DATA, keep=3)
log('считаю габариты по m_LocalAABB…')
keep, giants, nobox = [], [], 0
for i, (src, pid, pos, rot, scl, cls, name, br) in enumerate(inst):
    a = MESHES.aabb(src, pid)
    if a is None:
        nobox += 1
        continue
    b = mg.world_box(a, pos, rot, scl)
    if b[3] < XMIN or b[0] > XMAX or b[5] < ZMIN or b[2] > ZMAX:
        continue
    if (b[3] - b[0]) > MAX_SPAN * SPAN_X and (b[5] - b[2]) > MAX_SPAN * SPAN_Z:
        giants.append((name, round(b[3] - b[0]), round(b[5] - b[2])))
        continue
    keep.append((src, pid, pos, rot, scl, name))
    if i and i % 20000 == 0:
        log('  %d / %d' % (i, len(inst)))
log('в рамке %d из %d (без габарита %d)' % (len(keep), len(inst), nobox))
if giants:
    log('ВЫБРОШЕНЫ ГИГАНТЫ (шире %.0f %% рамки по обеим осям), %d шт: %s'
        % (MAX_SPAN * 100, len(giants), giants[:6]))

# ── геометрия уникальных мешей ────────────────────────────────────────────────
os.makedirs(OUTDIR, exist_ok=True)
npzdir = os.path.join(OUTDIR, 'occl-meshes')
os.makedirs(npzdir, exist_ok=True)
protos, out_inst = {}, []
uniq = {}
for src, pid, pos, rot, scl, name in keep:
    uniq.setdefault((src, pid), name)
log('уникальных мешей к чтению: %d' % len(uniq))

key_of, failed = {}, 0
for n, ((src, pid), name) in enumerate(uniq.items()):
    r = MESHES.mesh(src, pid)
    if r is None:
        failed += 1
        continue
    V, F = r
    key = 'occl_%s_%s' % (os.path.splitext(os.path.basename(src))[0], pid)
    npz = os.path.join(npzdir, key + '.npz')
    if not os.path.exists(npz):
        np.savez_compressed(npz, v=V.astype(np.float32), t0=F.astype(np.int32))
    protos[key] = dict(npz=npz, submeshes=1, verts=int(len(V)), tris=int(len(F)))
    key_of[(src, pid)] = key
    if n and n % 500 == 0:
        log('  прочитано %d / %d' % (n, len(uniq)))
    MESHES.evict(src)
log('мешей прочитано %d, не удалось %d' % (len(protos), failed))

for src, pid, pos, rot, scl, name in keep:
    key = key_of.get((src, pid))
    if key is None:
        continue
    out_inst.append(dict(mesh=key, x=float(pos[0]), y=float(pos[1]), z=float(pos[2]),
                         quat=[float(v) for v in rot], scale=[float(v) for v in scl]))

out = dict(map=MAP_ID, generated=time.strftime('%Y-%m-%dT%H:%M:%S'),
           source='dump-occluders.py — геометрия-резак (holdout) для рендера объектов',
           frame=dict(W=FR.W, H=FR.H, XMIN=XMIN, XMAX=XMAX, ZMIN=ZMIN, ZMAX=ZMAX),
           maxSpan=MAX_SPAN, giantsDropped=giants[:20],
           protos=protos, instances=out_inst)
op = os.path.join(OUTDIR, '%s-occluders.json' % MAP_ID)
json.dump(out, open(op, 'w', encoding='utf-8'), ensure_ascii=False)
tot_v = sum(p['verts'] for p in protos.values())
log('ЗАПИСАНО: %s — прототипов %d (%s вершин), экземпляров %d'
    % (op, len(protos), format(tot_v, ',').replace(',', ' '), len(out_inst)))
