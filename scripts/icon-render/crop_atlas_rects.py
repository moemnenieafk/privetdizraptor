# Кроп спрайтов SpriteAtlas достижений из декодированного PNG по УПАКОВАННЫМ ректам
# из SpriteAtlas.m_RenderDataMap (m_RD.textureRect у спрайта = рект исходной текстуры, НЕ атласа!).
# Сопоставление: Sprite.m_RenderDataKey -> ключ в m_RenderDataMap -> textureRect (в атласе).
import sys, os, re, json
import UnityPy
from PIL import Image

SRC = r"D:/Games/Escape from Tarkov/EscapeFromTarkov_Data/resources.assets"
ATLAS_PNG = r"C:/cta-project/!non-related/ach-substrate/Texture2D__sactx-0-2048x2048-DXT5_BC3-achievement-5aeb4589.png"
OUT = r"C:/cta-project/!non-related/ach-substrate-clean"
os.makedirs(OUT, exist_ok=True)

atlas = Image.open(ATLAS_PNG).convert("RGBA")
AW, AH = atlas.size
print("atlas:", AW, AH, flush=True)

env = UnityPy.load(SRC)
by_id = {o.path_id: o for o in env.objects}

# 1) achievement SpriteAtlas + карта packed-ректов по m_RenderDataKey
atlas_tt = None
for obj in env.objects:
    if obj.type.name == "SpriteAtlas":
        tt = obj.read_typetree()
        if tt.get("m_Name", "") == "achievement":
            atlas_tt = tt; break

def keystr(k):
    return json.dumps(k, sort_keys=True, default=str)

rect_by_key = {}
for entry in atlas_tt.get("m_RenderDataMap", []):
    try:
        k, data = entry[0], entry[1]
        rect_by_key[keystr(k)] = data.get("textureRect")
    except Exception:
        pass
print("render-data ключей:", len(rect_by_key), flush=True)

# 2) кроп каждого упакованного спрайта
n = 0; rows = []
for i, ptr in enumerate(atlas_tt.get("m_PackedSprites", [])):
    pid = ptr.get("m_PathID") if isinstance(ptr, dict) else getattr(ptr, "m_PathID", None)
    o = by_id.get(pid)
    if not o: continue
    try:
        st = o.read_typetree()
        rk = st.get("m_RenderDataKey")
        tr = rect_by_key.get(keystr(rk))
        if not tr: continue
        x, y, w, h = tr["x"], tr["y"], tr["width"], tr["height"]
        left = int(round(x)); top = int(round(AH - (y + h)))
        crop = atlas.crop((left, top, left + int(round(w)), top + int(round(h))))
        nm = st.get("m_Name", "") or f"sp_{i}"
        safe = re.sub(r"[^A-Za-z0-9_.-]", "_", nm)
        crop.save(os.path.join(OUT, f"{safe}.png"))
        rows.append((nm, int(w), int(h))); n += 1
    except Exception:
        pass

print(f"ЧИСТО экспортировано: {n}", flush=True)
# подложки-шаблоны первыми
for nm, w, h in sorted(rows, key=lambda r: (0 if "OverAll" in r[0] or "verall" in r[0].lower() else 1, r[0])):
    tag = "  <== ПОДЛОЖКА" if "verall" in nm.lower() else ""
    print(f"  {w:4}x{h:<4} {nm}{tag}")
