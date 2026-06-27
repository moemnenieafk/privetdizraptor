---
status: ⏳ к исполнению
affects: account, auth
date: 2026-06-26
---

# 🔴 Supabase JWT ES256 — блокер аватара

**Статус:** ⏳ к исполнению — диагноз ясен, вывод записан, ждёт действия (🔴 в заголовке = severity, не статус)
**Затрагивает:** [[account-real-data]]

## Контекст
Asymmetric JWT (ES256) user-токены не валидируются Storage/PostgREST → `auth.uid()` = NULL → RLS режет загрузку аватара. Блокирует фичу аккаунта.

## Вывод
Переключить JWT Keys в Supabase Dashboard (валидация подписи на data-plane). После — проверить, что `auth.uid()` возвращает id и RLS пропускает upload.
→ Действие на стороне Supabase Dashboard (не код). Приоритет высокий — это единственный 🔴 блокер.
