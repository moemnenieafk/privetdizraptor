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

# --- земля --------------------------------------------------------------------
# Поверхность нужна не для красоты: она ПРЯЧЕТ закопанную часть объектов и принимает тени.
# Строится по плитке, а не на всю карту: сетка высот бывает 4096x3448, целиком это ~14 млн
# вершин на кадр, а на плитку приходится пара сотен тысяч.
GROUND = JOB.get('ground')
_ground_mat = None


_holdout_mat = None


def holdout_material():
    """Материал-резак: объект не виден и не даёт цвета, но ПРЯЧЕТ всё, что за ним.

    Именно нода Holdout, а не object.is_holdout: свойство объекта живёт в Cycles,
    а нода работает и в EEVEE, и в Cycles — движок тут переключается флагом.
    Фон при этом остаётся прозрачным (film_transparent), то есть слой камней
    по-прежнему выходит на прозрачном, просто без закопанных и накрытых частей.
    """
    global _holdout_mat
    if _holdout_mat is not None:
        return _holdout_mat
    mat = bpy.data.materials.new('holdout')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = nt.nodes['Material Output']
    ho = nt.nodes.new('ShaderNodeHoldout')
    ho.location = (-220, 0)
    nt.links.new(out.inputs['Surface'], ho.outputs['Holdout'])
    _holdout_mat = mat
    return mat


def ground_material():
    global _ground_mat
    if _ground_mat is not None:
        return _ground_mat
    if (GROUND or {}).get('mode') == 'holdout':
        _ground_mat = holdout_material()
        return _ground_mat
    mat = bpy.data.materials.new('ground')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 1.0
    try:
        bsdf.inputs['Specular IOR Level'].default_value = 0.0
    except KeyError:
        pass
    if GROUND.get('material'):
        img = load_image(GROUND['material'], False)
        if img is not None:
            tex = nt.nodes.new('ShaderNodeTexImage')
            tex.image = img
            tex.interpolation = 'Closest'      # материал — классы, а не градиент: не мылить
            tex.location = (-600, 0)
            nt.links.new(bsdf.inputs['Base Color'], tex.outputs['Color'])
            _ground_mat = mat
            return mat
    c = GROUND.get('color') or [0.32, 0.33, 0.30]
    bsdf.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1.0)
    _ground_mat = mat
    return mat


_G = None
if GROUND and GROUND.get('npy'):
    _G = np.load(GROUND['npy'])
    log('земля: сетка высот %s, %.1f..%.1f м'
        % (_G.shape, float(np.nanmin(_G)), float(np.nanmax(_G))))
elif GROUND:
    log('земля: плоскость %.2f м' % GROUND['level'])


def build_ground_tile(t):
    """Кусок поверхности под плитку. Возвращает объект или None."""
    if not GROUND:
        return None
    half_w = float(t['orthoW']) / 2.0
    half_h = half_w * float(t.get('resY') or t['h']) / float(t['w'])
    x0, x1 = float(t['camX']) - half_w, float(t['camX']) + half_w
    z0, z1 = float(t['camY']) - half_h, float(t['camY']) + half_h
    me = bpy.data.meshes.new('ground_tile')

    if _G is None:                                    # плоскость: два треугольника
        lv = float(GROUND['level'])
        V = np.array([[x0, z0, lv], [x1, z0, lv], [x1, z1, lv], [x0, z1, lv]], dtype=np.float32)
        F = np.array([[0, 1, 2], [0, 2, 3]], dtype=np.int32)
        UV = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    else:
        gh, gw = _G.shape
        XMIN, XMAX = GROUND['xmin'], GROUND['xmax']
        ZMIN, ZMAX = GROUND['zmin'], GROUND['zmax']
        # мир -> индекс сетки (та же нормировка, что в mapgeom.Ground._uv, с отражением по X)
        def col_of(x):
            u = (x - XMIN) / (XMAX - XMIN) * (gw - 1)
            return (gw - 1) - u if GROUND.get('mirrorX') else u
        c_a, c_b = sorted((col_of(x0), col_of(x1)))
        r_a = (z0 - ZMIN) / (ZMAX - ZMIN) * (gh - 1)
        r_b = (z1 - ZMIN) / (ZMAX - ZMIN) * (gh - 1)
        c0 = max(0, int(math.floor(c_a)) - 2); c1 = min(gw - 1, int(math.ceil(c_b)) + 2)
        r0 = max(0, int(math.floor(min(r_a, r_b))) - 2)
        r1 = min(gh - 1, int(math.ceil(max(r_a, r_b))) + 2)
        if c1 <= c0 or r1 <= r0:
            return None
        # УПЛОТНЕНИЕ. Сетка высот вчетверо грубее кадра (4096 против 16384 у Леса), и на
        # таком шаге поверхность режет камни ступеньками — низ валуна выходит рваным.
        # Билинейно уплотняем ДО шага кадра: сетка не становится точнее как данные,
        # но перестаёт вносить свою ступеньку поверх честной геометрии.
        sub = max(1, int(GROUND.get('subdiv') or 1))
        cc = np.linspace(c0, c1, (c1 - c0) * sub + 1)
        rr = np.linspace(r0, r1, (r1 - r0) * sub + 1)
        uc = (gw - 1) - cc if GROUND.get('mirrorX') else cc
        xs = XMIN + uc / (gw - 1.0) * (XMAX - XMIN)
        zs = ZMIN + rr / (gh - 1.0) * (ZMAX - ZMIN)
        if sub == 1:
            Hp = _G[r0:r1 + 1, c0:c1 + 1].astype(np.float32)
        else:
            ri = np.clip(np.floor(rr).astype(np.int32), 0, gh - 2)
            ci = np.clip(np.floor(cc).astype(np.int32), 0, gw - 2)
            dr = (rr - ri)[:, None].astype(np.float32)
            dc = (cc - ci)[None, :].astype(np.float32)
            g00 = _G[np.ix_(ri, ci)].astype(np.float32)
            g01 = _G[np.ix_(ri, ci + 1)].astype(np.float32)
            g10 = _G[np.ix_(ri + 1, ci)].astype(np.float32)
            g11 = _G[np.ix_(ri + 1, ci + 1)].astype(np.float32)
            Hp = ((g00 * (1 - dc) + g01 * dc) * (1 - dr)
                  + (g10 * (1 - dc) + g11 * dc) * dr)
        if np.isnan(Hp).any():                        # дыры сетки — на уровень медианы
            Hp = np.where(np.isnan(Hp), np.nanmedian(Hp), Hp)
        nx, nz = len(cc), len(rr)
        XX = np.repeat(xs[None, :], nz, axis=0)
        ZZ = np.repeat(zs[:, None], nx, axis=1)
        V = np.stack([XX.ravel(), ZZ.ravel(), Hp.ravel()], axis=1).astype(np.float32)
        idx = np.arange(nz * nx).reshape(nz, nx)
        a_ = idx[:-1, :-1].ravel(); b_ = idx[:-1, 1:].ravel()
        c_ = idx[1:, 1:].ravel();   d_ = idx[1:, :-1].ravel()
        F = np.concatenate([np.stack([a_, b_, c_], axis=1),
                            np.stack([a_, c_, d_], axis=1)]).astype(np.int32)
        # UV по индексам сетки: карта материалов индексируется так же, отражение сокращается
        U = np.repeat((cc / (gw - 1.0))[None, :], nz, axis=0)
        Vv = np.repeat((1.0 - rr / (gh - 1.0))[:, None], nx, axis=1)
        UV = np.stack([U.ravel(), Vv.ravel()], axis=1).astype(np.float32)

    me.vertices.add(len(V))
    me.vertices.foreach_set('co', V.ravel())
    me.loops.add(len(F) * 3)
    me.loops.foreach_set('vertex_index', F.ravel())
    me.polygons.add(len(F))
    me.polygons.foreach_set('loop_start', np.arange(len(F), dtype=np.int32) * 3)
    me.update(calc_edges=True)
    me.uv_layers.new(name='UVMap')
    me.uv_layers[0].data.foreach_set('uv', UV[F.ravel()].ravel())
    me.validate(clean_customdata=False)
    me.update()
    me.materials.append(ground_material())
    ob = bpy.data.objects.new('ground_tile', me)
    scene.collection.objects.link(ob)
    return ob


# --- режущая геометрия (невидимая) ---------------------------------------------
OCCL_P = JOB.get('occlProtos') or {}
OCCL_I = JOB.get('occlInstances') or []
if OCCL_I:
    t0 = time.time()
    hm = holdout_material()
    occl_meshes = {}
    for nm, spec in OCCL_P.items():
        d = np.load(spec['npz'])
        V = d['v'].astype(np.float32)
        F = d['t0']
        if not len(V) or not len(F):
            continue
        me = bpy.data.meshes.new('o_' + nm)
        me.vertices.add(len(V))
        me.vertices.foreach_set('co', V.ravel())
        me.loops.add(len(F) * 3)
        me.loops.foreach_set('vertex_index', F.ravel())
        me.polygons.add(len(F))
        me.polygons.foreach_set('loop_start', np.arange(len(F), dtype=np.int32) * 3)
        me.update(calc_edges=True)
        me.validate(clean_customdata=False)
        me.materials.append(hm)
        occl_meshes[nm] = me
    n_occl = 0
    for k, r in enumerate(OCCL_I):
        me = occl_meshes.get(r['p'])
        if me is None:
            continue
        ob = bpy.data.objects.new('o%06d' % k, me)
        m = r['m']
        ob.matrix_world = Matrix((m[0:4], m[4:8], m[8:12], m[12:16]))
        coll.objects.link(ob)
        n_occl += 1
    log('РЕЗАК: мешей %d, экземпляров размещено %d за %.1f с'
        % (len(occl_meshes), n_occl, time.time() - t0))

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
    gob = build_ground_tile(t)
    bpy.ops.render.render(write_still=True)
    if gob is not None:                      # кусок земли живёт ровно одну плитку
        gme = gob.data
        bpy.data.objects.remove(gob, do_unlink=True)
        bpy.data.meshes.remove(gme)
    log('плитка %d/%d %s %dx%d за %.1f с'
        % (n + 1, len(tiles), t['file'], t['w'], t['h'], time.time() - ts))
log('ГОТОВО: плиток %d за %.1f с' % (len(tiles), time.time() - t0))
