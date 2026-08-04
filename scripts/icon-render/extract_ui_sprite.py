# -*- coding: utf-8 -*-
# Извлечение UI-спрайтов/текстур EFT → PNG. Точечно по имени ИЛИ пачкой по подстроке.
#   python extract_ui_sprite.py splash_19_season_1                    # точное имя, resources.assets
#   python extract_ui_sprite.py Wall_BlackDivision resources.assets   # точное, указанный файл
#   python extract_ui_sprite.py icon --contains resources.assets sharedassets24.assets  # ВСЕ с 'icon'
# Пачка кладётся в out-poc/ui-extract/<substr>/. При совпадении имени Sprite важнее Texture2D.
import UnityPy, os, sys

DATA = "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data"
OUT_BASE = "scripts/icon-render/out-poc/ui-extract"

def safe(nm):
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in nm)[:80]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    contains = "--contains" in sys.argv
    if not args:
        sys.exit("укажи имя/подстроку")
    key = args[0]
    files = args[1:] or ["resources.assets"]
    subs = [s.strip().lower() for s in key.split(",")] if contains else None
    out = os.path.join(OUT_BASE, safe(key)) if contains else OUT_BASE
    os.makedirs(out, exist_ok=True)

    picked = {}  # name -> read-object (Sprite приоритетнее Texture2D)
    for fn in files:
        path = os.path.join(DATA, fn)
        if not os.path.exists(path):
            print(f"нет файла: {fn}"); continue
        env = UnityPy.load(path)
        for o in env.objects:
            if o.type.name not in ("Sprite", "Texture2D"):
                continue
            try:
                d = o.read()
            except Exception:
                continue
            nm = d.m_Name or ""
            ok = any(s in nm.lower() for s in subs) if contains else (nm == key)
            if not ok:
                continue
            prev = picked.get(nm)
            if prev is not None and prev[0] == "Sprite":
                continue  # уже есть Sprite — не перезатираем Texture2D'ом
            picked[nm] = (o.type.name, d)
        print(f"{fn}: просмотрен")

    cnt = 0
    for nm, (t, d) in picked.items():
        try:
            d.image.save(os.path.join(out, safe(nm) + ".png"))
            cnt += 1
            if cnt % 100 == 0:
                print(f"  …сохранено {cnt}")
        except Exception as e:
            print(f"  skip {nm}: {e}")
    print(f"СОХРАНЕНО {cnt} PNG -> {out}")

if __name__ == "__main__":
    main()
