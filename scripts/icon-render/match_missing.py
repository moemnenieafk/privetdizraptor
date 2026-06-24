# -*- coding: utf-8 -*-
# Assist-матчер: недостающие id -> кандидаты бандлов по совпадению имён (для РУЧНОЙ заливки без клиент-дампа).
# Берёт имена из каталога (items_database.json), сопоставляет с descriptive-именами бандлов (Windows.json).
# Выход: scripts/reports/match-missing.tsv (id | name | conf | best bundle | top-3) — спорные глазами подтвердить.
#
# Запуск: python scripts/icon-render/match_missing.py [--win <Windows>] [--list <backfill.json>] [--catalog <items_database.json>]
import os, sys, json, re, argparse

STOP = {"the", "of", "with", "and", "for", "in", "a", "s", "item", "default", "mm"}

def toks(s):
    return [t for t in re.split(r"[^a-z0-9]+", (s or "").lower()) if len(t) > 1 and t not in STOP]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--win", default=r"C:/Battlestate Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows")
    ap.add_argument("--list", default="src/data/icon-backfill-eft.json")
    ap.add_argument("--catalog", default="public/images/items/eft/items_database.json")
    ap.add_argument("--out", default="scripts/reports/match-missing.tsv")
    a = ap.parse_args()

    cat = json.load(open(a.catalog, encoding="utf-8"))
    cat = cat if isinstance(cat, list) else list(cat.values())
    by_id = {i["id"]: i for i in cat}
    missing = json.load(open(a.list, encoding="utf-8"))

    # все бандлы предметов (descriptive), индекс токенов
    wcat = json.load(open(os.path.join(a.win, "Windows.json"), encoding="utf-8"))
    bundles = []
    for k in wcat:
        if "/items/" not in k or not k.endswith(".bundle"):
            continue
        base = os.path.basename(k)[:-7]
        bl = base.lower()
        if "textures" in bl or "shadow" in bl or "colider" in bl or "_lod" in bl:
            continue
        bundles.append((k, set(toks(base))))

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    rows = []
    conf_n = amb_n = none_n = 0
    for mid in missing:
        it = by_id.get(mid)
        names = it.get("names") if it else None
        nm = (names.get("en") if isinstance(names, dict) else None) or (it.get("name") if it else "") or ""
        cat_name = (it.get("category") if it else "") or ""
        want = set(toks(nm))
        if not want:
            rows.append((mid, nm, "NO-NAME", "", "")); none_n += 1; continue
        scored = sorted(((len(want & bt) / max(len(want), 1), k) for k, bt in bundles), reverse=True)[:3]
        top = [(round(s, 2), os.path.basename(k)) for s, k in scored if s > 0]
        best_s = top[0][0] if top else 0
        gap = best_s - (top[1][0] if len(top) > 1 else 0)
        # промо-мусор (Random Loot Container) — отдельно
        if "Random Loot" in cat_name:
            conf = "JUNK"
        elif best_s >= 0.6 and gap >= 0.15:
            conf = "OK"; conf_n += 1
        elif best_s >= 0.34:
            conf = "REVIEW"; amb_n += 1
        else:
            conf = "NONE"; none_n += 1
        best_bundle = scored[0][1] if top else ""
        rows.append((mid, nm, conf, best_bundle, " | ".join(f"{s}:{b}" for s, b in top)))

    with open(a.out, "w", encoding="utf-8") as f:
        f.write("id\tname\tconf\tbest_bundle_key\ttop3\n")
        for r in sorted(rows, key=lambda x: {"OK": 0, "REVIEW": 1, "NONE": 2, "JUNK": 3, "NO-NAME": 4}.get(x[2], 5)):
            f.write("\t".join(str(x) for x in r) + "\n")
    print(f"всего {len(missing)}: OK(уверенно)={conf_n}, REVIEW(спорно)={amb_n}, NONE/JUNK/др={len(missing)-conf_n-amb_n}")
    print(f"отчёт: {a.out}")

if __name__ == "__main__":
    main()
