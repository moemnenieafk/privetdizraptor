# -*- coding: utf-8 -*-
# Discovery: найти спрайты/текстуры модификаторов сезона в resources.assets EFT (UI-контейнер).
# Метадата зашифрована, но Sprite/Texture2D — engine-типы: имя (m_Name) читается.
import UnityPy, sys, os

DATA = "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data"
FILES = [os.path.join(DATA, f) for f in
         ("sharedassets161.assets", "sharedassets165.assets", "sharedassets557.assets", "sharedassets24.assets")]
KEYS = ("season", "modifier", "perk", "debuff", "trait", "kord", "hardcore",
        "condition", "positive", "negative", "handicap", "penalty", "seasonal",
        "blackdivision", "black_division", "faction", "splash")

def main():
    for path in FILES:
        print(f"=== {os.path.basename(path)} ===")
        env = UnityPy.load(path)
        n = 0
        found = {}
        for o in env.objects:
            if o.type.name not in ("Sprite", "Texture2D"):
                continue
            n += 1
            try:
                name = o.read().m_Name
            except Exception:
                continue
            low = (name or "").lower()
            if any(k in low for k in KEYS):
                found.setdefault(o.type.name, set()).add(name)
        print(f"  Sprite/Texture2D всего: {n}")
        for t, names in found.items():
            print(f"  --- {t}: {len(names)} совпадений ---")
            for nm in sorted(names)[:80]:
                print("    ", nm)

if __name__ == "__main__":
    main()
