---
status: ✅ сделано (SMTP — отдельной задачей)
affects: feedback, layout, db
date: 2026-07-04
done: 2026-07-04
---
# Форма «Сообщить об ошибке» (feedback-form)

> [!success] Закрыто 2026-07-04 (ревизия 2026-07-14)
> Проверено в коде: `FeedbackModal`, `POST /api/feedback`, таблица `feedback` в схеме. Остаток (письмо на почту, Storage-вложения) вынесен в бэклог, не блокер.


## Цель
Модалка «Сообщение об ошибке или неточности данных» (Figma node 1588-1322): глобальная,
намертво цепляет текущий URL страницы, шлёт на поддержку сообщение + скриншоты.

## Решения (развилки, утверждено V4DYA)
- **Доставка:** Supabase-таблица `feedback` (не сразу письмо) — SMTP отложен до миграции
  ([[hosting-vercel-first]]). Копим в БД → письмо прикрутим позже Edge Function + Resend.
- **Триггер:** глобальный (футер на всех страницах) + ожил disabled-триггер в футере
  сюжетных гайдов StoryWalkthrough.
- **Вложения:** инлайн в БД (jsonb base64, ≤5×500 Кб) — bucket не заводили вручную;
  при росте объёма мигрировать в Storage `cta-feedback`.

## Реализовано
- **UI:** `components/layout/header-modules/FeedbackModal.tsx` (1:1 Figma, NIGHTFALL,
  клиент-валидация, состояния idle/sending/success/error) + `providers/FeedbackProvider.tsx`
  (контекст `openFeedback(url?)`, монтаж в корневом layout, захват `window.location.href`).
- **API:** `POST /api/feedback` (multipart; валидация email/сообщение/файлы; инсерт owner-ролью
  мимо RLS; userId из сессии Supabase, не из тела).
- **БД:** таблица `feedback` в `db/schema.ts` (additive) + `supabase/feedback.sql`
  (RLS enable без policy — бэкенд-онли, паттерн rate_limits). Накатано `db:sql` (идемпотентно).
- Триггеры: Footer «[ СООБЩИТЬ ОБ ОШИБКЕ ]» + StoryWalkthrough footer.

## Критерий готовности
- [x] `tsc` чисто
- [x] `db:sql` применён (таблица feedback создана)
- [ ] E2E-проверка отправки (dev-раннер) — при приёмке
- [ ] (позже) реальная отправка письма на почту поддержки (Edge Function + Resend)
- [ ] (позже) миграция вложений в Storage `cta-feedback`

---
*Процесс: [[engineering-loop]]*
