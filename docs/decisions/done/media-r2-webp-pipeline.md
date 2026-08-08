---
status: ✅ реализовано (ветка feat/eft-maps-grill2) — ⚠️ нужен один шаг на проде (env)
affects: cms, media, uploads, storage, r2, editorial-markers, avatars
date: 2026-07-31
---

# Загрузки CMS → webp + Cloudflare R2

Все загружаемые через медиа-библиотеку изображения (скрины editorial-маркеров, контент CMS)
теперь **конвертируются в webp и кладутся в Cloudflare R2** — вместо Supabase Storage.

## Почему не cwebp.exe напрямую
`C:\cta-converter` (cwebp.exe + ffmpeg.exe) — **локальный десктоп-GUI** V4DYA. `cwebp.exe` —
Windows-бинарь; прод крутится на **Vercel (Linux serverless)**, где `.exe` не запустить и вообще
нельзя спавнить произвольные бинарники. Серверный webp там делает **`sharp`** — это тот же
**libwebp**, что внутри cwebp, с прибилженными Linux-бинарями. Качество сведено к твоему
конвертеру: `webp quality 90` (= `config.json → webp_quality`). Десктоп-конвертер остаётся как
есть для ручных/батч-задач — просто он не в вебе.

## Как устроено (двойная конвертация — намеренно)
1. **Клиент** (`MediaLibrary.toWebp`, Canvas): до отправки ужимает картинку до ≤2560px и
   кодирует в webp (q0.9). Причина — **лимит тела запроса Vercel ~4.5 МБ**: 4K-PNG-скрин его
   превышает, а webp — нет. Анимированный gif клиент не трогает (Canvas взял бы один кадр).
2. **Сервер** (`/api/admin/media` POST): sniff сигнатуры → `sharp`→webp q90 (ресайз ≤2560px;
   gif → анимированный webp) → `r2Put` в бакет → запись в каталог `media`. Пере-кодирование на
   сервере гарантирует единое качество и метадату-strip даже при прямом POST.
3. **Хранилище** — `src/lib/r2.ts` (S3-клиент R2, общий бакет `cta-media` с иконками/картами,
   ключи `content/{год}/{uuid}.webp`, immutable-кэш 1 год, zero-egress).
4. **DELETE** — чистит объект из R2 или (legacy) из Supabase Storage, определяя по `url`.
   Старые Supabase-медиа продолжают работать (смешанное хранилище, ридер отдаёт сохранённый url).

## Файлы
- `src/lib/r2.ts` — новый R2-клиент (put/delete/publicUrl/configured).
- `src/app/api/admin/media/route.ts` — POST=sharp→R2, DELETE=R2|Supabase.
- `src/db/media.ts` — `removeMedia` возвращает `{path,url}`.
- `src/components/features/media/MediaLibrary.tsx` — клиентская webp-конвертация.
- `package.json` — `sharp ^0.34.5` в deps.

## ⚠️ ДЕЙСТВИЕ НА ПРОДЕ (только V4DYA — я не имею доступа к Vercel/секретам)
До сих пор R2 **писали только локальные скрипты** (иконки/карты, читают `.env.local`), а прод
лишь **читал** публичный URL. Теперь **сервер на Vercel ПИШЕТ в R2** → нужны креды в Vercel env:
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — **добавить в Vercel
  Project → Settings → Environment Variables** (сейчас они, вероятно, только в `.env.local`).
- `NEXT_PUBLIC_ICON_BASE_URL` уже на проде (иконки грузятся) — служит и публичным корнем для
  `content/…`. Хочешь отдельный медиа-домен — задай `R2_PUBLIC_BASE` (иначе фолбэк на icon-base).
- Публичный доступ бакета уже включён (иконки отдаются) → префикс `content/` наследует его.

Без этих env прод-загрузка вернёт `500 «Хранилище R2 не настроено»` (локально с `.env.local` — ОК).

## Не сделано (по желанию, отдельно)
- Батч-миграция существующих Supabase-медиа в R2 (сейчас живут параллельно, всё работает).
- Отдельный медиа-суб-домен/бакет (если не хочешь смешивать со скриптовыми ассетами).
