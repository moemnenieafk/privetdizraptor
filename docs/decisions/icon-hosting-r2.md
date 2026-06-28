---
status: ✅ сделано
affects: icons, infra, egress
date: 2026-06-28
done: 2026-06-28
---
# Иконки предметов → Cloudflare R2 (уход от egress Supabase)

**Статус:** ✅ сделано (2026-06-28) — прод раздаёт 5044 иконки с R2 (5044/5044, 0 с Supabase), egress-источник закрыт. Коммит `ddd1e70`.
**Затрагивает:** `src/lib/item-icon.ts` · `scripts/upload-icons-r2.ts` · Supabase Storage · Cloudflare R2

## Контекст
Письмо Supabase: **Egress Exceeded** в прошлом цикле, грейс-период до **28.07.2026**, после — Fair Use → запросы могут отдавать **402**. Диагноз по коду: главный источник egress — **5044 иконки предметов**, которые раздавались сырым `<img>` напрямую из Supabase Storage (`cta-media/items/eft/{id}.webp`), без CDN-offload. Каталог/бартеры/убежище тянут десятки-сотни иконок за экран.

## Решение
Увести раздачу иконок на **Cloudflare R2** — у R2 **нулевая плата за egress**. Иконки остаются нашими (автономия сохранена), Supabase Storage остаётся бэкапом-фолбэком.

Рассмотренные альтернативы:
- **Vercel `/public`** — бесплатно, но 418 МБ (512px) в git навсегда + риск лимитов деплоя. Отклонено.
- **next/image** — без распухания репо, но fair-use лимит оптимизации Vercel Hobby. Отклонено.
- **Апгрейд Supabase Pro ($25/мес)** — не убирает первопричину. Отклонено.

## Что сделано
- **Пережатие:** оригиналы 512px (~85 КБ) → **256px/q80** (~4 КБ, −76…94%). На плитках (64–128px) качество неотличимо (апрув V4DYA). Весь набор ~21 МБ вместо 418.
- **Заливка:** `scripts/upload-icons-r2.ts` (`npm run db:upload-icons-r2`) — sharp-пережатие на лету + PutObject в R2 (`cta-media/items/eft/{id}.webp`) с `Cache-Control: public, max-age=31536000, immutable`. Бакет публичный через `r2.dev`.
- **URL:** `itemIconUrl()` берёт базу из `NEXT_PUBLIC_ICON_BASE_URL` (R2). Фолбэк → Supabase `cta-media` → локальный `/public`. Переключение = одна env-переменная, обратимо.

## Сделано на проде
- [x] `NEXT_PUBLIC_ICON_BASE_URL` в Vercel env + redeploy (V4DYA).
- [x] Прод проверен: 5044/5044 иконок с `pub-…r2.dev`, 0 с Supabase.

## Осталось (позже, без спешки)
- [ ] Почистить иконки в Supabase Storage, когда убедимся, что R2 стабилен — освободить место/трафик.

## Бэклог
- Кастомный домен для R2 вместо `r2.dev` (когда будет домен проекта) — `r2.dev` rate-limited, для прод-нагрузки лучше свой CDN-домен.
