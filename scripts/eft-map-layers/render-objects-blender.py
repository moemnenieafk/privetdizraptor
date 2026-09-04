# -*- coding: utf-8 -*-
# Исполнитель рендера ВНУТРИ Blender. Сам по себе не запускается — его зовёт
# scripts/eft-map-layers/render-objects.py:
#   blender --background --factory-startup --python render-objects-blender.py -- <job.json>
#
# job.json: прототипы (npz с вершинами/нормалями/UV/треугольниками + материалы с путями к PNG),
# экземпляры (имя прототипа + матрица 4x4 уже в осях Blender), плитки камеры, свет.
#
# ЧТО ВАЖНО ЗНАТЬ ПРО ЭТУ СЦЕНУ:
# - Камера ортографическая, смотрит вниз, РОЛЛ 180 градусов: это и есть coordinateRotation=180
#   растра карты. Тогда «вправо» = -X, «вниз» = +Y, что совпадает с аффиной рамки комнат.
# - Пиксель НЕквадратный: масштаб растра по X (15.311 px/m) и по Z (15.211 px/m) чуть разный,
#   поэтому pixel_aspect_y = ppmX/ppmZ. Иначе слой уезжает на полпроцента по вертикали.
# - Плитки: 135 мегапикселей целиком в GPU не лезут, кадр режется на плитки сдвигом камеры
#   (не border-render), плитки сшиваются снаружи. Сдвиг камеры точен по построению: у
#   ортокамеры мировые метры на пиксель одинаковы в любой плитке.
# - Свет солнца 315/45 — тот же, что у отмывки рельефа (build-heightmap.py), плюс мягкая
#   заливка от мира, чтобы теневые бока не проваливались в чёрное.

import json, math, os, sys, time

import numpy as np

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not argv:
    raise SystemExit('нужен путь к job.json')
JOB = json.load(open(argv[0], encoding='utf-8'))


def log(msg):
    print('[render-objects] ' + msg)
    sys.stdout.flush()


# --- чистая сцена -------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# --- материалы ----------------------------------------------------------------
_img_cache = {}


def load_image(path, non_color):
    if path in _img_cache:
        return _img_cache[path]
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = 'Non-Color' if non_color else 'sRGB'
    _img_cache[path] = img
    return img


_mat_cache = {}


def make_material(spec, tag):
    key = (spec.get('base'), spec.get('normal'), spec.get('alphaClip'),
           round(spec.get('cutoff', 0.5), 3), tuple(spec.get('color') or ()))
    if key in _mat_cache:
        return _mat_cache[key]
    mat = bpy.data.materials.new('%s_%s' % (tag, spec.get('name') or 'mat'))
    mat.use_nodes = True
    mat.use_backface_culling = False        # листва — двусторонние карточки
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.86
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.22
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = 0.22

    col = spec.get('color') or [1, 1, 1, 1]
    base = spec.get('base')
    if base and os.path.exists(base):
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = load_image(base, False)
        tex.interpolation = 'Smart'
        tex.location = (-600, 200)
        if col[:3] != [1.0, 1.0, 1.0]:
            mix = nt.nodes.new('ShaderNodeMixRGB')
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Fac'].default_value = 1.0
            mix.inputs['Color2'].default_value = (col[0], col[1], col[2], 1.0)
            nt.links.new(tex.outputs['Color'], mix.inputs['Color1'])
            nt.links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
        else:
            nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if spec.get('alphaClip'):
            cut = nt.nodes.new('ShaderNodeMath')
            cut.operation = 'GREATER_THAN'
            cut.inputs[1].default_value = float(spec.get('cutoff', 0.5)) or 0.4
            cut.location = (-320, -160)
            nt.links.new(tex.outputs['Alpha'], cut.inputs[0])
            nt.links.new(cut.outputs['Value'], bsdf.inputs['Alpha'])
    else:
        bsdf.inputs['Base Color'].default_value = (col[0], col[1], col[2], 1.0)

    nrm = spec.get('normal')
    if nrm and os.path.exists(nrm):
        ntex = nt.nodes.new('ShaderNodeTexImage')
        ntex.image = load_image(nrm, True)
        ntex.location = (-600, -260)
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.location = (-320, -260)
        nmap.inputs['Strength'].default_value = 0.9
        nt.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])

    # Режим смешивания: в 4.2+ 'CLIP' у blend_method убрали, порог уже вшит нодой GREATER_THAN,
    # поэтому достаточно 'DITHERED'/'BLENDED' — альфа и так строго 0/1.
    if spec.get('alphaClip'):
        for cand in ('CLIP', 'DITHERED', 'BLENDED'):
            try:
                mat.blend_method = cand
                break
            except (TypeError, AttributeError):
                continue
        try:
            mat.shadow_method = 'CLIP'
        except (TypeError, AttributeError):
            pass
    _mat_cache[key] = mat
    return mat


# --- меши прототипов ----------------------------------------------------------
def build_mesh(name, spec):
    d = np.load(spec['npz'])
    V = d['v'].astype(np.float32)
    tris, midx = [], []
    for i in range(spec['submeshes']):
        k = 't%d' % i
        if k not in d:
            continue
        t = d[k]
        tris.append(t)
        midx.append(np.full(len(t), i, dtype=np.int32))
    if not tris:
        return None
    F = np.concatenate(tris)
    MI = np.concatenate(midx)

    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set('co', V.ravel())
    me.loops.add(len(F) * 3)
    me.loops.foreach_set('vertex_index', F.ravel())
    me.polygons.add(len(F))
    me.polygons.foreach_set('loop_start', np.arange(len(F), dtype=np.int32) * 3)
    me.polygons.foreach_set('material_index', MI)
    me.update(calc_edges=True)

    if 'uv' in d:
        uv = d['uv'].astype(np.float32)
        me.uv_layers.new(name='UVMap')
        me.uv_layers[0].data.foreach_set('uv', uv[F.ravel()].ravel())

    me.validate(clean_customdata=False)
    me.update()

    for i in range(spec['submeshes']):
        me.materials.append(make_material(spec['materials'][i], name))

    if 'n' in d:
        try:
            me.shade_smooth()
            N = d['n'].astype(np.float32)
            me.normals_split_custom_set_from_vertices(N)
        except Exception as e:
            log('нормали %s не встали (%s) — гладкое затенение по геометрии'
                % (name, type(e).__name__))
    return me


log('прототипов: %d' % len(JOB['protos']))
meshes = {}
for nm, spec in JOB['protos'].items():
    me = build_mesh(nm, spec)
    if me is not None:
        meshes[nm] = me
log('мешей собрано: %d, материалов %d' % (len(meshes), len(_mat_cache)))

# --- экземпляры ---------------------------------------------------------------
coll = scene.collection
t0 = time.time()
placed = 0
for k, inst in enumerate(JOB['instances']):
    me = meshes.get(inst['p'])
    if me is None:
        continue
    ob = bpy.data.objects.new('i%06d' % k, me)
    m = inst['m']
    ob.matrix_world = Matrix((m[0:4], m[4:8], m[8:12], m[12:16]))
    coll.objects.link(ob)
    placed += 1
log('экземпляров размещено: %d за %.1f с' % (placed, time.time() - t0))

# --- свет и мир ---------------------------------------------------------------
az = math.radians(JOB.get('sunAzimuth', 315.0))
el = math.radians(JOB.get('sunElevation', 45.0))
# компас растра: восток = «вправо» = -X, север = «вверх» = -Y (камера с роллом 180)
h = Vector((-math.sin(az), -math.cos(az), 0.0))
S = Vector((h.x * math.cos(el), h.y * math.cos(el), math.sin(el)))
sun_data = bpy.data.lights.new('sun', type='SUN')
sun_data.energy = float(JOB.get('sunEnergy', 3.2))
sun_data.angle = math.radians(2.5)
sun_data.color = (1.0, 0.96, 0.90)
sun = bpy.data.objects.new('sun', sun_data)
sun.rotation_euler = S.to_track_quat('Z', 'Y').to_euler()
coll.objects.link(sun)
log('солнце: азимут %.0f, высота %.0f, вектор на источник (%.3f, %.3f, %.3f)'
    % (math.degrees(az), math.degrees(el), S.x, S.y, S.z))

world = bpy.data.worlds.new('w')
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.52, 0.58, 0.68, 1.0)
bg.inputs['Strength'].default_value = float(JOB.get('ambient', 0.55))
scene.world = world

# --- камера -------------------------------------------------------------------
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.sensor_fit = 'HORIZONTAL'
cam_data.clip_start = 1.0
cam_data.clip_end = 6000.0
cam = bpy.data.objects.new('cam', cam_data)
cam.rotation_euler = (0.0, 0.0, math.pi)      # вид сверху + ролл 180 = coordinateRotation
coll.objects.link(cam)
scene.camera = cam

# --- движок -------------------------------------------------------------------
engines = bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys()
if JOB.get('engine') == 'cycles' and 'CYCLES' in engines:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = int(JOB.get('samples', 32))
    scene.cycles.use_denoising = True
else:
    scene.render.engine = ('BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines
                           else 'BLENDER_EEVEE')
    ee = scene.eevee
    ee.taa_render_samples = int(JOB.get('samples', 32))
    for attr, val in (('use_shadows', True), ('use_soft_shadows', True),
                      ('use_gtao', True), ('use_raytracing', True)):
        if hasattr(ee, attr):
            try:
                setattr(ee, attr, val)
            except Exception:
                pass
log('движок: %s' % scene.render.engine)

scene.render.film_transparent = True
scene.render.pixel_aspect_x = 1.0
scene.render.pixel_aspect_y = float(JOB.get('pixelAspectY', 1.0))
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.compression = 15
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'

# --- плитки -------------------------------------------------------------------
tiledir = JOB['tiledir']
os.makedirs(tiledir, exist_ok=True)
tiles = JOB['tiles']
t0 = time.time()
for n, t in enumerate(tiles):
    scene.render.resolution_x = int(t['w'])
    # высота РЕНДЕРА, а не высота плитки в рамке: пиксель квадратный, растянет сшивка
    scene.render.resolution_y = int(t.get('resY') or t['h'])
    cam_data.ortho_scale = float(t['orthoW'])
    cam.location = (float(t['camX']), float(t['camY']), 2500.0)
    scene.render.filepath = os.path.join(tiledir, t['file'])
    ts = time.time()
    bpy.ops.render.render(write_still=True)
    log('плитка %d/%d %s %dx%d за %.1f с'
        % (n + 1, len(tiles), t['file'], t['w'], t['h'], time.time() - ts))
log('ГОТОВО: плиток %d за %.1f с' % (len(tiles), time.time() - t0))
