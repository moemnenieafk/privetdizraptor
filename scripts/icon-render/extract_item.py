# -*- coding: utf-8 -*-
# Генерализованный экстрактор: бандл предмета EFT -> меши(OBJ) + текстуры(PNG) + meta.json
# (Icon-параметры PreviewPivot для камеры). Зависимости резолвятся через Windows.json.
# Запуск: python extract_item.py --bundle <key|disk-path> --out <dir> [--win <StreamingAssets/Windows>]
#
# Полностью офлайн (только файлы EFT), BattlEye-safe. См. docs/SPRINT-ICON-RENDER-PIPELINE.md.
import os, sys, json, argparse
import UnityPy

def norm_key(p, win):
    p = p.replace("\\", "/")
    i = p.lower().find("streamingassets/windows/")
    if i >= 0:
        return p[i + len("streamingassets/windows/"):]
    return p

def disk(win, key):
    return os.path.join(win, key.replace("/", os.sep))

def collect_deps(catalog, key):
    seen, stack = set(), [key]
    while stack:
        k = stack.pop()
        if k in seen:
            continue
        seen.add(k)
        for d in catalog.get(k, {}).get("Dependencies", []):
            if d not in seen:
                stack.append(d)
    return seen

def components(go):
    out = []
    for c in getattr(go, "m_Components", []):
        try:
            ref = c.component if hasattr(c, "component") else c
            out.append((ref.type.name, ref))
        except Exception:
            pass
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--win", default=r"C:/Battlestate Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows")
    a = ap.parse_args()

    catalog = json.load(open(os.path.join(a.win, "Windows.json"), encoding="utf-8"))
    key = norm_key(a.bundle, a.win)
    if key not in catalog:
        # принимаем и прямой disk-path
        if os.path.exists(a.bundle):
            key = norm_key(os.path.abspath(a.bundle), a.win)
    keys = collect_deps(catalog, key) if key in catalog else {key}
    files = [disk(a.win, k) for k in keys]
    files = [f for f in files if os.path.exists(f)]
    if not os.path.exists(disk(a.win, key)) and os.path.exists(a.bundle):
        files.append(a.bundle)
    env = UnityPy.load(*files)
    objs = list(env.objects)
    os.makedirs(a.out, exist_ok=True)

    # 1. Icon-параметры из PreviewPivot (+ имя корневого префаба для Unity-рендера)
    icon = None
    prefab_name = None
    for o in objs:
        if o.type.name != "MonoBehaviour":
            continue
        try:
            d = o.read()
            if d.m_Script.read().m_ClassName == "PreviewPivot":
                icon = o.read_typetree()
                try:
                    prefab_name = d.m_GameObject.read().m_Name
                except Exception:
                    prefab_name = None
                break
        except Exception:
            pass
    if not icon:
        print("ОШИБКА: PreviewPivot не найден", file=sys.stderr); sys.exit(2)
    ic = icon.get("Icon", {})

    # 2. рендер-меши: GameObject с MeshFilter+MeshRenderer (пропуск коллайдеров/LOD>0)
    parts = []
    seen_mesh = set()
    for o in objs:
        if o.type.name != "GameObject":
            continue
        go = o.read()
        comp = dict(components(go))
        if "MeshRenderer" not in comp or "MeshFilter" not in comp:
            continue
        name = (getattr(go, "m_Name", "") or "").lower()
        if "lod" in name and "lod0" not in name and "lod_0" not in name:
            continue
        try:
            mesh = comp["MeshFilter"].read().m_Mesh.read()
        except Exception:
            continue
        mname = mesh.m_Name
        if mname in seen_mesh:
            continue
        seen_mesh.add(mname)
        safe = "".join(c if c.isalnum() else "_" for c in mname)[:60]
        obj_path = os.path.join(a.out, safe + ".obj")
        try:
            open(obj_path, "w").write(mesh.export())
        except Exception as e:
            print("меш", mname, "skip:", e, file=sys.stderr); continue
        # материал -> текстуры
        albedo = normal = None
        try:
            mr = comp["MeshRenderer"].read()
            mat = mr.m_Materials[0].read()
            tex = mat.m_SavedProperties.m_TexEnvs
            tex = tex.items() if hasattr(tex, "items") else tex
            for k, te in tex:
                if getattr(te.m_Texture, "m_PathID", 0) == 0:
                    continue
                if k in ("_MainTex", "_BumpMap"):
                    t = te.m_Texture.read()
                    fn = os.path.join(a.out, safe + ("_albedo" if k == "_MainTex" else "_normal") + ".png")
                    t.image.save(fn)
                    if k == "_MainTex": albedo = fn
                    else: normal = fn
        except Exception as e:
            print("материал", mname, "skip tex:", e, file=sys.stderr)
        parts.append({"obj": obj_path, "albedo": albedo, "normal": normal})

    r = ic.get("rotation", {})
    meta = {
        "iconRotation": [r.get("x", 0), r.get("y", 0), r.get("z", 0), r.get("w", 1)],
        "perspective": ic.get("perspective", 15.0),
        "boundsScale": ic.get("boundsScale", 0.9),
        "orthographic": ic.get("orthographic", 0),
        "orthographicSize": ic.get("orthographicSize", 10.0),
        "parts": parts,
        # для Unity-рендера (пиксель-точный): какой префаб грузить и какие бандлы
        "prefabName": prefab_name,
        "bundleKey": key,
        "depKeys": sorted(k for k in keys if k != key),
    }
    json.dump(meta, open(os.path.join(a.out, "meta.json"), "w"), indent=2)
    print(f"OK: частей {len(parts)}, FOV {meta['perspective']}, ortho {meta['orthographic']} -> {a.out}/meta.json")

if __name__ == "__main__":
    main()
