# -*- coding: utf-8 -*-
# Диагностика сборки: для бандла печатает КАЖДЫЙ корневой GameObject —
# число рендер-мешей + список дочерних слот-эмпти (mod_*). Показывает, какой
# вариант префаба несёт слоты крепления под-модов (и теряет ли их max-mesh селектор).
# Запуск: python dump_slots.py --bundle <key|path> --win <StreamingAssets/Windows>
import os, sys, json, argparse
import UnityPy

def norm_key(p, win):
    p = p.replace("\\", "/")
    i = p.lower().find("streamingassets/windows/")
    return p[i + len("streamingassets/windows/"):] if i >= 0 else p

def disk(win, key): return os.path.join(win, key.replace("/", os.sep))

def collect_deps(catalog, key):
    seen, stack = set(), [key]
    while stack:
        k = stack.pop()
        if k in seen: continue
        seen.add(k)
        for d in catalog.get(k, {}).get("Dependencies", []): stack.append(d)
    return seen

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", required=True)
    ap.add_argument("--win", default=r"D:/Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows")
    a = ap.parse_args()
    catalog = json.load(open(os.path.join(a.win, "Windows.json"), encoding="utf-8"))
    key = norm_key(a.bundle, a.win)
    keys = collect_deps(catalog, key) if key in catalog else {key}
    files = [disk(a.win, k) for k in keys]
    files = [f for f in files if os.path.exists(f)]
    env = UnityPy.load(*files)

    # индекс Transform по path_id + карта go
    gos = {}
    for o in env.objects:
        if o.type.name == "GameObject":
            try: gos[o.path_id] = o.read()
            except Exception: pass

    def go_name(go): return getattr(go, "m_Name", "?") or "?"
    def transform_of(go):
        for c in getattr(go, "m_Components", []):
            try:
                ref = c.component if hasattr(c, "component") else c
                if ref.type.name in ("Transform", "RectTransform"): return ref.read()
            except Exception: pass
        return None
    def mesh_count(go):
        # рекурсивно считаем MeshFilter с мешем (пропуская LOD1+)
        n = 0
        def rec(g):
            nonlocal n
            comp = {}
            for c in getattr(g, "m_Components", []):
                try:
                    ref = c.component if hasattr(c, "component") else c
                    comp[ref.type.name] = ref
                except Exception: pass
            nm = (go_name(g) or "").lower()
            if "MeshFilter" in comp and "_lod" not in nm.replace("lod0",""):
                n += 1
            t = transform_of(g)
            if t:
                for ch in getattr(t, "m_Children", []):
                    try: rec(ch.read().m_GameObject.read())
                    except Exception: pass
        rec(go)
        return n
    def slot_names(go):
        out = []
        def rec(g, depth):
            nm = go_name(g)
            if nm.startswith("mod_"): out.append(nm)
            t = transform_of(g)
            if t:
                for ch in getattr(t, "m_Children", []):
                    try: rec(ch.read().m_GameObject.read(), depth+1)
                    except Exception: pass
        rec(go, 0)
        return out

    # корневые = Transform без родителя
    roots = []
    for pid, go in gos.items():
        t = transform_of(go)
        if t is None: continue
        parent = getattr(t, "m_Father", None)
        has_parent = False
        try: has_parent = parent is not None and parent.path_id != 0
        except Exception: has_parent = False
        if not has_parent: roots.append(go)

    print(f"bundle key: {key}")
    print(f"deps: {len(keys)-1}  roots: {len(roots)}")
    for go in roots:
        slots = slot_names(go)
        print(f"\n  ROOT '{go_name(go)}'  meshes={mesh_count(go)}  slots={len(slots)}")
        if slots: print("    " + ", ".join(sorted(set(slots))))

if __name__ == "__main__":
    main()
