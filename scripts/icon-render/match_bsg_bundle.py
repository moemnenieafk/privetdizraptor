# -*- coding: utf-8 -*-
# Матч: новый предмет каталога (BSG id + normalizedName из фида) ↔ отрендеренный бандл (allmap).
# Выход: карта {bsg-id: bundle-key} для render_unity --map (иконки лягут под реальными id).
# Токен-оверлап (Jaccard) + порог + отчёт по скору для ручной сверки.
import json, re, sys

FEED = ".tmp/tkitems.json"
CATALOG = "public/images/items/eft/items_database.json"
ALLMAP = "scripts/icon-render/out-poc/allmap.json"
OUT = "scripts/icon-render/out-poc/bsg-icon-map.json"
THRESH = 0.34

_STOP = {"std", "bundle", "assets", "content", "items", "mods", "item", "the", "of",
         "norinco", "izhmash", "colt", "hk", "reciever", "receiver", "weapon", "prefabs",
         "characters", "character", "barter", "infosubject", "containers", "ammo", "patrons"}

def toks(s: str) -> set:
    s = re.sub(r"[/_\-. ]+", " ", s.lower())
    s = re.sub(r"([a-z])(\d)", r"\1 \2", s)   # qbz191 -> qbz 191
    s = re.sub(r"(\d)([a-z])", r"\1 \2", s)   # 58x -> 58 x
    return {t for t in s.split() if t and t not in _STOP}

def main():
    feed = json.load(open(FEED, encoding="utf-8"))["data"]["items"]
    cat = json.load(open(CATALOG, encoding="utf-8"))
    new_ids = [x["id"] for x in cat[-291:]]
    norm = {iid: (feed[iid].get("normalizedName") or "") for iid in new_ids if iid in feed}
    allmap = json.load(open(ALLMAP, encoding="utf-8"))       # fakeid -> bundlekey
    bundles = sorted(set(allmap.values()))
    btoks = {b: toks(b.split("/")[-1]) for b in bundles}

    bsgmap, rows, used = {}, [], set()
    for iid, nm in norm.items():
        nt = toks(nm)
        if not nt:
            continue
        best, sc = None, 0.0
        for b in bundles:
            bt = btoks[b]
            j = len(nt & bt) / max(1, len(nt | bt))
            if j > sc:
                sc, best = j, b
        if best and sc >= THRESH:
            bsgmap[iid] = best
            used.add(best)
            rows.append((sc, nm, best.split("/")[-1]))

    rows.sort()
    print(f"новых с normalizedName: {len(norm)} · бандлов рендера: {len(bundles)} · СМАТЧЕНО: {len(bsgmap)}")
    print("--- 20 худших по скору (для проверки на ложные) ---")
    for sc, nm, b in rows[:20]:
        print(f"  {sc:.2f}  {nm:45.45}  <-  {b}")
    print("--- бандлы БЕЗ матча (не зальются) ---")
    for b in bundles:
        if b not in used:
            print("  •", b.split("/")[-1])
    if "--write" in sys.argv:
        json.dump(bsgmap, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        print(f"ЗАПИСАНО: {OUT} ({len(bsgmap)} id)")

if __name__ == "__main__":
    main()
