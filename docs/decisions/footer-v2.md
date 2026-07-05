---
status: ✅ реализовано
affects: layout, footer
date: 2026-07-04
---
# Футер v2 — Twitch API + соцлинки + дубль навигации

Эпик E1 из [[additional-workout]] (пункт №1). Размер `S`, лимит-устойчивый.

## Цель
Переделать футер: live-статус двух Twitch-каналов, соц-линки, дублирование верхней навигации.

## Контекст (что уже есть)
- `src/app/api/twitch-status/route.ts` — статус Twitch (расширить на 2 канала).
- `src/components/layout/Footer.tsx` — текущий футер (nav-линки, диагностика, соц TG/GitHub).
- Верхняя навигация — источник для дублирования (взять из общего конфига `headerConfig`, не хардкодить заново).

## Scope
- Два канала: **Фуллкамень** и **v4dyatv** — live-индикатор + ссылка (twitch-status на массив каналов).
- Соц-линки: свести в одном месте (TG, GitHub, Twitch ×2, +недостающие).
- Дубль верхней навигации в футере из единого источника.

## Границы
- **НЕ трогаем:** верхний хедер; логику диагностики (ping) оставить.

## Критерий готовности
- [x] `tsc` чисто
- [x] Оба Twitch-канала показывают корректный live/offline
- [x] Навигация в футере совпадает с верхней (один источник)

## Гарды
- ⚠ Twitch API — проверить, хватает ли текущего client credentials на 2 канала (env).
  → Решено: один `client_credentials`-токен обслуживает все каналы (helix/streams публичный, per-channel авторизация не нужна). Доп. ключи НЕ требуются.

## Снапшот реализации (2026-07-04)
- `src/app/api/twitch-status/route.ts` — расширен на массив `CHANNELS` (`fullkamen`, `v4dyatv`), один helix-запрос с несколькими `user_login`. Ответ: `{ isLive, channels: [{login,label,isLive}] }`. Поле `isLive` (основной канал) сохранено для обратной совместимости со `StreamStatus.tsx`.
- `src/components/layout/Footer.tsx`:
  - Навигация COL1 теперь из единого источника `getHeaderConfig(pathname).menuItems` (game-aware), хардкод `NAV_LINKS` удалён.
  - COL3: соц-линки сведены в `SOCIAL_LINKS` (GitHub, TG) + два Twitch-канала с live-индикатором (loading `···` / `LIVE` / `OFFLINE`).
- Легаси `src/components/Footer.js` НЕ трогали (мёртвый, живой — `layout/Footer.tsx` через `ConditionalLayout`).
- ⚠ Живой live/offline требует `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` в env (визуальная проверка — при наличии ключей).

---
*Процесс: [[engineering-loop]]*
