# Разовый скан UI-ассетов EFT на спрайты подложки/рамок достижений.
# Ищем Texture2D/Sprite с именем по паттерну и экспортим в PNG.
# Метадата EFT зашифрована, но engine-типы (Texture2D/Sprite) читаются (см. скилл game-asset-extraction).
import sys, os, re
import UnityPy

SRC = sys.argv[1] if len(sys.argv) > 1 else r"D:/Games/Escape from Tarkov/EscapeFromTarkov_Data/resources.assets"
OUT = r"C:/cta-project/!non-related/ach-substrate"
os.makedirs(OUT, exist_ok=True)
PAT = re.compile(r"substrate|achiev|hexagon|frame|rank|medal|season|reward|rarity|badge|border", re.I)

print("loading:", SRC)
env = UnityPy.load(SRC)
print("objects:", len(env.objects))

found = []
n = 0
for obj in env.objects:
    if obj.type.name not in ("Texture2D", "Sprite"):
        continue
    n += 1
    try:
        data = obj.read()
        name = getattr(data, "m_Name", None) or getattr(data, "name", "") or ""
        if not name or not PAT.search(name):
            continue
        img = None
        try:
            img = data.image
        except Exception:
            img = None
        w = getattr(img, "width", 0) if img else 0
        h = getattr(img, "height", 0) if img else 0
        safe = re.sub(r"[^A-Za-z0-9_.-]", "_", name)
        if img is not None:
            img.save(os.path.join(OUT, f"{obj.type.name}__{safe}.png"))
        found.append((obj.type.name, name, w, h))
    except Exception as e:
        pass

print(f"scanned Texture2D/Sprite: {n} | matched+exported: {len(found)}")
for t, nm, w, h in sorted(found, key=lambda x: -(x[2]*x[3])):
    print(f"  {t:10} {w}x{h}  {nm}")
