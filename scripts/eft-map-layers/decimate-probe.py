# -*- coding: utf-8 -*-
"""Веха 0 решения 3D clay-карт: ПЕРЕЖИВЁТ ЛИ СИЛУЭТ ЗНАКОВОГО ЗДАНИЯ ДЕЦИМАЦИЮ.

Зачем. `docs/research/eft-landmark-geometry-audit.md` намерил, что знаковое здание
из клиента стоит ×80…156 к своей экструзии (Академия Резерва: 4 696 против 384 736
треугольников). Вывод «гибрид A+C проходит при K ≤ 5 и сжатии ×8–10» держится на
НЕПРОВЕРЕННОМ допущении, что ужатая в десять раз оболочка сохранит узнаваемый силуэт.
А узнаваемость — единственная причина брать геометрию клиента вообще. Если она не
переживает сжатие, мы платим всю цену и не получаем того, ради чего платили.

Что делает. Собирает ОДНО здание из дампа окклюдеров (экземпляры, попавшие в bbox
здания из `<карта>-rooms.json`), пишет агрегированный npz, затем зовёт Blender:
децимация Collapse с рядом коэффициентов → орто-рендер силуэта сверху и сбоку →
сравнение масок с оригиналом по IoU и по периметру.

Почему IoU силуэта, а не «на глаз». Децимация всегда ухудшает меш; вопрос в том,
ЗАМЕТНО ли это в нашем сценарии. Мы рисуем clay без текстур, вид сверху под углом,
читаемость держат силуэт и контур (решение №5 и раздел «визуальный референс»).
Значит мерить надо ровно то, что видно: заполненную площадь силуэта и длину контура.

usage:
  python decimate-probe.py <карта> <имя-здания> [--ratios 0.5,0.2,0.1,0.05] [--out DIR]
  python decimate-probe.py reserve Reserv_academy_w_kitchens
  python decimate-probe.py --list reserve          # какие здания есть

Выход в <out>/: <здание>-orig.npz, силуэты PNG, report.json + печать таблицы.
"""
import json
import os
import subprocess
import sys
import time

import numpy as np

EXPORT = os.environ.get('EFT_EXPORT', r'D:\eft-export')
BLENDER = os.environ.get(
    'BLENDER', r'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe')
HERE = os.path.dirname(os.path.abspath(__file__))

# Консоль Windows по умолчанию cp1251 и падает на '×'/'²'. Переводим вывод в UTF-8.
for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, 'reconfigure'):
        _s.reconfigure(encoding='utf-8', errors='replace')

t0 = time.time()


def log(m):
    print('[%6.1fs] %s' % (time.time() - t0, m), flush=True)


def die(m):
    print('ОШИБКА: %s' % m, file=sys.stderr)
    sys.exit(1)


def opt(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def quat_to_mat(q):
    """Unity-кватернион (x, y, z, w) → матрица 3×3."""
    x, y, z, w = q
    n = x * x + y * y + z * z + w * w
    if n < 1e-12:
        return np.eye(3, dtype=np.float64)
    s = 2.0 / n
    xx, yy, zz = x * x * s, y * y * s, z * z * s
    xy, xz, yz = x * y * s, x * z * s, y * z * s
    wx, wy, wz = w * x * s, w * y * s, w * z * s
    return np.array([
        [1.0 - (yy + zz), xy - wz, xz + wy],
        [xy + wz, 1.0 - (xx + zz), yz - wx],
        [xz - wy, yz + wx, 1.0 - (xx + yy)],
    ], dtype=np.float64)


def load_building(map_id, name):
    """bbox здания из <карта>-rooms.json."""
    p = os.path.join(EXPORT, map_id, '%s-rooms.json' % map_id)
    if not os.path.exists(p):
        die('нет дампа комнат: %s' % p)
    d = json.load(open(p, encoding='utf-8'))
    blds = d.get('buildings') or []
    if name == '--list':
        return blds
    hit = [b for b in blds if b['name'] == name]
    if not hit:
        near = [b['name'] for b in blds if name.lower() in b['name'].lower()]
        die('здание %r не найдено. Похожие: %s' % (name, near[:5] or 'нет'))
    return hit[0]


def collect(map_id, bld, pad=0.5, min_span=0.0):
    """Экземпляры окклюдеров, чей центр попал в bbox здания.

    Гоча: `occluders.json` НЕ хранит имя здания у экземпляра — только имя меша.
    Поэтому принадлежность определяется геометрически, по bbox из rooms.json.
    Это та же эвристика, что в geometry-audit, и она даёт «всё, что физически
    в пятне» — то есть оболочку ВМЕСТЕ с начинкой.
    """
    p = os.path.join(EXPORT, map_id, 'render-objects', '%s-occluders.json' % map_id)
    if not os.path.exists(p):
        die('нет дампа окклюдеров: %s' % p)
    d = json.load(open(p, encoding='utf-8'))
    protos, inst = d['protos'], d['instances']
    lo = np.array(bld['min'], dtype=np.float64) - pad
    hi = np.array(bld['max'], dtype=np.float64) + pad

    V, T, off = [], [], 0
    cache = {}
    kept = 0
    for it in inst:
        c = np.array([it['x'], it['y'], it['z']], dtype=np.float64)
        if np.any(c < lo) or np.any(c > hi):
            continue
        mesh = it['mesh']
        if mesh not in cache:
            npz = protos[mesh]['npz']
            z = np.load(npz)
            cache[mesh] = (z['v'].astype(np.float64), z['t0'].astype(np.int64))
        v, t = cache[mesh]
        R = quat_to_mat(it['quat'])
        s = np.array(it.get('scale', [1, 1, 1]), dtype=np.float64)
        if min_span > 0.0:
            # Отсев мелочи по габариту экземпляра. Нужен не ради экономии, а потому что
            # Decimate упирается в пол «3-4 треугольника на объект»: жмём не единый меш,
            # а тысячи несвязных, и на пределе каждый схлопывается в вырожденный —
            # силуэт превращается в кашу (замер: IoU 0.975 → 0.159 между 49.9k и 32.6k).
            span = float(np.max((v.max(axis=0) - v.min(axis=0)) * np.abs(s)))
            if span < min_span:
                continue
        V.append((v * s) @ R.T + c)
        T.append(t + off)
        off += len(v)
        kept += 1
    if not V:
        die('в bbox здания не нашлось ни одного экземпляра')
    return np.vstack(V).astype(np.float32), np.vstack(T).astype(np.int32), kept


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--list' in sys.argv:
        map_id = args[0] if args else die('нужна карта')
        for b in load_building(map_id, '--list'):
            ex = np.array(b['max']) - np.array(b['min'])
            print('  %-42s meshes %-5d  %.0f×%.0f×%.0f м'
                  % (b['name'], b['meshes'], ex[0], ex[1], ex[2]))
        return
    if len(args) < 2:
        die('usage: decimate-probe.py <карта> <имя-здания>')
    map_id, name = args[0], args[1]
    ratios = [float(x) for x in opt('--ratios', '0.5,0.2,0.1,0.05').split(',')]
    out = opt('--out', os.path.join(HERE, '..', '..', '.tmp-3d', 'decimate'))
    out = os.path.abspath(out)
    os.makedirs(out, exist_ok=True)

    bld = load_building(map_id, name)
    ex = np.array(bld['max']) - np.array(bld['min'])
    log('здание %s: %d мешей по манифесту, габарит %.1f×%.1f×%.1f м, пятно %.0f м²'
        % (name, bld['meshes'], ex[0], ex[1], ex[2], ex[0] * ex[2]))

    min_span = float(opt('--min-span', '0'))
    V, T, kept = collect(map_id, bld, min_span=min_span)
    log('собрано экземпляров: %d (min-span %.1f м), вершин %d, треугольников %d'
        % (kept, min_span, len(V), len(T)))

    npz = os.path.join(out, '%s-orig.npz' % name)
    np.savez_compressed(npz, v=V, t=T)
    log('оригинал → %s (%.1f МБ)' % (npz, os.path.getsize(npz) / 1e6))

    job = {
        'npz': npz, 'out': out, 'name': name,
        'ratios': ratios, 'px': 900,
        'min': bld['min'], 'max': bld['max'],
    }
    jp = os.path.join(out, 'job.json')
    json.dump(job, open(jp, 'w', encoding='utf-8'), ensure_ascii=False)

    blend_script = os.path.join(HERE, 'decimate-probe-blender.py')
    if not os.path.exists(blend_script):
        die('нет исполнителя Blender: %s' % blend_script)
    log('Blender: децимация %s + рендер силуэтов…' % ratios)
    r = subprocess.run(
        [BLENDER, '--background', '--factory-startup', '--python', blend_script,
         '--', jp],
        capture_output=True, text=True, encoding='utf-8', errors='replace')
    tail = (r.stdout or '')[-2500:]
    print(tail)
    if r.returncode != 0:
        print((r.stderr or '')[-2000:], file=sys.stderr)
        die('Blender вернул %d' % r.returncode)
    log('готово, отчёт: %s' % os.path.join(out, 'report.json'))


if __name__ == '__main__':
    main()
