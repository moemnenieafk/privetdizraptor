#!/usr/bin/env python3
"""
stitch-svg-floors.py — сшивка поэтажных SVG одной карты в один файл.

Зачем: DynamicMaps и часть дампов раздают карту как набор файлов по этажу
(Factory-Basement.svg, Factory-Ground_Floor.svg, ...). Движку ЦТА нужен один
файл с группами-этажами, семантическими классами и единым блоком стилей.

    python stitch-svg-floors.py --in <папка> --out Factory.svg
    python stitch-svg-floors.py --in <папка> --out Factory.svg --order Basement,Ground_Floor
    python stitch-svg-floors.py --in <папка> --dry-run

ГЛАВНАЯ ЛОВУШКА: классы st0/st1/st2 в каждом файле значат СВОЁ — это локальная
нумерация экспорта Illustrator. У Factory st0 в подвале это заливка пола, а в
Ground_Floor — обводка стен. Прямая склейка даёт подвал со стенами-полом.
Поэтому классы назначаются по ИМЕНАМ ГРУПП, а не по исходным классам, и
скрипт печатает таблицу соответствия, чтобы её можно было глазами проверить.
"""

import argparse
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

NS = '{http://www.w3.org/2000/svg}'
SHAPES = {NS + t for t in ('path', 'polygon', 'rect', 'polyline', 'circle', 'ellipse', 'line')}

# Имя группы (без числового суффикса) -> класс из словаря SPEC-DRAWING §4.
# Суффиксы -b / -2 / -3 / -U и т.п. срезаются перед поиском.
GROUP_CLASS = {
    'floor': 'floor',
    'stairs': 'stairs',
    'stairs-down': 'stairs',
    'stairs-up': 'stairs',
    'connector': 'stairs',
    'wall': 'wall',
    'obstacles': 'structure',
    'building': 'building',
    'buildings': 'building',
    'ledge': 'misc',
    'ground': 'land',
    'land': 'land',
    'green': 'trees',
    'trees': 'trees',
    'water': 'water',
    'gravel': 'gravel',
    'cement': 'cement',
    'road': 'road_tarmac',
    'roads': 'road_tarmac',
    'fence': 'fence',
    'railroad': 'railroad',
    'powerline': 'powerline',
    'map_border': 'map_border',
    'mines': 'danger',
    'sniper': 'danger',
    'misc': 'misc',
}

STYLE_BLOCK = """<style id="style_common">
.land{fill:var(--map-terrain)}
.trees{fill:var(--map-trees)}
.water{fill:var(--map-water)}
.gravel{fill:var(--map-gravel)}
.cement{fill:var(--map-cement)}
.floor{fill:var(--map-floor)}
.building{fill:var(--map-building)}
.structure{fill:var(--map-structure)}
.wall{fill:var(--map-wall)}
.misc{fill:var(--map-misc)}
.stairs{fill:var(--primary)}
.danger{fill:var(--map-danger)}
.cta_outline{fill:none;stroke:var(--map-wall);stroke-width:.2}
.road_tarmac{fill:none;stroke:var(--map-tarmac);stroke-width:8}
.fence{fill:none;stroke:var(--map-wall);stroke-width:1}
.railroad{fill:none;stroke:var(--map-wall);stroke-width:3;stroke-dasharray:6}
.powerline{fill:none;stroke:var(--primary);stroke-width:2;stroke-dasharray:6,6}
.map_border{fill:none;stroke:var(--map-wall);stroke-width:2}
</style>"""


def base_name(gid: str) -> str:
    """Floor-2 -> floor, Stairs-b -> stairs, Stairs-2-down -> stairs-down."""
    s = gid.lower()
    m = re.match(r'^(.*?)(?:[-_](?:b|u|\d+))?([-_](?:down|up))?$', s)
    if not m:
        return s
    stem, direction = m.group(1), m.group(2) or ''
    return (stem + direction).strip('-_')


def classify(gid: str, src_style: str) -> str | None:
    """Класс по имени группы. Если исходная заливка — только обводка, заливочный
    класс не подходит: `wall` покрасил бы силуэт целиком вместо контура."""
    key = base_name(gid)
    cls = GROUP_CLASS.get(key)
    if cls is None:
        for prefix, c in GROUP_CLASS.items():
            if key.startswith(prefix):
                cls = c
                break
    if cls is None:
        return None
    stroke_only = 'fill: none' in src_style or 'fill:none' in src_style
    if stroke_only and cls in ('wall', 'floor', 'building', 'structure', 'misc'):
        return 'cta_outline'
    return cls


def collect_styles(root: ET.Element) -> dict:
    """.st0 { fill:#70777f } -> {'st0': 'fill:#70777f'}"""
    out = {}
    for st in root.iter(NS + 'style'):
        for m in re.finditer(r'\.([\w-]+)\s*\{([^}]*)\}', st.text or ''):
            out[m.group(1)] = re.sub(r'\s+', ' ', m.group(2)).strip()
    return out


def floor_id(path: Path, root: ET.Element) -> str:
    """Имя этажа: из корневой группы, иначе из имени файла после дефиса."""
    for g in root:
        if g.tag == NS + 'g' and g.get('id'):
            return g.get('id')
    stem = path.stem
    return stem.split('-', 1)[1] if '-' in stem else stem


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True, help='папка с поэтажными SVG')
    ap.add_argument('--out', dest='dst', help='итоговый файл')
    ap.add_argument('--order', help='порядок этажей снизу вверх, через запятую')
    ap.add_argument('--pattern', default='*.svg')
    ap.add_argument('--dry-run', action='store_true', help='только таблица соответствия')
    a = ap.parse_args()

    src = Path(a.src)
    files = sorted(src.glob(a.pattern))
    if not files:
        print(f'нет файлов по маске {a.pattern} в {src}', file=sys.stderr)
        return 1

    parsed = []
    for f in files:
        root = ET.parse(f).getroot()
        parsed.append((f, root, floor_id(f, root), collect_styles(root)))

    boxes = {r.get('viewBox') for _, r, _, _ in parsed}
    if len(boxes) > 1:
        print('РАЗНЫЕ viewBox — этажи не в одной системе координат:', file=sys.stderr)
        for f, r, _, _ in parsed:
            print(f'   {f.name}: {r.get("viewBox")}', file=sys.stderr)
        return 1
    view_box = boxes.pop()

    if a.order:
        want = [s.strip() for s in a.order.split(',')]
        parsed.sort(key=lambda p: want.index(p[2]) if p[2] in want else len(want))

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}">', STYLE_BLOCK]
    table, total, unmapped = [], 0, []

    for path, root, fid, styles in parsed:
        top = next((g for g in root if g.tag == NS + 'g' and g.get('id') == fid), root)
        out.append(f'  <g id="{fid}">')
        out.append('    <g id="Schematic">')
        count = 0

        def emit(group: ET.Element, indent: str) -> None:
            nonlocal count
            gid = group.get('id')
            if not gid:
                return
            shapes = [c for c in group if c.tag in SHAPES]
            src_cls = sorted({c for s in shapes for c in (s.get('class') or '').split()})
            src_style = '; '.join(styles.get(c, '') for c in src_cls)
            cls = classify(gid, src_style)
            if shapes:
                table.append((fid, gid, ' '.join(src_cls) or '-',
                              src_style or '?', cls or 'НЕ ОПОЗНАН'))
                if cls is None:
                    unmapped.append(f'{fid}/{gid}')
            out.append(f'{indent}<g id="{gid}">')
            for s in shapes:
                attrs = {k: v for k, v in s.attrib.items() if k not in ('id', 'class')}
                if cls:
                    attrs['class'] = cls
                body = ' '.join(f'{k}="{v}"' for k, v in attrs.items())
                out.append(f'{indent}  <{s.tag.replace(NS, "")} {body}/>')
                count += 1
            for child in group:
                if child.tag == NS + 'g':
                    emit(child, indent + '  ')
            out.append(f'{indent}</g>')

        for child in top:
            if child.tag == NS + 'g':
                emit(child, '      ')
        out.append('    </g>')
        out.append('    <g id="Detail"/>')
        out.append('  </g>')
        total += count
        print(f'  {fid:22} фигур: {count}')

    out.append('</svg>')

    print(f'\n{"этаж":16}{"группа":22}{"было":10}{"исходная заливка":26}{"стало"}')
    for row in table:
        print(f'  {row[0]:14}{row[1]:22}{row[2]:10}{row[3][:24]:26}{row[4]}')

    if unmapped:
        print(f'\nНЕ ОПОЗНАНЫ ({len(unmapped)}): {", ".join(unmapped)}')
        print('Добавь их в GROUP_CLASS или переименуй группы — иначе фигуры')
        print('останутся без класса и не будут раскрашены токенами.')

    print(f'\nвсего фигур: {total}')
    if a.dry_run or not a.dst:
        print('(dry-run, файл не записан)')
        return 1 if unmapped else 0

    Path(a.dst).write_text('\n'.join(out), encoding='utf-8')
    print(f'записано: {a.dst}')
    return 1 if unmapped else 0


if __name__ == '__main__':
    sys.exit(main())
