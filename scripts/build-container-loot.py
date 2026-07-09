import json, urllib.request

RAW="https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database"
def raw(path):
    with urllib.request.urlopen(urllib.request.Request(f"{RAW}/{path}",headers={"User-Agent":"cta"}),timeout=60) as r:
        return json.load(r)

MAPS=['bigmap','factory4_day','factory4_night','interchange','laboratory','lighthouse','rezervbase','sandbox','shoreline','tarkovstreets','woods']

# локаль RU: ключи "{tpl} Name" / "{tpl} ShortName"
print("fetch locale ru...", flush=True)
ru=raw("locales/global/ru.json")
def name_ru(tpl):
    return ru.get(f"{tpl} Name") or ru.get(f"{tpl} ShortName") or tpl

# мой каталог: nameRu -> slug, + 7 известных tpl->file, file->slug
CATALOG={  # slug: nameRu
 'jacket':'Куртка','jacket-worker-blue':'Рабочая куртка','drawer':'Выдвижной ящик','toolbox':'Ящик с инструментами',
 'wooden-toolbox':'Деревянный ящик с инструментами','pc-block':'Системный блок','cash-register':'Кассовый аппарат',
 'cash-register-bank':'Банковский кассовый аппарат','bank-safe':'Сейф','medcase':'Медукладка','medbag-smu06':'Медсумка СМУ06',
 'sportsbag':'Спортивная сумка','plastic-suitcase':'Пластиковый чемодан','wooden-crate':'Деревянный ящик',
 'weaponbox-5x2':'Оружейный ящик (5×2)','weaponbox-6x3':'Оружейный ящик (6×3)','weaponbox-4x4':'Оружейный ящик (4×4)',
 'weaponbox-5x5':'Оружейный ящик (5×5)','wooden-ammo-box':'Патронный ящик','wooden-grenade-box':'Гранатный ящик',
 'wooden-ration-supply-crate':'Ящик с продовольствием','wooden-medical-supply-crate':'Ящик медобеспечения',
 'wooden-technical-supply-crate':'Ящик технического снабжения','ground-cache':'Схрон в земле','burried-barrel-cache':'Закопанная бочка',
 'common-fund-stash':'Схрон Штурмана','dead-scav':'Труп Дикого','dead-pmc':'Труп ЧВК','civilian-body':'Труп гражданского',
 'laborant':'Труп лаборанта','airdrop':'Сброс снабжения'}
NAME2SLUG={v.lower():k for k,v in CATALOG.items()}
TPL2FILE={'5d07b91b86f7745a077a9432':'common-fund-stash','5909d5ef86f77467974efbd8':'weaponbox-5x2','5909d76c86f77471e53d2adf':'weaponbox-6x3','5909d7cf86f77470ee57d75a':'weaponbox-4x4','5909d89086f77472591234a0':'weaponbox-5x5','578f8778245977358849a9b5':'jacket','5937ef2b86f77408a47244b3':'jacket','5914944186f774189e5e76c2':'jacket-worker-blue'}

def norm(s): return s.lower().replace('ё','е').strip()

# агрегируем пулы по tpl контейнера через все карты
agg={}  # container_tpl -> {item_tpl: relprob_sum}
counts={} # container_tpl -> {count: relprob_sum}
for m in MAPS:
    try: sl=raw(f"locations/{m}/staticLoot.json")
    except Exception as e: print("skip",m,e); continue
    for ctpl,data in sl.items():
        d=agg.setdefault(ctpl,{})
        for it in data.get("itemDistribution",[]):
            d[it["tpl"]]=d.get(it["tpl"],0)+it.get("relativeProbability",0)
        c=counts.setdefault(ctpl,{})
        for cd in data.get("itemcountDistribution",[]):
            c[cd["count"]]=c.get(cd["count"],0)+cd.get("relativeProbability",0)
    print("ok",m,flush=True)

# маппинг container tpl -> slug
def slug_for(ctpl):
    if ctpl in TPL2FILE: return TPL2FILE[ctpl]
    nm=norm(name_ru(ctpl))
    if nm in NAME2SLUG: return NAME2SLUG[nm]
    # частичное совпадение
    for k,s in NAME2SLUG.items():
        if k in nm or nm in k: return s
    return None

out={}; unmapped=[]
for ctpl,pool in agg.items():
    slug=slug_for(ctpl)
    if not slug:
        unmapped.append((ctpl,name_ru(ctpl))); continue
    tot=sum(pool.values()) or 1
    items=sorted(pool.items(),key=lambda x:-x[1])[:40]
    lst=[{"tpl":t,"name":name_ru(t),"prob":round(100*p/tot,2)} for t,p in items]
    ctot=sum(counts.get(ctpl,{}).values()) or 1
    cdist=sorted(({"count":c,"prob":round(100*p/ctot,1)} for c,p in counts.get(ctpl,{}).items()),key=lambda x:-x["prob"])
    # если slug уже есть (несколько tpl → один slug, напр. jacket), сливаем: берём с большим пулом
    if slug not in out or len(lst)>len(out[slug]["items"]):
        out[slug]={"items":lst,"counts":cdist}

print("\n=== ПОКРЫТИЕ ===")
print("контейнеров-tpl:",len(agg),"| замаплено slug:",len(out),"| не замаплено:",len(unmapped))
print("slug'ов с данными:",sorted(out.keys()))
print("\nНЕ замаплено (tpl → имя):")
for t,n in unmapped: print("  ",t,n)
json.dump(out,open("/tmp/container-loot.json","w"),ensure_ascii=False,separators=(",",":"))
print("\nразмер ассета:",__import__("os").path.getsize("/tmp/container-loot.json"),"байт")
