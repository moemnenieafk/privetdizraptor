# -*- coding: utf-8 -*-
# Исполнитель ВНУТРИ Blender для clay-preview.py:
#   blender --background --factory-startup --python clay-preview-blender.py -- job.json
#
# Задача — показать ВИД, а не построить движок. Поэтому здесь офлайновый EEVEE, а не
# попытка сымитировать three.js. Всё, что должно совпасть с будущей сценой, — это
# язык: тёмная лестница NIGHTFALL, приглушённая застройка, контур несёт читаемость,
# светится только слой данных.
#
# Цвета — ровно токены проекта (решение №15), ни одного нового HEX:
#   --color-darkbase  #0D0D0E  земля
#   --color-base      #141416  подложка
#   --color-card-menu #242426  застройка
#   --color-lines-hover #313135 препятствия
#   --primary         #E68E25  слой данных (EFT-янтарь)
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not argv:
    raise SystemExit('нужен путь к job.json')
JOB = json.load(open(argv[0], encoding='utf-8'))
OUT = JOB['out']
PX = int(JOB.get('px', 1600))


def log(m):
    print('[clay-preview] %s' % m)
    sys.stdout.flush()


def srgb_to_linear(h):
    """Токен NIGHTFALL → цвет материала.

    ГОЧА, стоившая трёх чёрных кадров: если честно перевести #141416 в линейное
    пространство (0.0065) и рендерить со Standard, на выходе получается 1/255 —
    кадр визуально чёрный. Лестница NIGHTFALL сама по себе почти чёрная, и
    двойное затемнение её добивает. Для ПРЕВЬЮ берём значения как есть
    (колориметрически неточно, зато видно то, что задумано дизайном).
    """
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


DARKBASE = srgb_to_linear('#0D0D0E')
BASE = srgb_to_linear('#141416')
CARD = srgb_to_linear('#242426')
LINES = srgb_to_linear('#313135')
PRIMARY = srgb_to_linear('#E68E25')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
# ГОЧА: EEVEE в `--background` без GPU-контекста отдаёт ЧЁРНЫЙ кадр (проверено:
# два прогона подряд, менял tone mapping и свет — не помогло). Cycles на CPU в
# headless работает штатно, а нам тут важна не скорость, а картинка.
scene.render.engine = os.environ.get('PREVIEW_ENGINE','CYCLES')
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = PX
scene.render.resolution_y = PX
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
# ГОЧА: AgX давит тени, а лестница NIGHTFALL и так почти чёрная (#0D0D0E…#313135) —
# первый кадр вышел полностью чёрным. Для превью берём Standard и добавляем экспозицию.
scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = 0.0

world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.20, 0.21, 0.24, 1.0)
# ГОЧА: чёрные провалы внутри зданий оказались НЕ дырами в геометрии
# (триангуляция проверена: 846 крышек на 436 полигонов), а глухой тенью —
# солнце под 52° не достаёт в промежутки между выдавленными помещениями,
# а заполняющего света было слишком мало. Поднимаем ambient.
world.node_tree.nodes['Background'].inputs[1].default_value = 1.15
scene.world = world


def mat(name, color, emission=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.92
    bsdf.inputs['Metallic'].default_value = 0.0
    if alpha < 1.0:
        # Призрачные этажи — полупрозрачные: разницы в яркости материала
        # не хватало, при общем освещении фокус и призрак сливались.
        bsdf.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else m.blend_method
    if emission:
        bsdf.inputs['Emission Color'].default_value = color
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


M_GROUND = mat('ground', (0.022, 0.022, 0.026, 1.0))
M_BUILD = mat('building', (0.150, 0.155, 0.168, 1.0))
M_OBST = mat('obstacle', (0.115, 0.118, 0.127, 1.0))
# Стены-сечения чуть светлее корпусов: они читаются как рёбра внутри объёма.
M_WALL = mat('wall', (0.190, 0.196, 0.210, 1.0))
# Масса корпуса — темнее помещений, чтобы читалась как «тело» здания под ними.
M_MASS = mat('mass', (0.118, 0.122, 0.132, 1.0))
# Призрачные этажи: только рёбра, чуть светлее фона — «чертёж» под фокусом.
M_GHOST = mat('ghost', (0.075, 0.079, 0.090, 1.0), alpha=0.22)
# Предметы (бочки, машины, штабели) заметно темнее построек: они фон, не форма.
M_PROP = mat('prop', (0.098, 0.101, 0.110, 1.0))
# Детали из клиента (лестницы, фермы) — светлее застройки: это то, ради чего
# вообще берётся часть C гибрида, они должны читаться.
M_MESH = mat('clientmesh', (0.225, 0.232, 0.248, 1.0))
M_ROUTE = mat('route', PRIMARY, emission=4.5)


def flat_faces_h(polys, heights):
    """Плоские грани, сгруппированные по высоте: Solidify задаётся на объект,
    поэтому под каждую высоту нужен свой меш."""
    buckets = {}
    for poly, hh in zip(polys, heights):
        buckets.setdefault(round(hh, 3), []).append(poly)
    return buckets


def flat_faces(polys, z0=0.0):
    """Плоские n-угольники на z=0: вершины + грани, без ручной триангуляции.

    🔴 ПОЧЕМУ ТАК. Ручная сборка призм (крышка через `tessellate_polygon`, дно,
    стенки) давала часть комнат чёрными сверху — «дыры в зданиях». Перебрали:
    нормализацию обхода контура, `recalc_face_normals`, поднятие ambient,
    проверку триангуляции — ни одно не помогло. Вместо дальнейшего гадания
    отдаём объём штатному Solidify: Blender сам строит вторую поверхность,
    стенки и согласованные нормали.
    """
    V, F, off = [], [], 0
    for poly in polys:
        if len(poly) < 3:
            continue
        V.extend((p[0], p[1], z0) for p in poly)
        F.append(list(range(off, off + len(poly))))
        off += len(poly)
    return V, F


# --- геометрия: этажи ---------------------------------------------------------
# Фокус + призраки (решение №29): выбранный этаж — полный объём, остальные только
# контуром. Так и бюджет держится (в кадре один этаж), и вертикаль видна.
FOCUS = JOB.get('focus')
allx, allz = [], []
for g in JOB['groups']:
    if g['tag'] == 'clientmesh':
        # Готовые треугольники из клиента — без Solidify и без экструзии.
        me = bpy.data.meshes.new('clientmesh')
        # 🔴 СМЕНА ОСЕЙ. Дамп клиента в осях Unity (X вправо, Y ВВЕРХ, Z вперёд),
        # а сцена превью строится в осях Blender (Z вверх), потому что контуры
        # приходят как (x, z) плоскости. Без перестановки лестница ложится набок
        # и кадр выходит пустым — проверено.
        me.from_pydata([(v[0], v[2], v[1]) for v in g['verts']], [],
                       [tuple(t) for t in g['tris']])
        me.validate(verbose=False)
        me.update()
        ob = bpy.data.objects.new('clientmesh', me)
        ob.data.materials.append(M_MESH)
        scene.collection.objects.link(ob)
        for v in g['verts']:
            allx.append(v[0])
            allz.append(v[2])
        log('геометрия клиента: %d треугольников' % len(g['tris']))
        continue
    for poly in g['polys']:
        for p in poly:
            allx.append(p[0])
            allz.append(p[1])
    V, F = flat_faces(g['polys'], g.get('z0', 0.0))
    if not V:
        continue
    ghost = bool(FOCUS) and g.get('floor') != FOCUS
    me = bpy.data.meshes.new('%s_%s' % (g['tag'], g.get('floor', '')))
    me.from_pydata(V, [], F)
    me.validate(verbose=False)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(me.name, me)
    sol = ob.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = g['height']
    sol.offset = 1.0
    sol.use_even_offset = False
    # ГОЧА: модификатор WIREFRAME на объединённом меше этажа дал кашу из длинных
    # «спиц» через всю карту. Призраки делаем иначе: материал почти под цвет фона,
    # а рёбра им рисует Freestyle, который в сцене и так включён. Это и есть
    # «призраки только контуром» из решения №29, причём бесплатно.
    if ghost:
        ob.data.materials.append(M_GHOST)
    else:
        ob.data.materials.append(M_BUILD if g['tag'] == 'build' else M_PROP)
    scene.collection.objects.link(ob)
    log('%-12s полигонов %4d  z0=%+.1f  %s'
        % (g.get('floor', g['tag']), len(g['polys']), g.get('z0', 0.0),
           'призрак' if ghost else 'ФОКУС'))

if not allx:
    raise SystemExit('пустая геометрия')

# Центр — по МЕДИАНЕ вершин, а не по середине габарита: у карты есть выносные
# постройки на отшибе, и центр габарита уводит камеру в пустое поле.
if JOB.get('center'):
    cx, cz = [float(v) for v in JOB['center'].split(',')]
else:
    allx_s = sorted(allx)
    allz_s = sorted(allz)
    cx = allx_s[len(allx_s) // 2]
    cz = allz_s[len(allz_s) // 2]
zoom = float(JOB.get('zoom', 1.0))
span = max(max(allx) - min(allx), max(allz) - min(allz)) * zoom
log('рамка %.0f×%.0f м, центр (%.1f, %.1f)'
    % (max(allx) - min(allx), max(allz) - min(allz), cx, cz))

# земля
# Земля строится от ПОЛНОГО габарита, а не от span с учётом зума: иначе при
# приближении плоскость не докрывает кадр и по краям светит фон мира.
full_span = max(max(allx) - min(allx), max(allz) - min(allz))
bpy.ops.mesh.primitive_plane_add(size=full_span * 3.0, location=(cx, cz, -0.05))
ground = bpy.context.active_object
ground.data.materials.append(M_GROUND)

# --- маршрут -----------------------------------------------------------------
route = JOB.get('route') or []
if len(route) >= 2:
    cu = bpy.data.curves.new('route', 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(route) - 1)
    for i, (x, z) in enumerate(route):
        sp.points[i].co = (x, z, 4.2, 1.0)
    cu.bevel_depth = 1.1
    cu.bevel_resolution = 3
    ob = bpy.data.objects.new('route', cu)
    ob.data.materials.append(M_ROUTE)
    scene.collection.objects.link(ob)

    # пины-капли на концах — объёмные, как в референсе
    for (x, z) in (route[0], route[-1]):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=3.2, location=(x, z, 11.0),
                                             segments=20, ring_count=12)
        pin = bpy.context.active_object
        pin.scale = (1.0, 1.0, 1.35)
        pin.data.materials.append(M_ROUTE)
        bpy.ops.mesh.primitive_cone_add(radius1=2.2, radius2=0.0, depth=7.0,
                                        location=(x, z, 5.2), vertices=20)
        tip = bpy.context.active_object
        tip.rotation_euler = (math.pi, 0, 0)
        tip.data.materials.append(M_ROUTE)
    log('маршрут: %d узлов + 2 пина' % len(route))

# --- свет --------------------------------------------------------------------
sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 2.0
sun.angle = math.radians(6)
so = bpy.data.objects.new('sun', sun)
so.rotation_euler = (math.radians(52), 0.0, math.radians(315))
scene.collection.objects.link(so)

fill = bpy.data.lights.new('fill', 'SUN')
fill.energy = 1.0
fo = bpy.data.objects.new('fill', fill)
fo.rotation_euler = (math.radians(35), 0.0, math.radians(135))
scene.collection.objects.link(fo)

# --- камера ------------------------------------------------------------------
cd = bpy.data.cameras.new('cam')
cd.type = 'ORTHO'
cd.ortho_scale = span * 1.12
# 🔴 ГОЧА, стоившая четырёх чёрных кадров и часа диагностики: дефолтный clip_end
# камеры в Blender — 100 м, а карта в игровых метрах, и камера стоит в ~3 км от
# сцены. Вся геометрия отсекалась дальней плоскостью. Проекция при этом была
# идеальной (u[0.03..0.97]), поэтому подозрение долго падало на свет и материалы.
cd.clip_start = 1.0
cd.clip_end = span * 12.0
cam = bpy.data.objects.new('cam', cd)
scene.collection.objects.link(cam)
az, el = math.radians(float(JOB.get('az', 315))), math.radians(float(JOB.get('el', 52)))
d = span * 3.0
cam.location = (cx + math.cos(el) * math.sin(az) * d,
                cz + math.cos(el) * math.cos(az) * d,
                math.sin(el) * d)
look = (Vector((cx, cz, 0)) - cam.location).normalized()
cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

# --- контур (Freestyle) ------------------------------------------------------
# Контур — несущая конструкция читаемости (решение №15 и «визуальный референс»),
# поэтому он здесь не украшение, а обязательный слой.
scene.render.use_freestyle = True
vl = scene.view_layers[0]
vl.freestyle_settings.mode = 'EDITOR'
vl.freestyle_settings.crease_angle = math.radians(115)
ls = vl.freestyle_settings.linesets.new('contours')
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = True
ls.linestyle.color = (0.62, 0.64, 0.68)
ls.linestyle.thickness = 1.05
ls.linestyle.alpha = 0.85

# --- свечение --------------------------------------------------------------
# Компоузер убран: собранное через новое API Blender 5 дерево
# (`scene.compositing_node_group` + NodeGroupInput) отдавало ПУСТОЙ кадр и было
# пятой причиной чёрных рендеров. Для превью ореол не нужен — свечение маршрута
# читается за счёт emission, а bloom добавим в three.js через selective bloom.

# --- диагностика перед рендером ---------------------------------------------
# Два чёрных кадра подряд (EEVEE и Cycles) — значит проблема не в движке.
# Печатаем то, что реально в сцене: сколько полигонов уцелело после validate,
# где габарит и куда смотрит камера.
for o in scene.collection.objects:
    if o.type == 'MESH':
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
        log('OBJ %-10s polys=%-6d x[%.0f..%.0f] y[%.0f..%.0f] z[%.1f..%.1f]'
            % (o.name, len(o.data.polygons), min(xs), max(xs),
               min(ys), max(ys), min(zs), max(zs)))
log('CAM loc=(%.0f, %.0f, %.0f) ortho=%.0f' %
    (cam.location.x, cam.location.y, cam.location.z, cd.ortho_scale))
from bpy_extras.object_utils import world_to_camera_view as w2c
bpy.context.view_layer.update()
for o in scene.collection.objects:
    if o.type == 'MESH' and o.name in ('building', 'Plane'):
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        uv = [w2c(scene, cam, q) for q in pts]
        log('PROJ %-8s u[%.2f..%.2f] v[%.2f..%.2f] z[%.0f..%.0f]'
            % (o.name, min(p.x for p in uv), max(p.x for p in uv),
               min(p.y for p in uv), max(p.y for p in uv),
               min(p.z for p in uv), max(p.z for p in uv)))

scene.render.filepath = OUT
log('рендер %d×%d …' % (PX, PX))
bpy.ops.render.render(write_still=True)
log('сохранено: %s' % OUT)
