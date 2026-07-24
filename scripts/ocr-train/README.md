# Дообучение OCR распознавалки барахолки (Tesseract на шрифте Bender)

**Проблема:** барахолка EFT рендерит текст шрифтом **Bender** (Jovanny Lemonad), у которого
**перечёркнутый ноль** → стоковый Tesseract путает 0↔6 (и 3↔5) на ценах. Стоковую модель
дообучаем на синтетике в этом же шрифте → цифры читаются стабильно.

## Стадии
1. **Синтетика (тут):** `gen_synthetic.py` рендерит цены/использования в Bender с идеальной
   разметкой (формат tesstrain: `flea_XXXXXX.png` + `.gt.txt`).
2. **Тренинг-ран:** LSTM fine-tune от `eng` в Colab/WSL (тулчейн tesseract нужен там) — см. `TRAINING.md`.
3. **Реальные метки:** editable-правки юзеров + решения модератора копятся в `ocr_samples`
   (см. [[companion-ocr-evolution]]) — дообучаем на них поверх синтетики.
4. **Интеграция:** кастомный `eftflea.traineddata` грузим в tesseract.js для цен/использований.

## Локально
```
# шрифты (из C:\Windows\Fonts, НЕ коммитятся):
#   Bender-Regular.otf / Bender-Bold.otf / Bender-Black.otf → scripts/ocr-train/fonts/
python scripts/ocr-train/gen_synthetic.py --n 8000 --out scripts/ocr-train/data
```
Тренинг — в Colab по `TRAINING.md` (архив `data/` заливается туда).
