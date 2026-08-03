# -*- coding: utf-8 -*-
# Инжест НОВЫХ предметов из json.tarkov.dev в каталог items_database.json.
#
# GraphQL api.tarkov.dev мёртв с июня 2026 → это ОСНОВНОЙ путь пополнения каталога.
# Фид json.tarkov.dev отдаёт РЕАЛЬНЫЕ статы/свойства/размеры/normalizedName, но
# name/shortName/description — ПЛЕЙСХОЛДЕРЫ ("<id> Name"): реальную локализацию
# резолвит только GraphQL (мёртв). Поэтому имена ДЕРИВИМ из normalizedName (slug).
# Улучшить ru-имена можно позже из SPT locale/global/ru.json, когда SPT догонит патч.
#
# Запуск:  python scripts/ingest_json_items.py --dry   (отчёт, без записи)
#          python scripts/ingest_json_items.py         (дописать в каталог)
# Дальше:  npm run db:etl  (идемпотентный upsert — тронет только новые id)
import json, re, sys, os
try:
    import requests
except ImportError:
    requests = None

FEED_URL = "https://json.tarkov.dev/regular/items"
FEED_CACHE = ".tmp/tkitems.json"
CATALOG = "public/images/items/eft/items_database.json"
DRY = "--dry" in sys.argv

# Мусорные серии из фида (промо/Twitch-дропы/пронумерованные дубли) — НЕ заводим в каталог.
JUNK_NORM_PREFIXES = ("twitch-seasons",)

CALIBER = re.compile(r"^(\d)(\d{1,2})x(\d+)$")  # 58x42->5.8x42, 556x45->5.56x45, 762x51->7.62x51

_GENERIC = {"assault", "rifle", "carbine", "barrel", "magazine", "sight", "mount", "receiver",
            "grip", "block", "hider", "suppressor", "stock", "tube", "round", "upper", "rear",
            "flip", "up", "gas", "bird", "cage", "pistol", "buffer", "buttstock", "sound",
            "flash", "muzzle", "brake", "handguard", "rail", "scope", "optic", "base", "cover",
            "charging", "handle", "dust", "bolt", "foregrip", "tactical", "sniper", "marksman"}
_BRANDS = {"norinco", "colt", "izhmash", "kalashnikov", "fn", "hk", "howa", "geissele",
           "trijicon", "magpul", "daniel", "defense", "dd", "samson", "fab", "phase5", "kac"}

def derive_name(norm: str) -> str:
    if not norm:
        return ""
    words = []
    for w in norm.split("-"):
        m = CALIBER.match(w)
        if m:  # калибр: 58x42 -> 5.8x42
            words.append(f"{m.group(1)}.{m.group(2)}x{m.group(3)}")
        elif any(c.isdigit() for c in w) and any(c.isalpha() for c in w):
            words.append(w.upper())            # модель-код: qbz191, hk416a5, dbp191
        elif w.isdigit() or re.match(r"^\d+x\d+$", w):
            words.append(w)                    # число/калибр как есть (191, 9x19)
        elif len(w) <= 3 and w.isalpha():
            words.append(w.upper())            # короткие акронимы: hk, ar, ak, dd, vfg
        else:
            words.append(w.capitalize())
    return " ".join(words)

def derive_short(norm: str, name: str) -> str:
    # модель-ядро: выкидываем бренды, родовые слова и калибр; берём 1-2 значимых токена
    words = name.split(" ")
    core = [w for w in words
            if w.lower() not in _GENERIC and w.lower() not in _BRANDS
            and not re.match(r"^\d+\.\d+x\d+$", w) and not re.match(r"^\d+x\d+$", w)]
    picked = core[:2] if core else words[:2]
    return " ".join(picked) or name

def load_feed():
    if os.path.exists(FEED_CACHE):
        with open(FEED_CACHE, encoding="utf-8") as f:
            return json.load(f)["data"]["items"]
    if not requests:
        sys.exit("нет .tmp/tkitems.json и модуль requests недоступен")
    print("качаю фид json.tarkov.dev …")
    r = requests.get(FEED_URL, timeout=120)
    os.makedirs(".tmp", exist_ok=True)
    with open(FEED_CACHE, "w", encoding="utf-8") as f:
        f.write(r.text)
    return r.json()["data"]["items"]

def main():
    feed = load_feed()
    with open(CATALOG, encoding="utf-8") as f:
        catalog = json.load(f)
    have = {it["id"] for it in catalog}
    new_ids = [iid for iid in feed if iid not in have]
    print(f"фид: {len(feed)} · каталог: {len(catalog)} · НОВЫХ: {len(new_ids)}")

    built = []
    for iid in new_ids:
        it = feed[iid]
        norm = it.get("normalizedName") or ""
        if any(norm.startswith(p) for p in JUNK_NORM_PREFIXES):
            continue  # мусор — пропускаем
        name = derive_name(norm)
        short = derive_short(norm, name)
        props = it.get("properties")
        if props and props.get("propertiesType"):
            props = {k: v for k, v in props.items() if k != "propertiesType"}
            props["__typename"] = it["properties"]["propertiesType"]
        else:
            props = None
        types = it.get("types") or []
        built.append({
            "id": iid,
            "category": types[0] if types else "unknown",
            "all_categories": types,
            "names": {"ru": name, "en": name},           # ru = derived (нет ru-источника; см. шапку)
            "shortNames": {"ru": short, "en": short},
            "descriptions": {"ru": "", "en": ""},
            "weight": it.get("weight"),
            "width": it.get("width"),
            "height": it.get("height"),
            "basePrice": it.get("basePrice"),
            "properties": props,
        })

    print("--- 12 примеров имён ---")
    for b in built[:12]:
        print(f"  {b['names']['en']}  |  short: {b['shortNames']['en']}  |  {b['category']}")

    if DRY:
        print("DRY: каталог не изменён.")
        return
    catalog.extend(built)
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"ЗАПИСАНО: каталог теперь {len(catalog)} предметов (+{len(built)}). Дальше: npm run db:etl")

if __name__ == "__main__":
    main()
