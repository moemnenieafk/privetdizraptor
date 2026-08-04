# Экспорт спрайтов из SpriteAtlas достижений EFT — через объект SpriteAtlas (m_PackedSprites),
# т.к. у атлас-упакованных Sprite сам m_RD.texture пуст (рендер-дата живёт в SpriteAtlas).
import sys, os, re
import UnityPy

SRC = sys.argv[1] if len(sys.argv) > 1 else r"D:/Games/Escape from Tarkov/EscapeFromTarkov_Data/resources.assets"
OUT = r"C:/cta-project/!non-related/ach-atlas-sprites"
os.makedirs(OUT, exist_ok=True)

print("loading:", SRC, flush=True)
env = UnityPy.load(SRC)

# все SpriteAtlas — печать имён
atlases = []
for obj in env.objects:
    if obj.type.name == "SpriteAtlas":
        try:
            d = obj.read()
            nm = getattr(d, "m_Name", "") or ""
            names = getattr(d, "m_PackedSpriteNamesToIndex", None) or []
            packed = getattr(d, "m_PackedSprites", None) or []
            atlases.append((nm, len(packed), list(names)))
            print(f"SpriteAtlas: '{nm}'  packed={len(packed)}", flush=True)
        except Exception as e:
            print("  atlas read err:", e, flush=True)

# экспорт из атласа(ов), где среди имён есть 'achiev' ИЛИ имя атласа про achievement
def is_ach(nm, names):
    if "achiev" in (nm or "").lower():
        return True
    return any("achiev" in (x or "").lower() for x in names[:50])

exported = 0
for obj in env.objects:
    if obj.type.name != "SpriteAtlas":
        continue
    try:
        d = obj.read()
        nm = getattr(d, "m_Name", "") or ""
        names = list(getattr(d, "m_PackedSpriteNamesToIndex", None) or [])
        if not is_ach(nm, names):
            continue
        print(f"→ экспорт из атласа '{nm}' ({len(names)} имён)", flush=True)
        for i, pptr in enumerate(getattr(d, "m_PackedSprites", []) or []):
            try:
                sp = pptr.read()
                spnm = getattr(sp, "m_Name", "") or (names[i] if i < len(names) else f"sp_{i}")
                img = sp.image
                safe = re.sub(r"[^A-Za-z0-9_.-]", "_", spnm)
                img.save(os.path.join(OUT, f"{safe}.png"))
                exported += 1
                print(f"    {img.width:4}x{img.height:<4} {spnm}", flush=True)
            except Exception:
                pass
    except Exception:
        pass

print(f"ИТОГО экспортировано: {exported}", flush=True)
