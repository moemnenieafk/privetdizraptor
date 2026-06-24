# Blender headless: meta.json (от extract_item.py) -> 512px PNG иконка предмета EFT.
# blender --background --python render_item.py -- --meta <dir/meta.json> --out <png> [--res 512]
import bpy, math, sys, json, argparse
from mathutils import Quaternion, Vector

def get_args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--meta", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--res", type=int, default=512)
    p.add_argument("--rough", type=float, default=0.34)
    return p.parse_args(a)

A = get_args()
meta = json.load(open(A.meta, encoding="utf-8"))

bpy.ops.wm.read_factory_settings(use_empty=True)

parts = []
for part in meta["parts"]:
    bpy.ops.wm.obj_import(filepath=part["obj"])
    obj = bpy.context.view_layer.objects.active or bpy.context.selected_objects[-1]
    # материал
    mat = bpy.data.materials.new("m"); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
    if part.get("albedo"):
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(part["albedo"])
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (0.6, 0.6, 0.62, 1)
    if part.get("normal"):
        ni = bpy.data.images.load(part["normal"]); ni.colorspace_settings.name = "Non-Color"
        nx = nt.nodes.new("ShaderNodeTexImage"); nx.image = ni
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nx.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = A.rough
    if "Specular IOR Level" in bsdf.inputs: bsdf.inputs["Specular IOR Level"].default_value = 0.5
    obj.data.materials.clear(); obj.data.materials.append(mat)
    parts.append(obj)

# объединяем габариты всех частей
bpy.ops.object.select_all(action="DESELECT")
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
if len(parts) > 1: bpy.ops.object.join()
item = bpy.context.view_layer.objects.active
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
item.location = (0, 0, 0)
bb = [item.matrix_world @ Vector(c) for c in item.bound_box]
center = sum(bb, Vector()) / 8.0
radius = max((v - center).length for v in bb)

# world-окружение (ровный свет + отражения)
world = bpy.data.worlds.new("w"); bpy.context.scene.world = world; world.use_nodes = True
wbg = world.node_tree.nodes["Background"]
wbg.inputs["Color"].default_value = (0.45, 0.46, 0.5, 1); wbg.inputs["Strength"].default_value = 0.6
for ang, e in [((0.62, -0.45, 0.7), 4.8), ((-0.55, 0.5, 0.4), 1.7), ((0.1, 0.7, -0.7), 1.6)]:
    L = bpy.data.lights.new("L", "SUN"); L.energy = e; L.angle = math.radians(8)
    lo = bpy.data.objects.new("L", L); bpy.context.scene.collection.objects.link(lo); lo.rotation_euler = Vector(ang)

# камера: Icon.rotation Unity->Blender = raw reorder (w,x,y,z); FOV из perspective
x, y, z, w = meta["iconRotation"]
q = Quaternion((w, x, y, z))
fov = float(meta.get("perspective", 15.0))
bounds = float(meta.get("boundsScale", 0.9))
cd = bpy.data.cameras.new("c")
if meta.get("orthographic"):
    cd.type = "ORTHO"; cd.ortho_scale = radius * 2.2 / max(bounds, 0.1)
else:
    cd.lens_unit = "FOV"; cd.angle = math.radians(fov)
cam = bpy.data.objects.new("c", cd); bpy.context.scene.collection.objects.link(cam); bpy.context.scene.camera = cam
dist = (radius / bounds) / math.tan(math.radians(fov) / 2.0) if not meta.get("orthographic") else radius * 3
cam.location = center - (q @ Vector((0, 0, -1))) * dist
cam.rotation_mode = "QUATERNION"; cam.rotation_quaternion = q

sc = bpy.context.scene
eng = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in eng else "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = A.res
sc.render.film_transparent = True
try: sc.view_settings.view_transform = "Standard"
except Exception: pass
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.render.filepath = A.out
bpy.ops.render.render(write_still=True)
print("RENDERED ->", A.out)
