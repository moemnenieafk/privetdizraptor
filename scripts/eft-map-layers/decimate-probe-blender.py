# -*- coding: utf-8 -*-
# Исполнитель ВНУТРИ Blender для decimate-probe.py. Сам не запускается:
#   blender --background --factory-startup --python decimate-probe-blender.py -- job.json
#
# ЧТО ЗДЕСЬ ВАЖНО ЗНАТЬ:
# - Мерим не «качество меша вообще», а ровно то, что видно в нашей сцене: СИЛУЭТ.
#   Clay без текстур, орто-камера, читаемость держат заполненная площадь и контур.
# - Рендер — Workbench, flat lighting, единый цвет. Никакого света и теней: нам нужна
#   бинарная маска «объект / фон», а не красивая картинка.
# - Два ракурса: строго сверху и под 45° с азимута 315° — тот же угол, под которым
#   в конвейере считается отмывка рельефа, и тот, на котором строится вид карты.
# - Decimate COLLAPSE = quadric edge collapse, тот же класс алгоритма, что gltfpack -si.
#   Берём его, потому что Blender уже в конвейере, а gltfpack пришлось бы ставить.
import json
import math
import os
import sys

import numpy as np

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not argv:
    raise SystemExit('нужен путь к job.json')
JOB = json.load(open(argv[0], encoding='utf-8'))
OUT = JOB['out']
PX = int(JOB.get('px', 900))


def log(m):
    print('[decimate-probe] %s' % m)
    sys.stdout.flush()


# --- чистая сцена ------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = PX
scene.render.resolution_y = PX
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'BW'
scene.render.film_transparent = False
shading = scene.display.shading
shading.light = 'FLAT'
shading.color_type = 'SINGLE'
shading.single_color = (1.0, 1.0, 1.0)
shading.show_specular_highlight = False
scene.world = bpy.data.worlds.new('w')
scene.world.color = (0.0, 0.0, 0.0)

# --- исходный меш ------------------------------------------------------------
z = np.load(JOB['npz'])
V = z['v'].astype(np.float64)
T = z['t'].astype(np.int64)
log('вершин %d, треугольников %d' % (len(V), len(T)))

mesh = bpy.data.meshes.new('orig')
mesh.from_pydata([tuple(p) for p in V], [], [tuple(t) for t in T])
mesh.validate(verbose=False)
mesh.update()
base = bpy.data.objects.new('orig', mesh)
scene.collection.objects.link(base)

bmin = Vector(JOB['min'])
bmax = Vector(JOB['max'])
center = (bmin + bmax) * 0.5
# Запас 1.6, а не 1.15: под 45° в кадр попадает диагональ основания плюс высота,
# и при 1.15 здание вылезало за границы — первая версия пробника резала силуэт краем
# кадра, что портит и IoU, и оценку узнаваемости.
size = math.hypot((bmax - bmin).x, (bmax - bmin).z) * 1.15 + (bmax - bmin).y

# --- камеры ------------------------------------------------------------------
# Unity-оси в дампе: X вправо, Y вверх, Z вперёд. Blender: Z вверх.
# Меш кладём как есть, а камеры считаем в тех же осях исходника.
cams = {}
for tag, (az, el) in {'top': (0.0, 90.0), 'iso': (315.0, 45.0)}.items():
    cd = bpy.data.cameras.new('cam_' + tag)
    cd.type = 'ORTHO'
    cd.ortho_scale = size
    cam = bpy.data.objects.new('cam_' + tag, cd)
    scene.collection.objects.link(cam)
    a = math.radians(az)
    e = math.radians(el)
    d = size * 3.0
    # направление на камеру в осях (X вправо, Y вверх, Z вперёд)
    dir_v = Vector((math.cos(e) * math.sin(a), math.sin(e), math.cos(e) * math.cos(a)))
    cam.location = center + dir_v * d
    look = (center - cam.location).normalized()
    cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
    cams[tag] = cam


def render(obj, tag, path, shaded=False):
    """Два режима: маска (FLAT, для IoU) и затенённый вид (STUDIO, для глаза).

    Зачем второй. FLAT даёт ровное белое пятно — по нему считается площадь силуэта,
    но НЕЛЬЗЯ судить, узнаётся ли здание. А узнаваемость и есть цель всей части C.
    Поэтому для оригинала и самого сжатого варианта дополнительно рендерим с
    затенением: там видно, сохранились ли объёмы, скаты крыш и выступы.
    """
    for o in scene.collection.objects:
        if o.type == 'MESH':
            o.hide_render = (o is not obj)
    scene.camera = cams[tag]
    if shaded:
        shading.light = 'STUDIO'
        shading.color_type = 'SINGLE'
        shading.single_color = (0.55, 0.57, 0.60)
        shading.show_shadows = True
        scene.render.image_settings.color_mode = 'RGB'
    else:
        shading.light = 'FLAT'
        shading.single_color = (1.0, 1.0, 1.0)
        shading.show_shadows = False
        scene.render.image_settings.color_mode = 'BW'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def mask_of(path):
    """Маска «объект/фон» из отрендеренного PNG.

    ГОЧА: в питоне Blender НЕТ PIL — первый заход пробника упал молча именно на нём.
    Читаем встроенным загрузчиком: pixels это плоский RGBA float, снизу вверх;
    для сравнения масок порядок строк не важен, лишь бы он был одинаков у всех.
    """
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    a = buf.reshape(h, w, 4)[:, :, 0]
    bpy.data.images.remove(img)
    return a > 0.376  # ~96/255


def perimeter(m):
    """Длина контура маски в пикселях: граничные пиксели объекта."""
    p = np.zeros_like(m)
    p[1:, :] |= m[1:, :] & ~m[:-1, :]
    p[:-1, :] |= m[:-1, :] & ~m[1:, :]
    p[:, 1:] |= m[:, 1:] & ~m[:, :-1]
    p[:, :-1] |= m[:, :-1] & ~m[:, 1:]
    return int(p.sum())


# --- прогон ------------------------------------------------------------------
rows = []
refs = {}
for tag in ('top', 'iso'):
    p = os.path.join(OUT, '%s-%s-orig.png' % (JOB['name'], tag))
    render(base, tag, p)
    refs[tag] = mask_of(p)
    render(base, tag, os.path.join(OUT, '%s-%s-orig-shaded.png' % (JOB['name'], tag)),
           shaded=True)

rows.append({
    'ratio': 1.0, 'tris': len(T),
    'iou_top': 1.0, 'iou_iso': 1.0,
    'perim_top': perimeter(refs['top']), 'perim_iso': perimeter(refs['iso']),
    'perim_dev_top': 0.0, 'perim_dev_iso': 0.0,
})

for r in JOB['ratios']:
    dup = base.copy()
    dup.data = base.data.copy()
    dup.name = 'dec_%g' % r
    scene.collection.objects.link(dup)
    m = dup.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = r
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.modifier_apply(modifier='dec')
    tris = len(dup.data.loop_triangles) or sum(
        len(p.vertices) - 2 for p in dup.data.polygons)
    dup.data.calc_loop_triangles()
    tris = len(dup.data.loop_triangles)

    row = {'ratio': r, 'tris': tris}
    for tag in ('top', 'iso'):
        p = os.path.join(OUT, '%s-%s-r%g.png' % (JOB['name'], tag, r))
        render(dup, tag, p)
        mm = mask_of(p)
        ref = refs[tag]
        inter = int((mm & ref).sum())
        union = int((mm | ref).sum())
        row['iou_' + tag] = round(inter / union, 5) if union else 0.0
        pr = perimeter(mm)
        p0 = perimeter(ref)
        row['perim_' + tag] = pr
        row['perim_dev_' + tag] = round((pr - p0) / p0, 4) if p0 else 0.0
        render(dup, tag,
               os.path.join(OUT, '%s-%s-r%g-shaded.png' % (JOB['name'], tag, r)),
               shaded=True)
    rows.append(row)
    log('ratio %-5g tris %-8d IoU top %.4f  iso %.4f'
        % (r, tris, row['iou_top'], row['iou_iso']))
    bpy.data.objects.remove(dup, do_unlink=True)

json.dump({'name': JOB['name'], 'rows': rows},
          open(os.path.join(OUT, 'report.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=2)

log('')
log('%-8s %-10s %-9s %-9s %-11s %-11s' % (
    'ratio', 'tris', 'IoU top', 'IoU iso', 'перим top', 'перим iso'))
for r in rows:
    log('%-8g %-10d %-9.4f %-9.4f %-+11.2f%% %-+11.2f%%' % (
        r['ratio'], r['tris'], r['iou_top'], r['iou_iso'],
        r['perim_dev_top'] * 100, r['perim_dev_iso'] * 100))
