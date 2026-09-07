---
title: Правила составления промта — Gemini / Nano Banana
type: свод правил
scope: все проекты генерации изображений (ВДНХ, CTA, прочее)
verified: 2026-09-03 — официальная документация Google + зонды живого API
tags: [промты, gemini, nano-banana, генерация, правила]
aliases: [правила промта, prompt rules, nano banana rules]
---

# Правила составления промта — Gemini / Nano Banana

Свод собран 03.09.2026 из документации Google и **проверен зондами живого API** через `gemini-proxy.cta-quest.workers.dev`. Заменяет привычки, принесённые из Stable Diffusion и Midjourney: у Gemini другая механика, и часть приёмов оттуда не просто бесполезна, а вредна.

Проектные применения: `Пано Межзвездное пространство.md`, `panel_spacecraft_process_note.md`.

---

## 1. Главное правило: описывать, а не запрещать

**Отдельного поля `negativePrompt` в API нет.** Ни в `generationConfig`, ни где-либо ещё. Всё, что написано в стиле «no cars, no text, no watermark», уходит в основной промт обычными словами — и работает против тебя: упомянутый объект попадает в контекст модели.

Официальная формулировка Google:

> **Use positive framing: Describe what you want, not what you don't want (e.g. "empty street" instead of "no cars").**

| Идиома SD (не работает) | Канон Gemini |
|---|---|
| `no cars` | `an empty street` |
| `no background stars` | `the surrounding field is starless and featureless black` |
| `no text, no logos, no watermarks` | `a clean photographic plate, its surface free of any lettering` |
| `no object cut by the frame edge` | `empty space at least 12% of the frame height separates the subject from every edge` |

### Приём «закрытие перечня»

Самый надёжный способ исключить всё лишнее разом — **исчерпывающе перечислить, что в кадре есть**:

> `The frame contains exactly three things: the black hole, its own halo, and empty black.`

Утверждение положительное, модель его любит, а всё неназванное отсекается. Работает лучше, чем список из пятнадцати «no».

Второй вспомогательный приём — **`Nothing that is not explicitly named above may appear in the frame.`** Он допустим (это ограничение, а не отрицание объекта), но сам по себе слабее, чем закрытие перечня.

---

## 2. Структура промта — пять опор

Официальная формула Google для генерации без референсов:

```
[Subject] + [Action] + [Location/context] + [Composition] + [Style]
```

Для Nano Banana Pro та же мысль расписана как **Subject · Composition · Action · Location · Style**.

**Начинать с сильного глагола**, который называет операцию: `Render…`, `Generate…`, `Photograph…`, `Redraw…`, `Restyle…`.

Писать **связной прозой абзацами**, а не списком ключевых слов через запятую. Разметка блоков заголовками (`SUBJECT.`, `COMPOSITION.`, `STYLE.`) допустима и удобна — она не превращает промт в keyword soup, пока внутри блоков идут нормальные предложения.

**Формула для мультимодальной генерации** (с приложенными картинками):

```
[Reference images] + [Relationship instruction] + [New scenario]
```

> `Using the attached napkin sketch as the structure and the attached fabric sample as the texture, transform this into a high-fidelity 3D armchair render. Place it in a sun-drenched, minimalist living room.`

---

## 3. Конкретика — как у фотографа, а не как у художника

Google просит уровень детализации технического задания на съёмку. Чем конкретнее, тем больше контроля.

| Ось | Что задавать | Пример |
|---|---|---|
| **Свет** | схему освещения буквально | `three-point softbox setup` · `chiaroscuro lighting with harsh, high contrast` · `golden hour backlighting creating long shadows` |
| **Камера** | конкретный аппарат меняет визуальную ДНК | `shot on a GoPro` (иммерсия, дисторсия) · `Fujifilm` (цветовая наука) · `cheap disposable camera` (сырой ностальгический флэш) |
| **Объектив** | перспектива и ГРИП | `low-angle shot with a shallow depth of field (f/1.8)` · `wide-angle lens` · `macro lens` |
| **Плёнка и грейд** | | `as if on 1980s color film, slightly grainy` · `cinematic color grading with muted teal tones` |
| **Материал** | из чего физически сделан объект | не `suit jacket`, а `navy blue tweed`; не `armor`, а `ornate elven plate armor, etched with silver leaf patterns` |
| **Кадрирование** | | `center-framed` · `medium-full shot` · `low angle` · `aerial view` |
| **Холст** | | `a 9:16 vertical poster` · `a cinematic 21:9 wide shot` |

---

## 4. Геометрия и композиция — в процентах от кадра

Модель понимает относительные величины лучше, чем абсолютные. Работает:

- `centred at forty-eight percent of the frame height measured from the top`
- `at twenty percent of the frame width`
- `empty space at least twelve percent of the frame height between the subject and any edge`
- `every change of height happens gradually, over at least four percent of the frame width`

Числа лучше писать **словами** (`forty-eight percent`), а не цифрами — цифры модель иногда пытается нарисовать как текст в кадре.

**Запас под кроп** — легальный и рабочий приём: сгенерировать шире и обрезать.

> `This 4:1 frame will be cropped to 3.14:1 by trimming the sides, so the outer eleven percent of the left edge and the outer eleven percent of the right edge hold nothing but empty deep space.`

**Приоритет при конфликте** формулировать явно — иначе модель решит сама:

> `Where composition and the calm band pull against each other, the band wins: move the astronomical objects and leave the band dim and empty.`

---

## 5. Экономика ограничений: сколько условий выдерживает один кадр

Эмпирика двух панелей. Если модель держит каждое жёсткое геометрическое условие с вероятностью ~0,8, то:

| Условий в кадре | Шанс попасть со всеми | Прогонов на один годный |
|---|---|---|
| 3 | 51% | 2 |
| 5 | 33% | 3 |
| **8** | **17%** | **5–6** |

**Отсюда правило: не грузить один кадр восемью условиями.** Дешевле разложить сцену на элементы, сгенерировать каждый отдельно и собрать вручную — тогда брак стоит один элемент, а не весь кадр.

Это же правило в проектной формулировке из «Процесса аппарата»: *схему целиком генерировать нельзя — генерируются листы, сборка вектором*.

**Метрология не делегируется.** Всё, что имеет допуск (нейтральность заливки, ΔL между зонами, чёрная точка, точные координаты), дешевле сделать руками в Photoshop, чем выпрашивать и потом измерять.

---

## 6. Текст в кадре

Nano Banana Pro умеет рендерить читаемый текст — это его сильная сторона против конкурентов. Но:

- **Кириллицу ломает.** Для русских надписей — вектор поверх, не генерация.
- **Слова в кавычках.** `Enclose your desired words in quotes (e.g., "Happy Birthday")`.
- **Шрифт описывать словами:** `bold, white, sans-serif font` · `Century Gothic 12px font`.
- **Text-first hack:** сначала обсудить с моделью текстовые формулировки в диалоге, потом просить картинку с ними — так точность выше.
- **Локализация:** можно писать промт на одном языке и просить надпись на другом.

> [!warning] Обратная сторона
> Если назвать в промте группы объектов словами («design office», «manufacturing»), модель **напечатает эти названия** на макете. Для черновиков-раскладок вместо заголовков просить плашки-заглушки: `plain rounded outlines standing in for text`.

---

## 7. Референсы и единство стиля

- **До 14 референсных изображений** в одном промте.
- Назначение: консистентность персонажа, перенос стиля, вживление продукта в новую сцену.
- Строка стилевого анкора: `Match the attached image for palette, grade, grain and rendering physics. Style only.`
- **Риск:** модель склонна копировать не только стиль, но и **содержание** референса. Если анкор содержит крупный объект — он может проявиться в новом кадре. Для чистого переноса стиля добавлять `Style only.` и не цеплять анкор туда, где сюжет должен быть принципиально иным.

> [!danger] Анкор сжимать до ≤100 КБ
> 1024 px по длинной стороне, JPEG q78. Тяжёлый вход (>~1,5 МБ) выбивает `402 Insufficient balance` **при живом балансе** — шлюз резервирует под запрос по верхней оценке. Разрешение анкора роли не играет: модель считывает с него палитру, зерно и характер рендера, не деталь.

---

## 8. Итерация: правка репликой, а не регенерацией

Попадание на 80% — **не повод жечь новый кадр**. Официальная рекомендация: вести диалог, менять **по одной переменной за раз** и **явно перечислять, что остаётся неизменным**.

```
Keep the composition, the object positions, the palette and the grade exactly as
they are. Make the accretion disc twenty percent smaller.
```

Регенерация с нуля меняет всё, включая то, что уже нравилось. Это самый частый способ слить бюджет.

**Порядок прогонов серии:** сперва самый сложный и самый ответственный кадр — он принимает стиль. Пока он не устраивает, остальные не запускать. Принятый прикладывать анкором к остальным.

---

## 9. Линейка моделей (03.09.2026)

| Модель | API string | Разрешения | Статус |
|---|---|---|---|
| **Nano Banana Pro** | `gemini-3-pro-image` | 1K · 2K · 4K | GA |
| **Nano Banana 2** | `gemini-3.1-flash-image` | 512 · 1K · 2K · 4K | GA |
| **Nano Banana 2 Lite** | `gemini-3.1-flash-lite-image` | 1K | GA |
| Nano Banana (легаси) | `gemini-2.5-flash-image` | до 1024 px | GA, устарела |

Текстовые модели картинок не генерируют: `gemini-3.8-flash` (GA), `gemini-3.1-pro-preview`. **Моделей `3.5 Pro` / `3.8 Pro` не существует.** `gemini-3.5-transcribe` — распознавание речи.

**Контекст:** NB2 — 131 072 входных токена, Pro — 65 536. Выход 32 768 у обеих. Длина промта практически не ограничена, экономить символы незачем.

### Выбор модели

- **Печать, крупный формат, тонкая текстура** → **Pro**. Отстаёт по скорости (10–20 с против 4–6 с), но впереди на 5–8% в текстуре и естественности света.
- **Скорость, объём, итерации, черновики** → **NB2**. Даёт ~95% качества Pro, вдвое-втрое быстрее, заметно дешевле.
- **Соотношения `4:1`, `1:4`, `8:1`, `1:8`** → **только NB2** (см. §10).
- **Легаси `2.5-flash-image` не использовать:** потолок 1024 px и не держит заданный вес штриха. Историческое возражение «Flash не годится» относится **именно к ней** и на NB2 не переносится.

---

## 10. Аспекты и размеры — что проверено вызовом

**Две ступени валидации, это важно.**

**Схемная** — общая для всех моделей, отдаёт полный перечень:

```
aspect_ratio must be one of '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1',
'4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'
image_size must be one of: 1K, 2K, 4K, 512, 512P, 512PX
```

**Модельная** — срабатывает после схемной и режет то, чего конкретная модель не умеет:

```
gemini-3-pro-image + 4:1  →  400 "Aspect ratio 4:1 is not supported for this model"
```

Итог: **схема принимает 14 аспектов, но Pro поддерживает только 10 стандартных.** Расширенные `1:4 · 4:1 · 1:8 · 8:1` — прерогатива Flash-линейки. Проверено на `4:1`; остальные три — по документации.

Аналогично Lite: схема примет `4K`, модель отдаёт только 1K.

> [!tip] Бесплатный зонд доступности
> Чтобы узнать, есть ли модель на шлюзе и что она умеет, слать запрос с **заведомо невалидным** параметром: `aspectRatio: "99:1"` или `imageSize: "9K"`. Схемная ошибка `400` возвращает полный перечень допустимых значений и **не тарифицируется**.
>
> **Валидным параметром зондировать нельзя** — запрос пройдёт и сгенерирует картинку. Так 03.09.2026 было потрачено ~6 ₽ на кадр по промту «x».

---

## 11. Цены за изображение (Google, 03.09.2026)

| Модель | Standard | Batch |
|---|---|---|
| `gemini-3-pro-image` 1K/2K | **$0,134** | $0,067 |
| `gemini-3-pro-image` 4K | **$0,24** | $0,12 |
| `gemini-3.1-flash-image` 0.5K | $0,045 | $0,022 |
| `gemini-3.1-flash-image` 1K | $0,067 | $0,034 |
| `gemini-3.1-flash-image` 2K | $0,101 | $0,050 |
| `gemini-3.1-flash-image` 4K | **$0,151** | $0,076 |
| `gemini-3.1-flash-lite-image` 1K | $0,0336 | $0,0168 |
| `gemini-2.5-flash-image` | $0,039 | $0,0195 |

**Batch вдвое дешевле** — если прогон не срочный, это честная экономия 50%.

**Рублёвый курс через ProxyAPI:** замер 02.09.2026 дал ~100 ₽ за Pro 2K при цене $0,134 → эффективно **~750 ₽/$** с наценкой шлюза. Пересчитывать по дельте баланса, а не по биржевому курсу.

**Ставка 4K выше 2K в 1,8 раза у Pro и в 1,5 у NB2** — на черновики брать меньшее разрешение осознанно.

---

## 12. Транспорт из России

```
POST https://gemini-proxy.cta-quest.workers.dev/v1beta/models/{model}:generateContent
x-goog-api-key: $PROXYAPI_KEY
Content-Type: application/json

{"contents":[{"parts":[{"inline_data":{...}},{"text":"..."}]}],
 "generationConfig":{"responseModalities":["IMAGE"],
                     "imageConfig":{"aspectRatio":"1:1","imageSize":"4K"}}}
```

| Плоскость | Статус |
|---|---|
| `api.proxyapi.ru/google/v1beta` | ✅ из терминала V4DYA · ❌ из песочницы Claude (TLS-таймаут) |
| воркер `gemini-proxy.cta-quest.workers.dev` | ✅ отовсюду — **канон** |
| `generativelanguage.googleapis.com` напрямую | ❌ ключ невалиден + гео-блок РФ |

Воркер пропускает только `POST …:generateContent` и `/v1beta/openai/*`. `listModels` через него нет — отсюда трюк с невалидным зондом (§10).

Ключ `PROXYAPI_KEY` в `C:\cta-project\.env.local`; `GEMINI_API_KEY` там же — **тот же ключ ProxyAPI**, не гугловский. Воркер сам переписывает `x-goog-api-key` в `Authorization: Bearer` для ProxyAPI.

**Баланс:** эндпоинт `/proxyapi/balance` рабочим ключом не читается. `402` в ответе на генерацию про реальный остаток **ничего не говорит** — сперва исключить тяжёлый анкор (§7).

**UA:** при обращении curl'ом ставить `User-Agent: curl/8.4.0`, иначе Cloudflare отдаёт 1010.

---

## 13. Антипаттерны — короткий список

1. **Блок `=== NEGATIVE ===` с перечнем «no …»** — идиома SD, поля такого нет, объекты вводятся в контекст. → §1.
2. **Keyword soup через запятую** вместо связного описания. → §2.
3. **Восемь жёстких условий в одном кадре.** → §5.
4. **Регенерация вместо правки репликой** при попадании на 80%. → §8.
5. **Просить у модели метрологию** — точный RGB, ΔL, координаты с допуском. → §5.
6. **Называть группы объектов словами** в черновике-раскладке — модель их напечатает. → §6.
7. **Давить на «bold»** — модель утолщает не пиктограммы, а рамки и плашки. Вес штриха задавать формулой: `one stroke weight over the whole sheet, about 10 px at 2048 px on the side, exactly the same weight on the smallest detail and on the largest object`.
8. **Тяжёлый анкор** >1,5 МБ → ложный `402`. → §7.
9. **Зонд валидным параметром** — платная проверка вместо бесплатной. → §10.
10. **Апскейл «на всякий случай».** Считать, сколько пикселей реально нужно: три кадра 4K встык — это уже ~12 000 px. Апскейлер множит артефакты.
11. **Цифры цифрами в геометрии** — модель может нарисовать их как текст. Писать словами. → §4.

---

## 14. Скелет промта

```text
Render a <medium/engine> of <subject>, <one-line framing of the whole scene>.

SUBJECT. <что это, из чего сделано, что делает — прозой, физически конкретно>

COMPOSITION. <кадрирование; поля до краёв в процентах от высоты кадра;
как объект затухает к краям>

LOCATION. <окружение; закрытие перечня: "the frame contains exactly N things: …">

LIGHT. <единственный источник света и что от него освещено>

STYLE. <медиум, палитра с HEX, камера/объектив/плёнка, грейд, зерно,
чёрная точка; "a clean photographic plate, its corners empty and its surface
free of any lettering">

PRIORITY. <что побеждает при конфликте требований>
```

Инвариантные блоки (`STYLE`, `LIGHT`, правило краёв) в серии кадров повторять **дословно** — это и есть механизм единого стиля. Не переписывать «для разнообразия».

---

## 15. Источники

- [Gemini API — Image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini API — Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API — Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google Cloud — Ultimate prompting guide for Nano Banana](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)
- [Google Blog — Prompting tips for Nano Banana Pro](https://blog.google/products-and-platforms/products/gemini/prompting-tips-nano-banana-pro/)
- [Google Blog — Build with Nano Banana 2](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-nano-banana-2/)
- [Nano Banana Pro vs Nano Banana 2 — сравнение](https://nanobanana.org/posts/nano-banana-pro-vs-nano-banana-2-comparison)
- [Nano Banana Pro API — negative prompt](https://help.apiyi.com/en/nano-banana-pro-api-negative-prompt-guide-en.html)

Плюс зонды живого API через воркер, 03.09.2026 — перечни аспектов и размеров, отказ Pro на `4:1`.
