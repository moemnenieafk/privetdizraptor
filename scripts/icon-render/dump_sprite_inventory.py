# -*- coding: utf-8 -*-
# Полный дамп имён Sprite/Texture2D из UI-контейнеров EFT → один текстовый файл для поиска.
# Для ручного поиска иконок season-модификаторов (по имени в клиенте не нашлись фильтром).
import UnityPy, os

DATA = "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data"
FILES = ["resources.assets", "sharedassets161.assets", "sharedassets165.assets",
         "sharedassets24.assets", "sharedassets5.assets", "sharedassets30.assets",
         "sharedassets23.assets", "sharedassets199.assets", "sharedassets10.assets"]
OUT = ".tmp/eft-sprite-inventory.txt"

def main():
    os.makedirs(".tmp", exist_ok=True)
    total = 0
    with open(OUT, "w", encoding="utf-8") as w:
        w.write("# Инвентаризация спрайтов/текстур EFT (UI). Ищи Ctrl-F по имени модификатора.\n")
        for fn in FILES:
            path = os.path.join(DATA, fn)
            if not os.path.exists(path):
                continue
            try:
                env = UnityPy.load(path)
            except Exception as e:
                w.write(f"\n===== {fn}: LOAD ERROR {e} =====\n")
                continue
            names = set()
            for o in env.objects:
                if o.type.name in ("Sprite", "Texture2D"):
                    try:
                        names.add(f"{o.type.name[:3]}  {o.read().m_Name}")
                    except Exception:
                        pass
            w.write(f"\n===== {fn}  ({len(names)}) =====\n")
            for n in sorted(names):
                w.write(n + "\n")
            total += len(names)
            print(f"{fn}: {len(names)}")
    print(f"ИТОГО: {total} имён -> {OUT}")

if __name__ == "__main__":
    main()
