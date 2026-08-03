# -*- coding: utf-8 -*-
# Инструмент РУЧНОГО сопоставления иконок с предметами.
# Выдаёт: (1) папку out-poc/icons-for-matching/ с отрендеренными webp (человекочит. имена),
#         (2) out-poc/icon-matching.json — по каждой иконке: бандл + топ-кандидаты (id+имя),
#             + полный список новых предметов каталога (id/имя/шортнейм/категория) для ручного выбора.
# Матч type-aware (тип бандла обязан биться с типом предмета) — подсказки, не автозаливка.
#
# Как пользоваться (V4DYA): открой папку, смотри картинки; в json для каждой иконки
# впиши верный "itemId" (проверь "suggestion" / выбери из "candidates" или из "newItems").
# Верни json — соберу карту {itemId: bundle} и залью иконки под этими id.
import json, re, os, shutil

FEED = ".tmp/tkitems.json"
CATALOG = "public/images/items/eft/items_database.json"
ALLMAP = "scripts/icon-render/out-poc/allmap.json"
RENDERS = "scripts/icon-render/out-unity"
FOLDER = "scripts/icon-render/out-poc/icons-for-matching"
OUT = "scripts/icon-render/out-poc/icon-matching.json"

_STOP = {"std", "the", "of", "norinco", "izhmash", "colt", "hk", "reciever", "receiver",
         "weapon", "item", "assets", "content", "items", "mods", "bundle"}

# тип по префиксу бандла  и  по словам имени предмета — для type-aware буста
_BTYPE = [("patron", "ammo"), ("barrel", "barrel"), ("handguard", "handguard"),
          ("mag", "magazine"), ("silencer", "muzzle"), ("muzzle", "muzzle"),
          ("pistolgrip", "grip"), ("stock", "stock"), ("mount", "mount"),
          ("scope", "sight"), ("sight", "sight"), ("reciever", "receiver"),
          ("gas", "gasblock"), ("charge", "charge"), ("foregrip", "foregrip"),
          ("item_food", "food"), ("item_barter", "barter"), ("item_container", "container"),
          ("item_info", "info"), ("reader", "info")]
_NTYPE = {"barrel": "barrel", "handguard": "handguard", "magazine": "magazine",
          "suppressor": "muzzle", "hider": "muzzle", "brake": "muzzle", "muzzle": "muzzle",
          "grip": "grip", "stock": "stock", "buttstock": "stock", "buffer": "stock",
          "mount": "mount", "sight": "sight", "scope": "sight", "receiver": "receiver",
          "rifle": "gun", "carbine": "gun", "block": "gasblock", "handle": "charge",
          "foregrip": "foregrip"}

def toks(s):
    s = re.sub(r"[/_\-. ]+", " ", s.lower())
    s = re.sub(r"([a-z])(\d)", r"\1 \2", s)
    s = re.sub(r"(\d)([a-z])", r"\1 \2", s)
    return {t for t in s.split() if t and t not in _STOP}

def btype(bundle):
    b = bundle.split("/")[-1]
    for pref, t in _BTYPE:
        if b.startswith(pref):
            return t
    return None

def ntype(name, norm):
    words = (name + " " + norm).lower().replace("-", " ").split()
    for w in words:
        if w in _NTYPE:
            return _NTYPE[w]
    return None

def main():
    feed = json.load(open(FEED, encoding="utf-8"))["data"]["items"]
    cat = json.load(open(CATALOG, encoding="utf-8"))
    new = cat[-291:]
    for it in new:
        it["_norm"] = feed.get(it["id"], {}).get("normalizedName", "")
        it["_toks"] = toks(it["names"]["en"] + " " + it["_norm"])
        it["_type"] = ntype(it["names"]["en"], it["_norm"])
    allmap = json.load(open(ALLMAP, encoding="utf-8"))          # fakeid -> bundle
    bundle_by_fake = {k: v for k, v in allmap.items()}

    os.makedirs(FOLDER, exist_ok=True)
    icons = []
    rendered = sorted(f for f in os.listdir(RENDERS) if f.endswith(".webp") and not f.endswith("-1024.webp"))
    for f in rendered:
        fake = f[:-5]
        bundle = bundle_by_fake.get(fake, "")
        bt = btype(bundle) if bundle else None
        btk = toks(bundle.split("/")[-1]) if bundle else toks(fake)
        scored = []
        for it in new:
            j = len(btk & it["_toks"]) / max(1, len(btk | it["_toks"]))
            if bt and it["_type"]:
                j *= 1.6 if bt == it["_type"] else 0.5
            scored.append((round(j, 3), it))
        scored.sort(key=lambda x: -x[0])
        top = scored[:4]
        shutil.copyfile(os.path.join(RENDERS, f), os.path.join(FOLDER, f))
        icons.append({
            "iconFile": f,
            "bundle": bundle,
            "itemId": top[0][1]["id"] if top and top[0][0] >= 0.35 else "",   # ← сюда впиши верный id
            "suggestion": {"id": top[0][1]["id"], "name": top[0][1]["names"]["en"], "score": top[0][0]} if top else None,
            "candidates": [{"id": it["id"], "name": it["names"]["en"], "cat": it["category"], "score": s} for s, it in top],
        })

    new_items = [{"id": it["id"], "name": it["names"]["en"], "shortName": it["shortNames"]["en"],
                  "category": it["category"], "normalizedName": it["_norm"]} for it in new]
    payload = {
        "_howto": "Открой папку icons-for-matching/. Для каждой iconFile впиши верный itemId "
                  "(проверь suggestion / выбери из candidates или из newItems). Верни json — залью иконки.",
        "folder": FOLDER,
        "icons": icons,
        "newItems": new_items,
    }
    json.dump(payload, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    matched = sum(1 for i in icons if i["itemId"])
    print(f"иконок: {len(icons)} · авто-подсказка есть: {matched} · без уверенной: {len(icons)-matched}")
    print(f"папка:  {FOLDER}  ({len(rendered)} webp)")
    print(f"json:   {OUT}  (icons + {len(new_items)} newItems)")

if __name__ == "__main__":
    main()
