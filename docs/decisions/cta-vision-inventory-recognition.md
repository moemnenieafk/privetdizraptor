---
title: CTA Vision — починка Gemini API + распознавание инвентаря EFT
status: ✅ реализовано (ветка feat/cta-vision-inventory, не запушено)
date: 2026-08-25
tags: [decision, vision, gemini, eft, infra]
---

# CTA Vision — распознавание инвентаря по скриншоту + починка доступа к Gemini

Проведено через `/autopilot` (полуавтомат, строгая глубина) по спеке `docs/CTA-Vision-Spec/`.
Артефакты прогона — `.autopilot/cta-vision-inventory/`.

## Постановка

Спека просила: (1) починить доступ к Google Gemini API, (2) построить фичу распознавания
инвентаря EFT по скриншоту (2 уровня: pHash + Gemini vision fallback), вплоть до UI.

## Ключевой диагноз (проверено живьём)

- **Ключ Gemini валиден.** Битый ключ Google отбивает `API_KEY_INVALID`; наш `AQ.…` проходит
  проверку ключа и упирается только в локацию. Префикс `AQ.` — не помеха.
- **Поломка — egress-локация, а не ключ.** `FAILED_PRECONDITION: User location is not supported`
  и с ПК (РФ), **и с VPS Timeweb-Amsterdam** (Google видит `Timeweb LLP / AS210976` как RU).
  Допущение спеки «с VPS доступно напрямую» — **неверно**.

## Решение

**Cloudflare Worker реверс-прокси** `gemini-proxy.cta-quest.workers.dev` → egress через доверенный
AS13335 → Google принимает локацию (проверено живьём, `location not supported` исчез). Приложение
бьёт в Worker-URL (`GEMINI_PROXY_BASE`), ключ уходит заголовком `x-goog-api-key`, в Worker не хранится.
Тем же прокси починен существующий `profile-ocr`. Побочно: разблокирована и локальная разработка.

## Обязательные правки спеки (под правила проекта)

1. Egress через Worker, не «direct».
2. **Данные только из нашего зеркала** (§4.11/§4.12): seed хэшей — иконки из R2 через
   `itemIconUrl(inGameId)`, имена/габариты из `items`, `normalizedName` из прайс-индекса.
   Исходный `seed-item-hashes.ts` ходил в tarkov.dev GraphQL — **переписан**.
3. Модель `gemini-2.5-flash` **снята Google** → `gemini-3.6-flash` (env `GEMINI_VISION_MODEL`).

## Что сделано (ветка feat/cta-vision-inventory, 7 коммитов, tsc зелёный)

| Коммит | Что |
|---|---|
| `54b41f6` | Cloudflare Worker `gemini-proxy` (egress-fix, проверен живьём) |
| `73240ee` | Схема `item_icon_hashes`/`inventory_scans` (аддитивный SQL, не db:push) + `lib/vision/*` |
| `7dc2859` | profile-ocr + vision через прокси, модель gemini-3.6-flash |
| `0105251` | Route `POST /api/vision/inventory` (auth-гейт Supabase, sha256-кэш) + zustand-стор |
| `eee902a` | UI-раздел `/eft/tools/raid-scan` (дропзона, SVG-оверлей сетки, ручной выбор, цены из зеркала) |
| `cc35f59` | Seed — **5263 иконки** из зеркала (3 пропущено), без внешних API |
| `1f85f30` | Калибровка `GRID_TUNING` (emptyStdDev 9→22, separatorDarkRatio 0.7→0.6) + диагностич. скрипт |

Архитектура: **уровень-1 (pHash, 5263 иконки) работает без Gemini** и закрывает большинство ячеек
бесплатно; уровень-2 (Gemini) добирает неопознанное закрытым списком кандидатов (structured output,
`itemId ∈ кандидатов`). Отказ Gemini не роняет скан.

## Оставшийся долг / внешние блокеры

1. **💳 Биллинг Gemini (действие пользователя, деньги).** Через прокси Google отдаёт
   `429 RESOURCE_EXHAUSTED — prepayment credits depleted`. Ключ валиден, доступ открыт, но
   баланс = 0 (ср. `sprint-cta-mapper`). Уровень-2 и profile-ocr вернут результат только после
   пополнения баланса в Google AI billing.
2. **Калибровка неполна — нужен правильный скрин.** Присланный `eft-stash.jpg` показывает **СОРТ.СТОЛ**
   (витрину, 1 иконка = 1 ячейка), а не сетку схрона (где винтовка 5×2). Настоящий схрон на скрине
   не открыт (активен таб экипировки). `detectGeometry` рассчитан на честную инвентарную сетку.
   **Для прода:** фронт должен слать кроп именно сетки схрона/рюкзака, не весь экран и не сорт-стол.
   Нужен реальный скрин схрона для финального тюнинга и проверки уровня-1.
3. `/eft/tools` без индекс-страницы (не требование; при желании — хаб-карточки).
4. Пуш в main и live-verify — за V4DYA (ветка готова, tsc зелёный).

## Дополнение: генерация картинок Nano Banana + Open WebUI (по запросу V4DYA)

После основной фичи — два пути доступа к Gemini image («Nano Banana»):

- **Path A — эндпоинт в CTA** (`e232d1bc`): `POST /api/ai/image` (+ `src/lib/ai/gemini-image.ts`),
  auth-гейт + rate-limit, через Worker-прокси. Подтверждённая модель — **`gemini-3-pro-image`**
  (Nano Banana Pro; `gemini-2.5-flash-image` тоже валиден). Живой вызов = 429 prepay (инфра ок).
- **Worker расширен** (`afbd94da`): проксирует ещё и OpenAI-совместимый путь `/v1beta/openai/*`
  (Bearer-auth) — для Open WebUI. Живой тест `/v1beta/openai/models` = HTTP 200.
- **Path B — Open WebUI на VPS**: `https://ai.cta.quest` (DNS proxied → VPS; TLS через wildcard
  origin-cert `*.cta.quest`; за Coolify-Traefik, живые сервисы не тронуты). Контейнер `open-webui`,
  настроен на Worker-прокси + Gemini-ключ. Авторизация: первый регистрант = админ, остальные `pending`.
  Чат и `images/generations` проксируются (429 = только биллинг). **Инфра НЕ в git** (docker на VPS).

Обе фичи (портальный эндпоинт и веб-чат) оживают после пополнения prepay-баланса Gemini.

## Гочи на будущее
- Timeweb-IP «грязный» для Google-геолокации несмотря на физический Амстердам → Worker обязателен.
- `gemini.ts` дефолт-модель держать в env, Google ротирует линейку (2.5→3.6).
- Миграция vision — аддитивным SQL (`supabase/0090_vision.sql` + `npm run db:sql`), НЕ `db:push --force`.
