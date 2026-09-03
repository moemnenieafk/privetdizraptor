# -*- coding: utf-8 -*-
# ЕДИНЫЙ ЗАПУСК КОНВЕЙЕРА СЛОЁВ КАРТЫ EFT: одна карта — одна команда.
#
# Зачем. Слои карты собирают 13 отдельных скриптов с разными сигнатурами: у одного манифест
# карты третьим аргументом, у другого на том же месте манифест РАМКИ, у третьего флаги через
# пробел, у четвёртого argparse. Порядок между ними неочевиден и НЕ выводится из имён: главная
# ловушка — аффину «мир -> пиксель» (<map>-rooms-frame.json), от которой зависят дороги, камни
# и стены, производит слой КОМНАТ. Значит комнаты идут рано, а не «где-то в конце вместе с
# интерьером». На второй карте это гарантированный промах в порядке или в путях.
#
# Этот скрипт НИЧЕГО не считает сам (кроме шага recon) — он только зовёт существующие скрипты
# в правильном порядке, с правильными путями, и умеет не делать заново то, что уже лежит.
#
# ГРАФ ЗАВИСИМОСТЕЙ (жирные — обязательные, тонкие — «лучше с ними», скрипт отработает и без):
#
#   manifest ──┬──────────────────────────────────────────────────────────────┐
#              │                                                              │
#   terrain ───┼──> height ──> <map>-height-meters.npy ─┬─────────────────────┼──> zone ──┬──> roads
#              ├──> material                            └─(тонко)──> walls    │           └──> stones
#              └──> vegetation ──> <map>-vegetation.json ─────────────────────┼───────────────┐
#                                                                             │               │
#   rooms ──> <map>-rooms.json ──> frame (render-rooms) ──> <map>-rooms-frame.json ──> roads / stones /
#                                                                             walls / render <┘
#
# ШАГИ (человеческие имена, ими же оперируют --only/--skip/--from):
#   recon       разведка новой карты: что у неё есть и что придётся настраивать руками.
#               ДИАГНОСТИКА, не сборка; в дефолтный план не входит, ~15 с на карту.
#   manifest    make-manifest.py      — синтез manifest.json из EFT_MAP_CONFIG (если растра нет)
#   terrain     dump-terrain.py       — TerrainData из sharedassetsN -> <map>-terrain.bin + splat_*
#   height      build-heightmap.py    — карта высот (npy + 16-бит PNG + отмывка)
#   material    build-material.py     — материал поверхности из splat
#   vegetation  extract-vegetation.py — деревья/кусты поштучно + плотность травы
#   rooms       dump-rooms.py         — комнаты/двери/выходы/здания из сцен -> <map>-rooms.json
#   frame       render-rooms.py       — оверлей комнат И АФФИНА РАМКИ <map>-rooms-frame.json
#   zone        dump-zone.py          — граница игровой зоны + маска для клипа соседних слоёв
#   roads       dump-roads.py         — дорожное полотно (ест аффину рамки, не манифест карты!)
#   stones      dump-stones.py        — камни и скалы поштучно
#   walls       cut-walls.py          — стены зданий сечением по этажам
#   obstacles   cut-obstacles.py      — препятствия выше 1 м: ОДИН слой, рез по рельефу
#   render      render-objects.py all — Blender-рендер камней и растительности
#   gate        check-orientation-gate.py — гейт ориентации splat (диагностика, вне плана)
#   verify-bin  verify-terrain-bin.py — сверка .bin с эталоном Unity (нужен --ref-bin)
#   align       verify-alignment.py   — сверка привязки с эталонной картинкой (--align-ref/--align-mode)
#
# ПУТИ ПО УМОЛЧАНИЮ (все переопределяются флагами):
#   клиент        D:/Games/Escape from Tarkov/EscapeFromTarkov_Data   (--client)
#   манифесты     D:/Games/raster/<map>/manifest.json                 (--raster-root / --manifest)
#   промежуточное D:/eft-export/<map>/                                (--work)
#   выход         <репо>/map-exports/OBJECTS-MAPS/gen/<map>/<слой>/   (--out)
# Исторические места артефактов Таможни (D:/eft-export/customs-terrain.bin, splat_* в корне,
# D:/eft-export/customs-rooms/customs-rooms.json) РАСПОЗНАЮТСЯ как готовые — иначе резюме
# первой карты показало бы «ничего не сделано» и предложило пересобрать 25 ГБ.
#
# РЕЗЮМИРУЕМОСТЬ. Шаг, у которого все выходы на диске и не старше входов, пропускается со
# строкой «есть готовое». --force пересобирает всё запрошенное, --force-step a,b — точечно.
#
# КОДЫ ВОЗВРАТА: 0 всё хорошо · 1 упал обязательный шаг · 2 не прошёл preflight ·
#                3 ошибка вызова (неизвестная карта/шаг/несобираемый план)
#
# ПРИМЕРЫ:
#   python scripts/eft-map-layers/run-all.py customs --dry-run
#   python scripts/eft-map-layers/run-all.py lighthouse recon
#   python scripts/eft-map-layers/run-all.py lighthouse --only zone,roads --with-deps
#   python scripts/eft-map-layers/run-all.py customs --from walls --force
#
# Зависимости: UnityPy 1.25, numpy, Pillow (только для recon; сами шаги — внешние процессы),
# Blender зовётся как внешний процесс. Новых зависимостей не заводится.

import argparse
import collections
import glob
import json
import os
import re
import struct
import subprocess
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')
TERRAIN_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-terrain.json')

DEF_CLIENT = r'D:/Games/Escape from Tarkov/EscapeFromTarkov_Data'
DEF_RASTER = r'D:/Games/raster'
DEF_WORKROOT = r'D:/eft-export'
DEF_OUTROOT = os.path.join(REPO, 'map-exports', 'OBJECTS-MAPS', 'gen')
DEF_BLENDER = r'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe'

# id карты портала -> ключ группы сцен в реестре. Копия таблицы из dump-rooms.py/dump-zone.py:
# ключи — как их назвала BSG, с опечаткой shorline.
MAP2GROUP = {
    'customs': 'Custom', 'factory': 'Factory', 'woods': 'Woods', 'shoreline': 'shorline',
    'lighthouse': 'Lighthouse', 'interchange': 'Shopping_Mall', 'reserve': 'Reserve_Base',
    'the-lab': 'Laboratory', 'streets-of-tarkov': 'City', 'ground-zero': 'Sandbox',
    'labyrinth': 'Labyrinth', 'terminal': 'Terminal',
}
# Карты, которые ЯВНО описаны в dump-roads.py (у остальных там GENERIC-профиль вслепую).
ROADS_TUNED = ('customs', 'lighthouse')
# Карты, у которых в dump-rooms.py есть эталонные счётчики смоук-теста.
ROOMS_EXPECTED = ('customs',)


def log(*a):
    print(*a, flush=True)


def human(n):
    for unit, div in (('ГБ', 1 << 30), ('МБ', 1 << 20), ('КБ', 1 << 10)):
        if n >= div:
            return '%.1f %s' % (n / div, unit)
    return '%d Б' % n


def found(p):
    """Реально существующие файлы по шаблону: '*' раскрывается глобом, обычный путь
    возвращается ТОЛЬКО если он есть на диске. Пустой список = «этого нет»."""
    if not p:
        return []
    if '*' in p:
        return sorted(glob.glob(p))
    return [p] if os.path.exists(p) else []


def first_existing(candidates):
    """Первый существующий путь; если ни одного — первый из списка (место для записи)."""
    for c in candidates:
        if '*' in c:
            g = sorted(glob.glob(c))
            if g:
                return g[0]
        elif os.path.exists(c):
            return c
    return candidates[0]


def mtime(p):
    try:
        return os.path.getmtime(p)
    except OSError:
        return None


# ═══════════════════════════════════════════════════════════ контекст: все пути одной карты

class Ctx:
    def __init__(self, a):
        self.map = a.map
        self.client = os.path.abspath(a.client)
        self.raster_root = os.path.abspath(a.raster_root)
        self.manifest = os.path.abspath(a.manifest or os.path.join(self.raster_root, self.map, 'manifest.json'))
        self.work_root = os.path.abspath(a.work_root)
        self.work = os.path.abspath(a.work or os.path.join(self.work_root, self.map))
        self.out = os.path.abspath(a.out or os.path.join(DEF_OUTROOT, self.map))
        self.blender = a.blender
        self.width = a.width
        self.long_side = a.long_side
        self.locks = a.locks
        self.no_props = a.no_props
        self.engine = a.engine
        self.tile = a.tile
        self.render_layers = [s.strip() for s in a.render_layers.split(',') if s.strip()]
        self.ref_bin = a.ref_bin
        self.align_ref = a.align_ref
        self.align_mode = a.align_mode
        self.terrain_flags = [s.strip() for s in (a.terrain_flags or '').split(',') if s.strip()]
        self.allow_unresolved = a.allow_unresolved

        self.group = MAP2GROUP.get(self.map)
        self.scenes = self._scenes()
        self.terr = self._terrain_registry()
        if not self.terrain_flags and self.terr.get('neighbourSlices'):
            # У карты есть слайсы в чужих sharedassets (общая мировая сетка EFT, D08) —
            # без флага дампер их только напечатает строкой лога, и покрытие просядет.
            self.terrain_flags = ['with-neighbours']

    # ── реестры

    def _scenes(self):
        if not os.path.exists(SCENES_JSON) or not self.group:
            return []
        reg = json.load(open(SCENES_JSON, encoding='utf-8'))
        return list(reg.get(self.group, []))

    def _terrain_registry(self):
        if not os.path.exists(TERRAIN_JSON):
            return {}
        reg = json.load(open(TERRAIN_JSON, encoding='utf-8'))
        return dict(reg.get('maps', {}).get(self.map, {}))

    def scene_level(self, rx):
        """levelN сцены карты по регулярке имени (первое совпадение)."""
        for e in self.scenes:
            if re.search(rx, e['scene'], re.I):
                return e['level'], e['scene']
        return None, None

    # ── каталоги слоёв

    def d(self, layer):
        return os.path.join(self.out, layer)

    # ── ключевые артефакты (с распознаванием исторических мест)

    @property
    def terrain_bin(self):
        return first_existing([
            os.path.join(self.work, '%s-terrain.bin' % self.map),
            os.path.join(self.work_root, '%s-terrain.bin' % self.map),
        ])

    @property
    def splat_dir(self):
        for d in (self.work, self.work_root):
            if glob.glob(os.path.join(d, 'splat_*.bin')):
                return d
        return self.work

    @property
    def rooms_json(self):
        return first_existing([
            os.path.join(self.work, '%s-rooms.json' % self.map),
            os.path.join(self.work_root, '%s-rooms' % self.map, '%s-rooms.json' % self.map),
        ])

    @property
    def frame_json(self):
        return os.path.join(self.d('rooms'), '%s-rooms-frame.json' % self.map)

    @property
    def height_npy(self):
        return os.path.join(self.d('ground'), '%s-height-meters.npy' % self.map)

    @property
    def veg_json(self):
        return os.path.join(self.d('ground'), '%s-vegetation.json' % self.map)

    @property
    def zone_mask(self):
        return os.path.join(self.d('zone'), '%s-zone-mask.png' % self.map)

    @property
    def stones_json(self):
        return os.path.join(self.d('stones'), '%s-stones.json' % self.map)

    @property
    def shared_assets(self):
        """sharedassetsN.assets с TerrainData карты (из реестра террейнов, иначе по levelN сцены)."""
        sa = self.terr.get('sharedassets')
        if not sa:
            lvl, _ = self.scene_level(r'terrain')
            sa = 'sharedassets%d.assets' % lvl if lvl is not None else None
        return os.path.join(self.client, sa) if sa else None

    @property
    def shared_assets_all(self):
        """Свой файл ассетов + чужие, откуда пришли соседние слайсы (для растительности)."""
        paths = []
        own = self.shared_assets
        if own:
            paths.append(own)
        for fn in (self.terr.get('neighbourSlices', {}) or {}).get('dataIn', []):
            p = os.path.join(self.client, fn)
            if p not in paths:
                paths.append(p)
        return paths

    @property
    def terrain_level(self):
        lvl = self.terr.get('level')
        if lvl is None:
            lvl, _ = self.scene_level(r'terrain')
        return os.path.join(self.client, 'level%d' % lvl) if lvl is not None else None

    @property
    def base_art(self):
        return os.path.join(self.raster_root, self.map, '%s-main-8192.webp' % self.map)

    def manifest_layers(self):
        try:
            return json.load(open(self.manifest, encoding='utf-8')).get('layers') or []
        except Exception:
            return []


# ═══════════════════════════════════════════════════════════ описание шагов
# Шаг статически объявляет входы и выходы — это позволяет и построить план без запуска
# (--dry-run), и понять «шаг уже сделан», и внятно сказать «не хватает X, его делает шаг Y».

class Step:
    def __init__(self, name, title, deps=(), soft_deps=(), in_plan=True, freshness=True):
        self.name = name
        self.title = title
        self.deps = list(deps)              # обязательные предки (по имени шага)
        self.soft_deps = list(soft_deps)    # желательные предки: без них шаг отработает хуже
        self.in_plan = in_plan              # входит ли в дефолтный полный прогон
        self.freshness = freshness          # сверять mtime выхода со входом (см. SManifest)

    # переопределяются ниже
    def inputs(self, c):
        return []          # [(путь, обязателен?)]

    def outputs(self, c):
        return []          # первый — главный

    def argv(self, c):
        raise NotImplementedError


def py(script, *args):
    return [sys.executable, os.path.join(REPO, 'scripts', script)] + [str(a) for a in args]


class SManifest(Step):
    # freshness=False: манифест, собранный из настоящего растра (fetch-tiles.mjs), — эталон,
    # и make-manifest.py его НЕ перезаписывает ни при каком исходе. Сверять его mtime с mtime
    # eft-map-config.ts бессмысленно: любая правка конфига объявляла бы шаг «устаревшим»,
    # а прогон всё равно упирался бы в этот отказ. Есть манифест — шаг сделан; --force продавит.
    def inputs(self, c):
        return [(os.path.join(REPO, 'src', 'data', 'eft-map-config.ts'), True)]

    def outputs(self, c):
        return [c.manifest]

    def argv(self, c):
        return py('eft-terrain/make-manifest.py', c.map, c.raster_root, c.long_side)


class STerrain(Step):
    def inputs(self, c):
        return [(c.shared_assets, True), (c.terrain_level, True)]

    def outputs(self, c):
        return [c.terrain_bin, os.path.join(c.splat_dir, 'splat_*.bin')]

    def argv(self, c):
        return py('eft-terrain/dump-terrain.py', c.shared_assets, c.terrain_level,
                  c.work, c.map, *c.terrain_flags)


class SHeight(Step):
    def inputs(self, c):
        return [(c.terrain_bin, True), (c.manifest, True)]

    def outputs(self, c):
        g = c.d('ground')
        return [os.path.join(g, '%s-height-meters.npy' % c.map),
                os.path.join(g, '%s-height-16bit.png' % c.map),
                os.path.join(g, '%s-hillshade.png' % c.map)]

    def argv(self, c):
        return py('eft-terrain/build-heightmap.py', c.terrain_bin, c.manifest, c.d('ground'),
                  c.map, c.width)


class SMaterial(Step):
    def inputs(self, c):
        return [(os.path.join(c.splat_dir, 'splat_*.bin'), True), (c.terrain_bin, True),
                (c.manifest, True)]

    def outputs(self, c):
        g = c.d('ground')
        return [os.path.join(g, '%s-material.png' % c.map),
                os.path.join(g, '%s-material-index.npy' % c.map)]

    def argv(self, c):
        return py('eft-terrain/build-material.py', c.splat_dir, c.terrain_bin, c.manifest,
                  c.d('ground'), c.map, c.width)


class SVegetation(Step):
    def inputs(self, c):
        return [(c.shared_assets, True), (c.terrain_bin, True), (c.manifest, True)]

    def outputs(self, c):
        g = c.d('ground')
        return [os.path.join(g, '%s-vegetation.json' % c.map),
                os.path.join(g, '%s-vegetation.csv' % c.map),
                os.path.join(g, '%s-veg-density.png' % c.map)]

    def argv(self, c):
        a = py('eft-terrain/extract-vegetation.py', ','.join(c.shared_assets_all), c.terrain_bin,
               c.manifest, c.d('ground'), c.map)
        if c.allow_unresolved:
            a.append('allow-unresolved')
        return a


class SRooms(Step):
    def inputs(self, c):
        return [(c.client, True)]

    def outputs(self, c):
        return [c.rooms_json]

    def argv(self, c):
        return py('eft-rooms/dump-rooms.py', c.client, c.map, c.work)


class SFrame(Step):
    def inputs(self, c):
        return [(c.rooms_json, True), (c.manifest, True)]

    def outputs(self, c):
        # frame.json пишется ВСЕГДА, а поэтажные PNG/SVG — только если в манифесте есть слои
        # (у синтетического манифеста Маяка layers пуст, и это нормально: аффина всё равно будет).
        out = [c.frame_json]
        for lay in c.manifest_layers():
            out.append(os.path.join(c.d('rooms'), '%s-rooms-%s.svg' % (c.map, lay['id'])))
        return out

    def argv(self, c):
        a = py('eft-rooms/render-rooms.py', c.rooms_json, c.manifest, c.d('rooms'), c.map)
        if c.locks:
            a.append(c.locks)
        return a


class SZone(Step):
    def inputs(self, c):
        return [(c.client, True), (c.manifest, True), (c.height_npy, False)]

    def outputs(self, c):
        z = c.d('zone')
        return [os.path.join(z, '%s-zone-mask.png' % c.map),
                os.path.join(z, '%s-zone.svg' % c.map),
                os.path.join(z, '%s-zone.json' % c.map)]

    def argv(self, c):
        a = py('eft-map-layers/dump-zone.py', c.client, c.map, c.manifest, c.d('zone'))
        if os.path.exists(c.height_npy):
            a += ['--height', c.height_npy]
        return a


class SRoads(Step):
    def inputs(self, c):
        # ВНИМАНИЕ: третий аргумент dump-roads.py — манифест РАМКИ (rooms-frame.json),
        # а не manifest.json карты. Единственный скрипт конвейера с такой сигнатурой.
        return [(c.client, True), (c.frame_json, True), (c.zone_mask, False)]

    def outputs(self, c):
        r = c.d('roads')
        return [os.path.join(r, '%s-roads.svg' % c.map),
                os.path.join(r, '%s-roads.json' % c.map),
                os.path.join(r, '%s-roads.png' % c.map)]

    def argv(self, c):
        a = py('eft-map-layers/dump-roads.py', c.client, c.map, c.frame_json, c.d('roads'))
        if os.path.exists(c.zone_mask):
            a.append(c.zone_mask)
        return a


class SStones(Step):
    def inputs(self, c):
        return [(c.client, True), (c.manifest, True), (c.frame_json, False)]

    def outputs(self, c):
        s = c.d('stones')
        return [os.path.join(s, '%s-stones.json' % c.map),
                os.path.join(s, '%s-stones.svg' % c.map),
                os.path.join(s, '%s-stones.png' % c.map)]

    def argv(self, c):
        return py('eft-map-layers/dump-stones.py', c.client, c.map, c.manifest, c.d('stones'))


class SWalls(Step):
    def inputs(self, c):
        return [(c.client, True), (c.manifest, True), (c.frame_json, False), (c.height_npy, False)]

    def outputs(self, c):
        w = c.d('walls')
        out = [os.path.join(w, '%s-walls.json' % c.map)]
        for lay in c.manifest_layers():
            out.append(os.path.join(w, '%s-walls-%s.svg' % (c.map, lay['id'])))
        return out

    def argv(self, c):
        a = py('eft-map-layers/cut-walls.py', c.client, c.map, c.manifest, c.d('walls'))
        if os.path.exists(c.height_npy):
            a += ['--height', c.height_npy]
        if c.no_props:
            a.append('--no-props')
        return a


class SObstacles(Step):
    """Слой 7: препятствия выше 1 м, ОДИН слой, рез по рельефу (земля + 1 м).

    Карта высот здесь не «желательна», а обязательна: без неё поверхности реза не существует,
    и скрипт откажется — поэтому height в жёстких зависимостях, а не в мягких.
    """

    def inputs(self, c):
        return [(c.client, True), (c.manifest, True), (c.height_npy, True),
                (c.frame_json, False), (c.zone_mask, False)]

    def outputs(self, c):
        o = c.d('obstacles')
        return [os.path.join(o, '%s-obstacles.png' % c.map),
                os.path.join(o, '%s-obstacles.svg' % c.map),
                os.path.join(o, '%s-obstacles.json' % c.map)]

    def argv(self, c):
        a = py('eft-map-layers/cut-obstacles.py', c.client, c.map, c.manifest, c.d('obstacles'),
               '--height', c.height_npy)
        if os.path.exists(c.zone_mask):
            a += ['--zone', c.zone_mask]
        return a


class SRender(Step):
    def inputs(self, c):
        ins = [(c.frame_json, True), (c.manifest, True), (c.blender, True)]
        if 'stones' in c.render_layers:
            ins.append((c.stones_json, True))
        if 'vegetation' in c.render_layers:
            ins.append((c.veg_json, True))
        return ins

    def outputs(self, c):
        return [os.path.join(c.d('render'), '%s-%s-render.png' % (c.map, l)) for l in c.render_layers]

    def argv(self, c):
        sa = os.path.basename(c.shared_assets) if c.shared_assets else 'sharedassets17.assets'
        a = py('eft-map-layers/render-objects.py', 'all',
               '--map', c.map, '--client', c.client, '--manifest', c.manifest,
               '--frame', c.frame_json, '--stones', c.stones_json, '--veg', c.veg_json,
               '--veg-assets', sa, '--work', os.path.join(c.work, 'render-objects'),
               '--out', c.d('render'), '--blender', c.blender, '--engine', c.engine,
               '--tile', c.tile, '--layers', ','.join(c.render_layers))
        if os.path.exists(c.base_art):
            a += ['--base-art', c.base_art]
        return a


class SGate(Step):
    def inputs(self, c):
        return [(c.client, True)]

    def outputs(self, c):
        return []          # чистая диагностика, файлов не оставляет

    def argv(self, c):
        return py('eft-terrain/check-orientation-gate.py', c.client,
                  os.path.join(c.work, 'orient-gate'))


class SVerifyBin(Step):
    def inputs(self, c):
        return [(c.ref_bin or '', True), (c.terrain_bin, True)]

    def outputs(self, c):
        return []

    def argv(self, c):
        return py('eft-terrain/verify-terrain-bin.py', c.ref_bin, c.terrain_bin)


class SAlign(Step):
    def inputs(self, c):
        return [(c.d('ground'), True), (c.terrain_bin, True), (c.manifest, True),
                (c.align_ref or '', True)]

    def outputs(self, c):
        return []

    def argv(self, c):
        return py('eft-terrain/verify-alignment.py', c.d('ground'), c.terrain_bin, c.manifest,
                  c.map, c.align_ref, c.align_mode)


# Порядок объявления — только для разрешения ничьих в топологической сортировке.
STEPS = collections.OrderedDict((s.name, s) for s in [
    SManifest('manifest', 'манифест карты из EFT_MAP_CONFIG', freshness=False),
    STerrain('terrain', 'TerrainData -> .bin + splatmaps'),
    SHeight('height', 'карта высот', deps=['terrain', 'manifest']),
    SMaterial('material', 'материал поверхности', deps=['terrain', 'manifest']),
    SVegetation('vegetation', 'растительность', deps=['terrain', 'manifest']),
    SRooms('rooms', 'комнаты/двери/выходы из сцен'),
    SFrame('frame', 'оверлей комнат + АФФИНА РАМКИ', deps=['rooms', 'manifest']),
    SZone('zone', 'граница игровой зоны', deps=['manifest'], soft_deps=['height']),
    SRoads('roads', 'дорожное полотно', deps=['frame'], soft_deps=['zone']),
    SStones('stones', 'камни и скалы', deps=['manifest'], soft_deps=['frame']),
    SWalls('walls', 'стены зданий по этажам', deps=['manifest'], soft_deps=['frame', 'height']),
    SObstacles('obstacles', 'препятствия выше 1 м (один слой, рез по рельефу)',
               deps=['manifest', 'height'], soft_deps=['frame', 'zone']),
    SRender('render', 'Blender-рендер объектов', deps=['frame', 'stones', 'vegetation']),
    SGate('gate', 'гейт ориентации splat (диагностика)', in_plan=False),
    SVerifyBin('verify-bin', 'сверка .bin с эталоном Unity', soft_deps=['terrain'], in_plan=False),
    SAlign('align', 'сверка привязки с эталоном', soft_deps=['height'], in_plan=False),
])
STEP_ORDER = {n: i for i, n in enumerate(STEPS)}
ALL_NAMES = ['recon'] + list(STEPS)


# ═══════════════════════════════════════════════════════════ планировщик

def toposort(names):
    """Порядок из графа зависимостей, ничьи — по порядку объявления."""
    sel = set(names)
    ready, done, out = [], set(), []
    def deps_of(n):
        s = STEPS[n]
        return [d for d in (s.deps + s.soft_deps) if d in sel]
    pending = dict((n, set(deps_of(n))) for n in sel)
    while pending:
        ready = sorted([n for n, d in pending.items() if not d - done], key=lambda n: STEP_ORDER[n])
        if not ready:                       # цикла в графе быть не должно, но не молчим
            out += sorted(pending, key=lambda n: STEP_ORDER[n])
            break
        for n in ready:
            out.append(n)
            done.add(n)
            del pending[n]
    return out


def build_plan(a):
    """Выбор шагов из --only/--skip/--from/позиционных имён + топологический порядок."""
    if a.steps:
        want = list(a.steps)
    elif a.only:
        want = [s.strip() for s in a.only.split(',') if s.strip()]
    else:
        want = [n for n, s in STEPS.items() if s.in_plan]

    unknown = [w for w in want if w not in ALL_NAMES]
    if unknown:
        return None, 'неизвестные шаги: %s; известны: %s' % (', '.join(unknown), ', '.join(ALL_NAMES))

    if 'recon' in want:
        if len(want) > 1:
            return None, 'recon — отдельная диагностика, его не смешивают с шагами сборки'
        return ['recon'], None

    if a.from_step:
        if a.from_step not in STEPS:
            return None, 'шаг --from %s не известен' % a.from_step
        full = [n for n, s in STEPS.items() if s.in_plan]
        base = want if a.only or a.steps else full
        ordered = toposort([w for w in base if w in STEPS])
        if a.from_step not in ordered:
            ordered = toposort(list(set(ordered) | {a.from_step}))
        want = ordered[ordered.index(a.from_step):]

    if a.skip:
        drop = {s.strip() for s in a.skip.split(',') if s.strip()}
        bad = drop - set(ALL_NAMES)
        if bad:
            return None, 'нечего пропускать: %s' % ', '.join(sorted(bad))
        want = [w for w in want if w not in drop]

    if a.with_deps:                          # дотянуть обязательных предков запрошенного
        grow = set(want)
        changed = True
        while changed:
            changed = False
            for n in list(grow):
                for d in STEPS[n].deps + STEPS[n].soft_deps:
                    if d not in grow and STEPS[d].in_plan:
                        grow.add(d)
                        changed = True
        want = list(grow)

    if not want:
        return None, 'план пуст: всё запрошенное отфильтровано --skip'
    return toposort([w for w in want if w in STEPS]), None


# ═══════════════════════════════════════════════════════════ preflight

def preflight(c, plan):
    """Всё, что можно проверить ДО первого тяжёлого шага — одним списком, а не по одной ошибке."""
    fatal, warn = [], []
    names = set(plan)

    if not c.group:
        fatal.append('карта «%s» не описана в MAP2GROUP; известны: %s'
                     % (c.map, ', '.join(sorted(MAP2GROUP))))
    if not os.path.isdir(c.client):
        fatal.append('каталог клиента не найден: %s' % c.client)
    if not os.path.exists(SCENES_JSON):
        fatal.append('нет реестра сцен %s' % SCENES_JSON)
    elif c.group and not c.scenes:
        fatal.append('в реестре сцен нет группы «%s» для карты %s' % (c.group, c.map))

    # манифест: либо есть, либо его сделает шаг manifest
    if not os.path.exists(c.manifest):
        if 'manifest' in names:
            warn.append('манифеста %s пока нет — его сделает шаг manifest' % c.manifest)
        else:
            fatal.append('нет манифеста %s (сделать: шаг manifest)' % c.manifest)
    else:
        lays = c.manifest_layers()
        if not lays and (names & {'frame', 'walls'}):
            warn.append('в манифесте нет layers[] (синтетический манифест) — поэтажных PNG/SVG '
                        'у шагов frame и walls не будет, только аффина рамки и сводка')

    # файлы клиента под террейн
    if names & {'terrain', 'vegetation'}:
        for p, what in ((c.shared_assets, 'sharedassets с TerrainData'), (c.terrain_level, 'levelN террейн-сцены')):
            if p is None:
                fatal.append('не удалось определить %s для карты %s (нет записи ни в %s, ни сцены *terrain*)'
                             % (what, c.map, os.path.basename(TERRAIN_JSON)))
            elif not os.path.exists(p):
                fatal.append('нет файла клиента (%s): %s' % (what, p))
        for p in c.shared_assets_all[1:]:
            if not os.path.exists(p):
                warn.append('нет файла соседних слайсов %s — растительность соседей не соберётся' % p)
        st = c.terr.get('status')
        if st and st != 'done':
            warn.append('в реестре террейнов карта помечена status=%s; известные блокеры: %s'
                        % (st, '; '.join(c.terr.get('blockers') or []) or 'не записаны'))

    # сцены, которые нужны конкретным слоям
    need_scene = []
    if 'rooms' in names:
        need_scene.append((r'sound', 'комнаты (SpatialAudioRoom)'))
    if 'zone' in names:
        need_scene.append((r'scripts', 'жёсткая граница зоны (LevelBorders)'))
    if 'roads' in names:
        need_scene.append((r'road', 'дороги'))
    for rx, what in need_scene:
        lvl, sc = c.scene_level(rx)
        if lvl is None:
            warn.append('у карты нет сцены /%s/ — слой «%s» может выйти пустым' % (rx, what))
        elif not os.path.exists(os.path.join(c.client, 'level%d' % lvl)):
            fatal.append('сцена %s (level%d) есть в реестре, но файла в клиенте нет' % (sc, lvl))

    if 'roads' in names and c.map not in ROADS_TUNED:
        warn.append('dump-roads.py не имеет профиля для «%s» — сработает GENERIC (узел OO/ROAD, '
                    'реквизит OO/PROPS). Соглашения у карт разные: сперва `run-all.py %s recon`'
                    % (c.map, c.map))
    if 'rooms' in names and c.map not in ROOMS_EXPECTED:
        warn.append('в dump-rooms.py нет эталонных счётчиков для «%s» — смоук-тест байтового '
                    'формата на этой карте не сработает' % c.map)

    if 'render' in names:
        if not os.path.exists(c.blender):
            fatal.append('нет Blender: %s (переопределить --blender)' % c.blender)
        if not os.path.exists(c.base_art):
            warn.append('нет арт-подложки %s — превью рендера ляжет на плашку' % c.base_art)
    if 'verify-bin' in names and not c.ref_bin:
        fatal.append('шаг verify-bin требует --ref-bin <эталон.bin>')
    if 'align' in names and not c.align_ref:
        fatal.append('шаг align требует --align-ref <картинка-эталон> (+ --align-mode landsea|gradient)')

    # доступность каталогов записи
    for d in {c.work, c.out}:
        try:
            os.makedirs(d, exist_ok=True)
        except OSError as e:
            fatal.append('не создаётся каталог %s: %s' % (d, e))

    return fatal, warn


# ═══════════════════════════════════════════════════════════ определение «уже сделано»

def status_of(step, c, produced_by, plan_names, force):
    """(состояние, пояснение) до запуска: blocked / skip / run."""
    missing_hard = []
    for p, hard in step.inputs(c):
        if not p:
            continue
        has = bool(found(p))
        if has or not hard:
            continue
        maker = produced_by.get(p)
        if maker and maker in plan_names:
            continue                       # входа ещё нет, но его сделает шаг раньше по плану
        missing_hard.append((p, maker))
    if missing_hard:
        parts = []
        for p, maker in missing_hard:
            parts.append('%s%s' % (p, (' (делает шаг %s — добавьте его или --with-deps)' % maker)
                                   if maker else ''))
        return 'blocked', 'нет обязательного входа: ' + '; '.join(parts)

    outs = step.outputs(c)
    if not outs:
        return 'run', 'проверка без файлов на выходе — выполняется всегда'
    if force:
        return 'run', 'принудительно (--force / --force-step)'

    have = []
    for p in outs:
        g = found(p)
        if not g:
            return 'run', 'нет выхода %s' % os.path.basename(p)
        have += g
    out_min = min(mtime(p) or 0 for p in have)
    if not step.freshness:
        return 'skip', 'пропущен, есть готовое (%d файл(ов), %s)' % (
            len(have), time.strftime('%d.%m %H:%M', time.localtime(out_min)))
    in_times = []
    for p, _ in step.inputs(c):
        for q in found(p):
            t = mtime(q)
            if t:
                in_times.append((t, q))
    stale = [(t, q) for t, q in in_times if t > out_min + 1]
    if stale:
        t, q = max(stale)
        return 'run', 'вход %s свежее выхода' % os.path.basename(q)
    return 'skip', 'пропущен, есть готовое (%d файл(ов), самый старый %s)' % (
        len(have), time.strftime('%d.%m %H:%M', time.localtime(out_min)))


# ═══════════════════════════════════════════════════════════ RECON: разведка новой карты

STONE_RX = re.compile(r'(stone|rock|cliff|boulder|skala)', re.I)
STONE_DROP_RX = re.compile(r'(_LOD\d|_SHADOW|_COLLIDER|_BALLISTIC|^shadow$|^colider$|^collider$|'
                           r'^model_lod|_Collider$)', re.I)
INST_RX = re.compile(r'(?:\s*\(\d+\)|\(Clone\))+\s*$')
SIZE_WORDS = [(re.compile(r'cliff', re.I), 'cliff (скала)'),
              (re.compile(r'(?:^|[_\- ])(?:big|large|huge)(?:$|[_\- 0-9])', re.I), 'big -> скала'),
              (re.compile(r'(?:^|[_\- ])(?:middle|medium|mid)(?:$|[_\- 0-9])', re.I), 'middle -> препятствие'),
              (re.compile(r'(?:^|[_\- ])(?:small|little|tiny)(?:$|[_\- 0-9])', re.I), 'small -> декор')]

DOOR_SCRIPTS = ('EFT.Interactive.Door', 'EFT.Interactive.ExfiltrationDoor')
EXIT_SCRIPTS = ('EFT.Interactive.ExfiltrationPoint', 'EFT.Interactive.ScavExfiltrationPoint')
ROOM_SCRIPTS = ('SpatialAudioRoom', 'Audio.SpatialSystem.SpatialAudioRoom')
PORTAL_SCRIPTS = ('Audio.SpatialSystem.SpatialAudioPortal',)


def run_recon(c):
    """Разведка карты: что пойдёт само, а что требует ручной настройки. Только чтение клиента."""
    import UnityPy                                   # локальный импорт: шагам сборки он не нужен

    t0 = time.time()
    log('═' * 96)
    log('RECON «%s» (группа сцен %s) — диагностика, ничего не собирается' % (c.map, c.group))
    log('═' * 96)

    ms_cache, name_cache = {}, {}

    def ms_index(fn):
        if fn not in ms_cache:
            try:
                e = UnityPy.load(os.path.join(c.client, fn))
                ms_cache[fn] = {o.path_id: o for o in e.objects if o.type.name == 'MonoScript'}
            except Exception:
                ms_cache[fn] = {}
        return ms_cache[fn]

    def class_of(raw, ext, self_name):
        """Имя класса MonoBehaviour по сырому m_Script — типтри'ев в IL2CPP нет
        (тот же приём, что в scripts/eft-rooms/dump-rooms.py)."""
        fid = struct.unpack_from('<i', raw, 16)[0]
        pid = struct.unpack_from('<q', raw, 20)[0]
        fn = ext[fid - 1] if fid > 0 and fid - 1 < len(ext) else self_name
        key = (fn, pid)
        if key in name_cache:
            return name_cache[key]
        nm = ''
        try:
            o = ms_index(fn).get(pid)
            if o is not None:
                tt = o.read_typetree()
                ns = tt.get('m_Namespace') or ''
                nm = (ns + '.' if ns else '') + (tt.get('m_ClassName') or '?')
        except Exception:
            nm = ''
        name_cache[key] = nm
        return nm

    # ── 1. сцены
    log('\n▌1. СЦЕНЫ')
    present, missing = [], []
    for e in c.scenes:
        p = os.path.join(c.client, 'level%d' % e['level'])
        (present if os.path.exists(p) else missing).append(e)
    log('  в реестре %d, на диске %d%s' % (len(c.scenes), len(present),
        (', НЕТ ФАЙЛА у %d: %s' % (len(missing), ', '.join('level%d' % e['level'] for e in missing)))
        if missing else ''))

    def find_scene(rx):
        return [e for e in present if re.search(rx, e['scene'], re.I)]

    # ── 2. террейн и манифест
    log('\n▌2. ТЕРРЕЙН И МАНИФЕСТ')
    if c.terr:
        log('  реестр: сцена %s (level%s), %s, слайсов %d, status=%s'
            % (c.terr.get('scene'), c.terr.get('level'), c.terr.get('sharedassets'),
               len(c.terr.get('slices') or []), c.terr.get('status')))
        nb = c.terr.get('neighbourSlices')
        if nb:
            log('  соседние слайсы: %s из %s -> флаг with-neighbours подставится сам'
                % (', '.join(nb.get('names', [])), ', '.join(nb.get('dataIn', []))))
        for b in (c.terr.get('blockers') or []):
            log('  ⚠ блокер: %s' % b[:150])
    else:
        lvl, sc = c.scene_level(r'terrain')
        log('  записи в eft-terrain.json НЕТ; по имени сцены: %s (level%s) -> sharedassets%s.assets'
            % (sc, lvl, lvl))
    if os.path.exists(c.manifest):
        m = json.load(open(c.manifest, encoding='utf-8'))
        lays = m.get('layers') or []
        log('  манифест: %s%s, crop %dx%d, rotation %s, слоёв %d%s'
            % (c.manifest, ' (СИНТЕТИЧЕСКИЙ, растра нет)' if m.get('synthetic') else '',
               m.get('crop', {}).get('width', 0), m.get('crop', {}).get('height', 0),
               m.get('coordinateRotation'), len(lays),
               (': ' + ', '.join(l['id'] for l in lays)) if lays else ''))
    else:
        log('  манифеста НЕТ: %s (сделать шагом manifest)' % c.manifest)

    # ── 3–5. один проход по сценам: имена GO + классы MonoBehaviour
    log('\n▌3. ПРОХОД ПО СЦЕНАМ (имена объектов + скрипты)')
    fam = collections.Counter()
    doors = exits = rooms = portals = bnodes = 0
    per_scene = []
    for e in present:
        if re.search(r'terrain', e['scene'], re.I):
            continue                                   # 65 МБ высот, для разведки не нужны
        p = os.path.join(c.client, 'level%d' % e['level'])
        env = UnityPy.load(p)
        f = list(env.files.values())[0]
        ext = [os.path.basename(x.path) for x in f.externals]
        ngo = d = x = r = po = 0
        for o in env.objects:
            tn = o.type.name
            if tn == 'GameObject':
                ngo += 1
                try:
                    nm = o.read_typetree()['m_Name']
                except Exception:
                    continue
                # Габариты зданий dump-rooms берёт из веток BUILDING/BUILDINGS. Ветки нет —
                # список зданий выйдет пустым, и это видно заранее, а не после прогона.
                if nm.upper() in ('BUILDING', 'BUILDINGS'):
                    bnodes += 1
                if STONE_RX.search(nm) and not STONE_DROP_RX.search(nm):
                    fam[INST_RX.sub('', nm)] += 1
            elif tn == 'MonoBehaviour':
                try:
                    cl = class_of(o.get_raw_data(), ext, 'level%d' % e['level'])
                except Exception:
                    continue
                if cl in DOOR_SCRIPTS:
                    d += 1
                elif cl in EXIT_SCRIPTS:
                    x += 1
                elif cl in ROOM_SCRIPTS:
                    r += 1
                elif cl in PORTAL_SCRIPTS:
                    po += 1
        doors += d; exits += x; rooms += r; portals += po
        per_scene.append((e, ngo, d, x, r))
        del env
    for e, ngo, d, x, r in per_scene:
        if d or x or r or ngo > 20000:
            log('  level%-5d %-40s GO %6d  двери %3d  выходы %2d  комнаты %3d'
                % (e['level'], e['scene'][:40], ngo, d, x, r))
    log('  ИТОГО: комнат %d, проёмов %d, дверей %d, выходов %d, узлов-веток BUILDING(S) %d'
        % (rooms, portals, doors, exits, bnodes))
    if not bnodes:
        log('  ⚠ веток BUILDING/BUILDINGS в сценах НЕТ — габариты зданий в rooms.json будут '
            'пустыми (buildings: 0), и слой стен потеряет опору на них')

    # ── 4. звук / границы / дороги — по иерархии
    def hierarchy(level):
        env = UnityPy.load(os.path.join(c.client, 'level%d' % level))
        names, tr = {}, {}
        for o in env.objects:
            if o.type.name == 'GameObject':
                try:
                    names[o.path_id] = o.read_typetree()['m_Name']
                except Exception:
                    pass
            elif o.type.name in ('Transform', 'RectTransform'):
                try:
                    tt = o.read_typetree()
                    tr[o.path_id] = (tt['m_GameObject']['m_PathID'], tt['m_Father']['m_PathID'],
                                     [ch['m_PathID'] for ch in tt['m_Children']])
                except Exception:
                    pass
        go2tr = {v[0]: k for k, v in tr.items()}

        def path(goid, limit=64):
            parts, t, n = [], go2tr.get(goid), 0
            while t and n < limit:
                g, fa, _ = tr[t]
                parts.append(names.get(g, '?'))
                t = fa if fa in tr else None
                n += 1
            return '/'.join(reversed(parts))

        def subtree(goid):
            t = go2tr.get(goid)
            if not t:
                return 0
            st, n = [t], 0
            while st:
                cur = st.pop()
                n += 1
                st += [ch for ch in tr[cur][2] if ch in tr]
            return n
        return names, tr, go2tr, path, subtree

    log('\n▌4. ЗВУКОВАЯ СЦЕНА (источник комнат)')
    snd = find_scene(r'_sound$')
    if not snd:
        log('  ⚠ сцены *_Sound НЕТ — слой комнат на этой карте не соберётся')
    else:
        log('  %s: SpatialAudioRoom %d, SpatialAudioPortal %d' % (snd[0]['scene'], rooms, portals))

    log('\n▌5. ГРАНИЦА УРОВНЯ (источник зоны)')
    scr = find_scene(r'scripts')
    if not scr:
        log('  ⚠ сцены *_Scripts НЕТ — жёсткую границу зоны брать неоткуда')
    else:
        names, tr, go2tr, path, subtree = hierarchy(scr[0]['level'])
        roots = [(g, n) for g, n in names.items() if 'levelborders' in n.lower()]
        if not roots:
            log('  ⚠ в %s нет корня *LevelBorders — dump-zone.py уйдёт в фолбэк' % scr[0]['scene'])
        for g, n in roots[:3]:
            log('  %s: корень «%s», панелей в поддереве %d' % (scr[0]['scene'], n, subtree(g)))

    log('\n▌6. ДОРОЖНАЯ СЦЕНА')
    rd = find_scene(r'road')
    has_road = None
    if not rd:
        log('  ⚠ сцены дорог НЕТ — слой roads на этой карте не соберётся')
    else:
        e = rd[0]
        names, tr, go2tr, path, subtree = hierarchy(e['level'])
        log('  %s (level%d): GO %d' % (e['scene'], e['level'], len(names)))
        oo = [g for g, n in names.items() if n == 'OO' and path(g).count('/') == 1]
        oo_kids = {}
        if not oo:
            log('  ⚠ узла OO первого уровня нет — отбор dump-roads по ветке не сработает')
        for g in oo:
            kids = [ch for ch in tr[go2tr[g]][2] if ch in tr]
            oo_kids = {names.get(tr[ch][0], '?'): subtree(tr[ch][0]) for ch in kids}
            log('  ветки под OO (%d шт., узел -> объектов в поддереве), топ-14:' % len(oo_kids))
            for nm in sorted(oo_kids, key=lambda k: -oo_kids[k])[:14]:
                log('     %-30s %6d' % (nm[:30], oo_kids[nm]))
        # Решает не «есть ли где-то узел с таким именем», а «есть ли ВЕТКА полотна под OO»:
        # dump-roads ищет road_root по ПУТИ узла (re.search, re.I), дефолт — «(^|/)ROAD(/|$)».
        branch = {k.upper(): v for k, v in oo_kids.items()}
        has_road = branch.get('ROAD')
        has_roads = branch.get('ROADS')
        log('  ветка OO/ROAD: %s | ветка OO/ROADS: %s'
            % (('ЕСТЬ, %d объектов' % has_road) if has_road else 'НЕТ',
               ('ЕСТЬ, %d объектов' % has_roads) if has_roads else 'НЕТ'))
        # сколько объектов зацепит каждый отбор — на этих числах и виден масштаб реквизита
        paths = [path(g) for g in names]
        n_generic = sum(1 for p in paths if re.search(r'(^|/)ROAD(/|$)', p, re.I))
        n_byname = sum(1 for p in paths if re.search(r'(road|serpentine|asphalt)', p, re.I))
        n_props = sum(1 for p in paths if re.search(r'(^|/)PROPS(/|$)', p, re.I))
        log('  отбор по пути: дефолтный «(^|/)ROAD(/|$)» -> %d объектов; по именам '
            '«(road|serpentine|asphalt)» -> %d; реквизит OO/PROPS -> %d'
            % (n_generic, n_byname, n_props))
        if not has_road:
            log('  ⚠ ВЕТКИ полотна OO/ROAD у карты НЕТ: дефолтный отбор возьмёт %d объектов '
                'россыпью, отбор по именам — %d вместе с реквизитом. Профиль карты в '
                'dump-roads.py надо сверять глазами, менять его — отдельная задача'
                % (n_generic, n_byname))

    log('\n▌7. КАМНИ (семейства по именам)')
    if not fam:
        log('  камней по именам не найдено — слой stones будет пуст')
    else:
        log('  всего узлов-кандидатов %d, уникальных имён %d; топ-12:' % (sum(fam.values()), len(fam)))
        for nm, n in fam.most_common(12):
            word = next((w for rx, w in SIZE_WORDS if rx.search(nm)), 'слова-размера НЕТ -> класс по габариту')
            log('     %5d  %-30s %s' % (n, nm[:30], word))
        nowords = sum(n for nm, n in fam.items() if not any(rx.search(nm) for rx, _ in SIZE_WORDS))
        log('  без слова-размера в имени: %d из %d (%.0f %%) — им класс даст габарит в плане'
            % (nowords, sum(fam.values()), 100.0 * nowords / max(1, sum(fam.values()))))

    # ── 8. этажный токен в путях комнат (если rooms.json уже есть)
    log('\n▌8. ЭТАЖНОСТЬ')
    rj = c.rooms_json
    if os.path.exists(rj):
        try:
            D = json.load(open(rj, encoding='utf-8'))
            rl = D.get('rooms') or []
            # Этажный токен в ПУТИ комнаты (rooms[].path) — единственный намёк клиента на то,
            # на каком этаже комната. Где его нет, этаж придётся брать по Y центра, то есть
            # полосами высот манифеста; на карте без layers[] не выйдет и этого.
            toks = collections.Counter()
            for r in rl:
                p = str(r.get('path') or '')
                for rx in (r'_f\d', r'floor', r'stage_\d', r'[_/](1st|2nd|3rd|4th)',
                           r'basement|podval|underground', r'etaj|etazh', r'lvl\d'):
                    if re.search(rx, p, re.I):
                        toks[rx] += 1
                        break
            hit = sum(toks.values())
            log('  %s: комнат %d, с этажным токеном в path %d (%.0f %%)'
                % (os.path.basename(rj), len(rl), hit, 100.0 * hit / max(1, len(rl))))
            if toks:
                log('     токены: %s' % ', '.join('%s x%d' % (k, v) for k, v in toks.most_common()))
        except Exception as ex:
            log('  не прочитался %s: %s' % (rj, ex))
    else:
        log('  %s ещё нет — этажность оценится после шага rooms' % rj)
    lays = c.manifest_layers()
    log('  слоёв в манифесте: %d%s' % (len(lays), '' if lays else
        ' — поэтажной разбивки НЕ БУДЕТ: frame и walls дадут только аффину и сводку'))

    # ── вердикт
    log('\n' + '═' * 96)
    log('ВЕРДИКТ по «%s»' % c.map)
    auto, manual = [], []
    (auto if c.terr.get('status') == 'done' else manual).append(
        'террейн (height/material/vegetation): status=%s' % (c.terr.get('status') or 'нет записи'))
    (auto if snd and rooms else manual).append('комнаты: SpatialAudioRoom %d' % rooms)
    (auto if c.map in ROOMS_EXPECTED else manual).append(
        'смоук-тест комнат: эталонных счётчиков в dump-rooms.py %s'
        % ('есть' if c.map in ROOMS_EXPECTED else 'НЕТ — формат проверить нечем'))
    (auto if scr else manual).append('зона: сцена скриптов %s' % (scr[0]['scene'] if scr else 'НЕТ'))
    if not rd:
        manual.append('дороги: дорожной сцены нет')
    elif not has_road:
        # Профиль в dump-roads.py может быть, но раз ветки полотна нет — отбор идёт по именам,
        # а он тянет реквизит. Это ровно тот случай, ради которого recon и написан.
        manual.append('дороги: ветки OO/ROAD нет%s — отбор по именам тянет реквизит, сверять глазами'
                      % ('' if c.map in ROADS_TUNED else ' И профиля карты в dump-roads.py тоже нет'))
    elif c.map in ROADS_TUNED:
        auto.append('дороги: ветка OO/ROAD (%d объектов) + профиль карты в dump-roads.py' % has_road)
    else:
        manual.append('дороги: ветка OO/ROAD есть (%d), но профиля карты в dump-roads.py НЕТ '
                      '(сработает GENERIC вслепую)' % has_road)
    (auto if fam else manual).append('камни: кандидатов %d' % sum(fam.values()))
    (auto if bnodes else manual).append(
        'здания: веток BUILDING(S) %d%s' % (bnodes, '' if bnodes else ' — списка зданий не будет'))
    (auto if lays else manual).append('этажи: слоёв в манифесте %d' % len(lays))
    log('  ПОЙДЁТ САМО:')
    for s in auto:
        log('    ✔ %s' % s)
    log('  РУЧНАЯ НАСТРОЙКА:')
    for s in manual:
        log('    ⚠ %s' % s)
    log('  разведка заняла %.0f с' % (time.time() - t0))
    return 0


# ═══════════════════════════════════════════════════════════ прогон

def run(argv=None):
    ap = argparse.ArgumentParser(
        prog='run-all.py', add_help=True,
        description='Конвейер слоёв карты EFT одной командой. Шаги: ' + ', '.join(ALL_NAMES))
    ap.add_argument('map', help='id карты портала: customs, lighthouse, woods, …')
    ap.add_argument('steps', nargs='*', help='шаги позиционно (например: recon); пусто = полный план')
    ap.add_argument('--only', help='список шагов через запятую')
    ap.add_argument('--skip', help='список шагов через запятую')
    ap.add_argument('--from', dest='from_step', help='начать с этого шага и дальше по графу')
    ap.add_argument('--with-deps', action='store_true',
                    help='дотянуть недостающих предков вместо отказа')
    ap.add_argument('--force', action='store_true', help='пересобрать всё запрошенное')
    ap.add_argument('--force-step', help='пересобрать только эти шаги (через запятую)')
    ap.add_argument('--dry-run', action='store_true', help='напечатать план и выйти')
    ap.add_argument('--stop-on-error', action='store_true',
                    help='оборвать прогон на первой ошибке (по умолчанию — идти по независимым веткам)')
    ap.add_argument('--client', default=DEF_CLIENT)
    ap.add_argument('--raster-root', default=DEF_RASTER)
    ap.add_argument('--manifest', help='по умолчанию <raster-root>/<map>/manifest.json')
    ap.add_argument('--work-root', default=DEF_WORKROOT)
    ap.add_argument('--work', help='по умолчанию <work-root>/<map>')
    ap.add_argument('--out', help='по умолчанию map-exports/OBJECTS-MAPS/gen/<map>')
    ap.add_argument('--blender', default=DEF_BLENDER)
    ap.add_argument('--width', type=int, default=4096, help='ширина height/material')
    ap.add_argument('--long-side', type=int, default=16384, help='длинная сторона для make-manifest')
    ap.add_argument('--locks', help='locks.json для сверки привязки на шаге frame')
    ap.add_argument('--terrain-flags', help='флаги dump-terrain через запятую '
                                            '(with-neighbours, orient-override)')
    ap.add_argument('--allow-unresolved', action='store_true',
                    help='растительность: не падать на нерезолвнутых видах')
    ap.add_argument('--no-props', action='store_true', help='стены: не резать ветку props')
    ap.add_argument('--engine', default='eevee', choices=['eevee', 'cycles'])
    ap.add_argument('--tile', type=int, default=2048)
    ap.add_argument('--render-layers', default='stones,vegetation')
    ap.add_argument('--ref-bin', help='эталонный .bin для шага verify-bin')
    ap.add_argument('--align-ref', help='эталонная картинка для шага align')
    ap.add_argument('--align-mode', default='landsea', choices=['landsea', 'gradient'])
    a = ap.parse_args(argv)

    plan, err = build_plan(a)
    if err:
        log('ОТКАЗ: %s' % err)
        return 3

    c = Ctx(a)
    log('карта %s | клиент %s' % (c.map, c.client))
    log('манифест %s' % c.manifest)
    log('промежуточное %s | выход %s' % (c.work, c.out))

    if plan == ['recon']:
        fatal, warn = preflight(c, [])
        for w in warn:
            log('  · %s' % w)
        if fatal:
            log('\nPREFLIGHT НЕ ПРОЙДЕН:')
            for f in fatal:
                log('  ✖ %s' % f)
            return 2
        return run_recon(c)

    # ── preflight
    log('\n── PREFLIGHT ' + '─' * 82)
    fatal, warn = preflight(c, plan)
    for w in warn:
        log('  ⚠ %s' % w)
    if fatal:
        log('  НЕ ПРОЙДЕН, %d проблем(ы):' % len(fatal))
        for f in fatal:
            log('  ✖ %s' % f)
        return 2
    log('  ✔ клиент, реестры, манифест и каталоги на месте (%d шагов в плане)' % len(plan))

    # кто что производит — чтобы «нет входа» отличать от «его сделает шаг раньше»
    produced_by = {}
    for name, st in STEPS.items():
        for p in st.outputs(c):
            produced_by.setdefault(p, name)

    force_steps = {s.strip() for s in (a.force_step or '').split(',') if s.strip()}

    log('\n── ПЛАН ' + '─' * 87)
    for i, name in enumerate(plan, 1):
        st = STEPS[name]
        state, why = status_of(st, c, produced_by, set(plan), a.force or name in force_steps)
        mark = {'run': '→', 'skip': '≡', 'blocked': '✖'}[state]
        log('%2d. %s %-11s %-38s %s' % (i, mark, name, st.title, why))
        if a.dry_run:
            log('       %s' % ' '.join('"%s"' % x if ' ' in str(x) else str(x) for x in st.argv(c)))
    if a.dry_run:
        log('\n--dry-run: ничего не запускалось.')
        return 0

    # ── исполнение
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    results, failed = [], set()
    for name in plan:
        st = STEPS[name]
        dead = [d for d in st.deps if d in failed]
        if dead:
            results.append((name, 'пропущен', 0.0, 'предок упал: %s' % ', '.join(dead)))
            failed.add(name)
            continue
        state, why = status_of(st, c, produced_by, set(plan), a.force or name in force_steps)
        if state == 'blocked':
            log('\n✖ %s: %s' % (name, why))
            results.append((name, 'заблокирован', 0.0, why))
            failed.add(name)
            if a.stop_on_error:
                break
            continue
        if state == 'skip':
            results.append((name, 'готово ранее', 0.0, why))
            continue                       # строка про «есть готовое» уже напечатана в плане

        cmd = st.argv(c)
        log('\n' + '─' * 96)
        log('→ %s: %s' % (name, st.title))
        log('  %s' % ' '.join('"%s"' % x if ' ' in str(x) else str(x) for x in cmd))
        t = time.time()
        rc = subprocess.call(cmd, cwd=REPO, env=env)
        dt = time.time() - t
        if rc == 0:
            log('✔ %s за %s' % (name, fmt_dt(dt)))
            results.append((name, 'сделано', dt, ''))
        else:
            log('✖ %s: код возврата %d (за %s)' % (name, rc, fmt_dt(dt)))
            results.append((name, 'УПАЛ', dt, 'код %d' % rc))
            failed.add(name)
            if a.stop_on_error:
                break

    # ── сводка
    log('\n' + '═' * 96)
    log('СВОДКА «%s»' % c.map)
    log('%-12s %-14s %9s  %s' % ('шаг', 'итог', 'время', 'примечание'))
    for name, state, dt, note in results:
        log('%-12s %-14s %9s  %s' % (name, state, fmt_dt(dt) if dt else '—', note[:60]))
    total = sum(r[2] for r in results)
    log('всего %s на %d шагов' % (fmt_dt(total), len(results)))

    log('\nФАЙЛЫ:')
    seen = set()
    nfiles = 0
    for name, state, _, _ in results:
        if state in ('заблокирован', 'УПАЛ', 'пропущен'):
            continue
        files = [f for p in STEPS[name].outputs(c) for f in found(p)]
        if not files:
            continue
        log('  %s:' % name)
        for f in files:
            if f in seen:
                continue
            seen.add(f)
            nfiles += 1
            log('    %10s  %s' % (human(os.path.getsize(f)), os.path.relpath(f, REPO)
                                  if f.lower().startswith(REPO.lower()) else f))
    if not nfiles:
        log('  (ни одного)')

    bad = [n for n, s, _, _ in results if s in ('УПАЛ', 'заблокирован', 'пропущен')]
    if bad:
        log('\nНЕ СДЕЛАНО: %s' % ', '.join(bad))
        return 1
    log('\nВсё запрошенное готово.')
    return 0


def fmt_dt(s):
    if s < 60:
        return '%.1f с' % s
    if s < 3600:
        return '%d м %02d с' % (s // 60, s % 60)
    return '%d ч %02d м' % (s // 3600, (s % 3600) // 60)


if __name__ == '__main__':
    sys.exit(run())
