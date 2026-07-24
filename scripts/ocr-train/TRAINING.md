# Тренинг-ран: fine-tune Tesseract `eng` → `eftflea` (Google Colab)

Тулчейн tesseract (`lstmtraining`, tesstrain) на Windows не завести — гоним в **Colab**.
Датасет (`scripts/ocr-train/data/`) заархивировать и залить в Colab.

```bash
# 1. Тулчейн
!apt-get -qq install tesseract-ocr libtesseract-dev tesseract-ocr-eng > /dev/null
!git clone --depth 1 https://github.com/tesseract-ocr/tesstrain
!git clone --depth 1 https://github.com/tesseract-ocr/tessdata_best
%cd tesstrain && pip -q install -r requirements.txt

# 2. Данные: распакуй свой data.zip в tesstrain/data/eftflea-ground-truth/
!mkdir -p data/eftflea-ground-truth && unzip -q /content/data.zip -d data/eftflea-ground-truth

# 3. Fine-tune от eng (LSTM). ~несколько тыс. итераций, следи за CER на eval.
!make training \
    MODEL_NAME=eftflea \
    START_MODEL=eng \
    TESSDATA=/content/tessdata_best \
    GROUND_TRUTH_DIR=data/eftflea-ground-truth \
    MAX_ITERATIONS=8000 \
    PSM=7

# 4. Готовый data/eftflea.traineddata скачать.
from google.colab import files; files.download('data/eftflea.traineddata')
```

## Интеграция в браузер (tesseract.js)
1. Положить `eftflea.traineddata` в `public/tessdata/` (или на CDN, gzip).
2. В `src/lib/companion/ocr.ts` цену/использования читать воркером с кастомным языком:
   ```ts
   const w = await createWorker('eftflea', 1, { langPath: '/tessdata' });
   ```
   (имена оставить на `rus` — их и так добивает каталог-матч.)
3. Сравнить на реальных скринах (kerman/T-7/ключи) до/после; замерить, что 0↔6 ушло.

## Дальше (стадия 3)
Дособрать реальные метки из `ocr_samples` (правки юзеров) и дообучить поверх — реальный
рендер добьёт то, что синтетика не покрыла (сжатие игры, антиалиасинг монитора).
