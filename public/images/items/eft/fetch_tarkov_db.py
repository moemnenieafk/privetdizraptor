import os
import json
import requests
from tqdm import tqdm
from PIL import Image
import io

API_URL = "https://api.tarkov.dev/graphql"
LANGUAGES = ['ru', 'en']

# Создаем новые папки под High-Res ассеты
PNG_DIR = os.path.join("images", "high_res_png")
WEBP_DIR = os.path.join("images", "high_res_webp")

os.makedirs(PNG_DIR, exist_ok=True)
os.makedirs(WEBP_DIR, exist_ok=True)

def clean_text(text):
    if not text:
        return ""
    return text.replace('\u00a0', ' ').replace('\u200b', '').replace('\u200e', '').replace('\u200f', '')

# Запрашиваем image8xLink вместо обычной маленькой grid-картинки
QUERY = """
query ($lang: LanguageCode!) {
  items(lang: $lang) {
    id
    name
    shortName
    description
    types
    image8xLink
  }
}
"""

def fetch_items_for_lang(lang):
    print(f"[*] Загрузка ссылок на High-Res рендеры ({lang})...")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    try:
        response = requests.post(API_URL, json={'query': QUERY, 'variables': {"lang": lang}}, headers=headers, timeout=30)
        if response.status_code == 200:
            res_json = response.json()
            if 'errors' in res_json:
                return []
            return res_json['data']['items']
        return []
    except Exception:
        return []

def main():
    localized_db = {}
    image_links = {}

    for lang in LANGUAGES:
        items = fetch_items_for_lang(lang)
        if not items:
            continue
            
        for item in items:
            item_id = item['id']
            if item_id not in localized_db:
                localized_db[item_id] = {
                    "id": item_id,
                    "names": {},
                    "shortNames": {}
                }
                # Сохраняем ссылку на 8x рендер, если она есть у предмета
                if item['image8xLink']:
                    image_links[item_id] = item['image8xLink']
            
            localized_db[item_id]["names"][lang] = clean_text(item['name'])
            localized_db[item_id]["shortNames"][lang] = clean_text(item['shortName'])

    print(f"\n[*] Найдено High-Res рендеров для скачивания: {len(image_links)}")
    
    session = requests.Session()
    for item_id, url in tqdm(image_links.items(), desc="Загрузка HQ рендеров (PNG -> WebP)"):
        png_path = os.path.join(PNG_DIR, f"{item_id}.png")
        webp_path = os.path.join(WEBP_DIR, f"{item_id}.webp")
        
        png_exists = os.path.exists(png_path) and os.path.getsize(png_path) > 0
        webp_exists = os.path.exists(webp_path) and os.path.getsize(webp_path) > 0
        
        if png_exists and webp_exists:
            continue
            
        try:
            img_bytes = None
            if not png_exists:
                res = session.get(url, timeout=15)
                if res.status_code == 200:
                    img_bytes = res.content
                    with open(png_path, 'wb') as f:
                        f.write(img_bytes)
            else:
                with open(png_path, 'rb') as f:
                    img_bytes = f.read()
            
            if img_bytes and not webp_exists:
                img = Image.open(io.BytesIO(img_bytes))
                # Конвертируем в WebP с сохранением прозрачности (RGBA) и отличным качеством
                if img.mode in ('RGBA', 'LA'):
                    img.save(webp_path, "WEBP", quality=95, lossless=False)
                else:
                    img.save(webp_path, "WEBP", quality=95, lossless=False)
        except Exception:
            pass

    print("\n[+] Скачивание и конвертация всех High-Res картинок завершена успешно!")

if __name__ == "__main__":
    main()