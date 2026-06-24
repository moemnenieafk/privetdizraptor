# -*- coding: utf-8 -*-
# Маппинг template-id -> путь бандла предмета (ключ Windows.json).
#
# Источник 1 (надёжный): BSG items.json -> _props.Prefab.path (= ровно ключ Windows.json).
#   items.json — стандартный датамайнинг-артефакт (Prefab-пути), обновляется по патчам.
# Источник 2 (fallback, локальный): фаззи-матч по имени из items_database.json (наш каталог)
#   к descriptive-именам бандлов из Windows.json. Менее надёжен, но без внешних данных.
#
# Запуск: python resolve_bundle.py --id <templateId> [--items <items.json>] [--win <Windows/>] [--catalog <items_database.json>]
import os, sys, json, argparse, re

def load_items_prefab(items_path):
    d = json.load(open(items_path, encoding="utf-8"))
    seq = d.values() if isinstance(d, dict) else d
    out = {}
    for it in seq:
        _id = it.get("_id") or it.get("id")
        pref = (it.get("_props") or {}).get("Prefab") or {}
        path = pref.get("path") if isinstance(pref, dict) else None
        if _id and path:
            out[_id] = path.replace("\\", "/")
    return out

def norm_tokens(s):
    return set(t for t in re.split(r"[^a-z0-9]+", (s or "").lower()) if len(t) > 1)

def name_fallback(template_id, catalog_path, win):
    cat = json.load(open(catalog_path, encoding="utf-8"))
    seq = cat if isinstance(cat, list) else cat.values()
    item = next((i for i in seq if i.get("id") == template_id), None)
    if not item:
        return None, "id нет в items_database.json"
    names = item.get("names") or {}
    short = item.get("shortNames") or {}
    want = norm_tokens(" ".join(list(names.values()) + list(short.values())))
    # бандлы предметов
    catalog = json.load(open(os.path.join(win, "Windows.json"), encoding="utf-8"))
    best, best_score = None, 0
    for key in catalog:
        if "/items/" not in key or not key.endswith(("bundle", "_textures")) and "item" not in key:
            pass
        if "/items/" not in key:
            continue
        base = os.path.basename(key)
        if "_textures" in base or "colider" in base:
            continue
        score = len(want & norm_tokens(base))
        if score > best_score:
            best, best_score = key, score
    return best, f"name-fallback score={best_score}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--map", help="готовая карта id->bundleKey (JSON) — высший приоритет (напр. src/data/icon-bundle-map-eft.json)")
    ap.add_argument("--items", help="BSG items.json (Prefab paths)")
    ap.add_argument("--catalog", default="public/images/items/eft/items_database.json")
    ap.add_argument("--win", default=r"C:/Battlestate Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows")
    a = ap.parse_args()

    if a.map and os.path.exists(a.map):
        mp = json.load(open(a.map, encoding="utf-8"))
        if mp.get(a.id):
            print(mp[a.id]); return
    if a.items and os.path.exists(a.items):
        m = load_items_prefab(a.items)
        if a.id in m:
            print(m[a.id]); return
        print(f"# id нет в items.json, пробую name-fallback", file=sys.stderr)
    key, why = name_fallback(a.id, a.catalog, a.win)
    if key:
        print(f"# {why}", file=sys.stderr); print(key)
    else:
        print(f"ОШИБКА: не разрешён ({why})", file=sys.stderr); sys.exit(2)

if __name__ == "__main__":
    main()
