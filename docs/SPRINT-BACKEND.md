# SPRINT: Бэкенд CTA — состояние и план (handoff)

> Документ-передача между сессиями/аккаунтами. Обновляется по ходу работы над бэкендом.
> Последнее обновление: 2026-06-21.

---

## 0. КАК ПРОДОЛЖИТЬ ПОСЛЕ СМЕНЫ АККАУНТА (читать первым)

1. **Код не потерян.** Бэкенд закоммичен в git локально:
   - Ветка: `worktree-backend-foundation` (и дубль `feat/backend-foundation` — то же самое).
   - Коммит: `feat(backend): фундамент базы — Supabase Postgres + Drizzle (слой 1)`.
   - Физически файлы worktree лежат в `C:\cta-project\.claude\worktrees\backend-foundation\`.
2. **Таблицы и данные** уже в облаке Supabase — они общие, от смены аккаунта Cursor не зависят.
3. **Секрет (`.env.local`)** в git НЕ попадает (gitignored). Файл существует на диске в worktree:
   `C:\cta-project\.claude\worktrees\backend-foundation\.env.local`.
   Если будешь работать в основном проекте (`C:\cta-project`), а не в worktree — **скопируй `.env.local` туда** (пароль также сохранён у тебя при создании проекта Supabase / в Settings → Database).
4. **Что осталось сделать прямо сейчас:** запушить ветку на GitHub и слить в `main` через PR — НО под правильным GitHub-аккаунтом (тем, что связан с Vercel). См. раздел 4.
5. Новой сессии Claude: контекст продублирован в постоянной памяти (`MEMORY.md` подхватится автоматически).

---

## 1. ПРИНЯТЫЕ РЕШЕНИЯ

| Решение | Выбор | Почему |
|---|---|---|
| **Архитектура** | Вариант А: бэкенд внутри Next.js (`app/api/`), не отдельный сервер | один репо/деплой, проще для соло-разработчика; масштаб Б (Node+GraphQL+Redis) избыточен |
| **Провайдер БД + Auth** | Supabase (Postgres + Auth + Storage + Table Editor) | всё в одном, есть визуальный редактор данных |
| **ORM** | Drizzle (+ драйвер postgres.js) | быстрый холодный старт для serverless, нативный SQL |
| **Источник игровых данных** | автономная копия из дампов **SPT-Tarkov** | не зависеть от чужого `tarkov.dev` API |
| **Модель данных** | EAV + JSONB (универсальные поля + типизированный JSONB на специфику) | мультигейминг-ready, гибкость по типам предметов |
| **Авторизация** | OAuth (Discord/Steam/Twitch), без своих паролей | меньше рисков |
| **Медиа (иконки)** | Cloudflare R2 + CDN | дёшево, zero egress |
| **Хостинг** | Vercel (уже задеплоено) + Supabase | нативная интеграция |

---

## 2. ЧТО УЖЕ СДЕЛАНО (слой 1 — фундамент базы) ✅

Поднята и **проверена на реальном Supabase** база данных. Round-trip insert/select работает.

**Созданные файлы:**
- `src/db/schema.ts` — схема: таблицы `games`, `item_categories`, `items`, `item_properties`
  (EAV + JSONB с GIN-индексом; типы предметов — Discriminated Union: ammo/armor/weapon/container/medical/generic).
- `src/db/index.ts` — рантайм-клиент (через транзакционный пулер Supabase, `prepare:false`, singleton).
- `drizzle.config.ts` — конфиг миграций (через сессионный пулер, читает `.env.local`).
- `.env.local` — `DATABASE_URL` (6543, рантайм) + `DATABASE_URL_SESSION` (5432, миграции). **Gitignored.**
- `scripts/check-db.ts` — тест связи + сид игры EFT.
- `package.json` — добавлены скрипты: `db:push`, `db:studio`, `db:check`.

**В базе уже есть:** 4 таблицы + 1 строка в `games` (`eft / Escape from Tarkov`).

**Подключение Supabase:** проект `swcjyvztljokdycpviio`, регион `eu-central-1`.
Строки подключения — в `.env.local` (пароль НЕ дублируем в этот документ).

---

## 3. ДОРОЖНАЯ КАРТА (5 слоёв)

1. ✅ **БД** — схема Postgres (СДЕЛАНО).
2. ⬜ **ETL** — скрипт заливки данных из дампов SPT-Tarkov в нашу базу (предметы → categories/items/item_properties). После этого нужна своя копия данных.
3. ⬜ **API** — `app/api/...` route handlers, отдают данные фронту. Постепенно переключить фронт с `tarkov.dev` на свою базу. Файлы фронта, что сейчас тянут чужой API: `src/actions/tarkov-*.ts`, `src/app/eft/items/...`, `src/app/eft/barters/`, `src/app/eft/progress/...`.
4. ⬜ **Авторизация** — Supabase Auth (OAuth), таблица `users`, сохранение прогресса (квесты/схрон) в БД вместо браузера.
5. ⬜ **CMS** — панель для ручной правки контента (патчи квестов из `docs/quests-origin/`, лендинг, модерация). В research НЕ спроектирована — проектируем сами.

**Следующий шаг:** слой 2 (ETL) ИЛИ интеграция текущей ветки в `main` — на выбор Вадима.

---

## 4. ОТКРЫТЫЙ ВОПРОС: PUSH ПОД ПРАВИЛЬНЫМ АККАУНТОМ

- Remote: `https://github.com/moemnenieafk/privetdizraptor.git`.
- Нужно пушить из-под GitHub-аккаунта, связанного с **Vercel** (Вадим переключает аккаунт Cursor под него).
- **Автор коммита** сейчас: `V4DYATV <vadimkahardcore@gmail.com>`. Если бэкенд-аккаунт использует другой email — поправить `git config user.email` и при желании переподписать коммит (`git commit --amend --author=...`).
- После входа под нужным аккаунтом:
  ```
  git push -u origin feat/backend-foundation
  ```
  затем открыть Pull Request на GitHub и слить в `main`.
- Возможный мелкий конфликт при слиянии — только в `package.json` (обе ветки добавляют зависимости). Решается объединением записей.

---

## 5. ВАЖНЫЕ ЗАМЕТКИ ИЗ RESEARCH (docs/)

- Данные SPT/tarkov.dev содержат **ошибки квестовых зависимостей** — истина в `docs/quests-origin/`, нужны ручные патчи (см. `docs/API-SRAVNENIE.md`). Полная автономность ≠ ноль ручного труда.
- Иконки SPT не отдаёт — тянуть из клиента игры через `AssetStudio.CLI`.
- Цены барахолки (динамика) — нерешённая R&D-задача (OCR-волонтёры), не входит в ближайшие слои.
