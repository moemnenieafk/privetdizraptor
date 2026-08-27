# Security Hardening — аудит по «15 способов взлома вайб-проекта»

Статус: 🔎 аудит проведён · дата: 2026-08-27 · источник: `docs/15 способов, которыми ломают проект вайб-кодера..md`

## TL;DR
Прогнал проект по всем 15 типовым дырам вайб-кодинга тремя независимыми агентами-ревьюверами + прямой проверкой.
**Главный вывод: CTA — НЕ дырявый вайб-проект. 12 из 15 пунктов уже закрыты на уровне архитектуры** (defense-in-depth: RLS + app-level auth + rate-limit + CAPTCHA + magic-bytes + серверный пейвол). Это результат зрелого бэкенда (см. `docs/decisions/hosting-autonomy-migration.md`, `cta-backend`-скилл), а не случайность.

Слепой `/autopilot «перепиши все 15»` здесь **вреден**: переписывать уже защищённый код = риск регрессий против §4.10 (хирургичность). Работа сведена к **3 реальным гэпам**.

## Разбор всех 15 пунктов (наша реальность, file:line)

| # | Дыра из статьи | Статус у нас | Где в коде |
|---|---|---|---|
| 1 | Перебор формы входа | ✅ Закрыто | `api/auth/login/route.ts` — rate-limit 20/300s per IP + adaptive Turnstile CAPTCHA + `recordEvent`; `lib/rate-limit.ts` (DB-backed) |
| 2 | Пароль подходит сразу / нет 2FA | ⚠️ **ГЭП** | `api/auth/register/route.ts:47` — пароль только `8–128` символов, без требований к сложности; 2FA/MFA нет. Плюс: перечисление email уже НЕ течёт (generic 401, `login/route.ts:26,96`) ✅ |
| 3 | Ключи на виду | ✅ Закрыто | `.env*` в `.gitignore:40`; в git нет `.env`; все секреты server-only (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TWITCH_*`, `TELEGRAM_*`, `TURNSTILE_SECRET_KEY`); ни один `NEXT_PUBLIC_*` не является секретом |
| 4 | IDOR (чужой заказ по id) | ✅ Закрыто | Все мутации через `currentUserId()`/`me.id`; напр. `deleteOwnComment(id, me.id)`, `deletePublicBuild(me.id, slug)`, аватар пишется в hardcoded `avatars/{user.id}.webp` |
| 5 | Кнопки нет, а запрос работает | ✅ Закрыто | Ролевые проверки на сервере: `lib/auth/admin.ts` (`getAdmin`), `roles.ts`, `canModerate()`/`canEditContent()` во всех `api/admin/**` и `api/comlink/**`; cron за `CRON_SECRET` |
| 6 | SQL-инъекция | ✅ Закрыто | Drizzle ORM повсюду, параметризованные `sql\`…${x}…\``; склейки строк с вводом нет |
| 7 | Оплата, которой не было | ✅ Закрыто (провайдер не подключён) | `api/billing/webhook/[provider]/route.ts:53` требует `adapter.verify(req)` + идемпотентность (`writeBillingEvent`, unique provider+external_id); реестр адаптеров пуст (Yookassa/Prodamus впереди) |
| 8 | Чужие/дырявые пакеты | ⚠️ **ГЭП** | `npm audit`: 11 уязвимостей (6 HIGH). `postcss` (транзит `next`) — XSS/path-traversal, чинится `npm audit fix`; `sharp <0.35.0` — libvips CVE-2026-*, чинится `--force` (breaking → 0.35.4) |
| 9 | XSS через UGC | ✅ Закрыто | Единственные `innerHTML`/`dangerouslySetInnerHTML` в `MapViewerClient.tsx:172,2739` — статичный SVG/иконки из структурных данных, не пользовательский ввод |
| 10 | CORS `*` | ✅ Закрыто | `next.config.ts` — нет wildcard; `X-Frame-Options: DENY`, `Cross-Origin-Resource-Policy: same-origin`; remotePatterns — только доверенные CDN |
| 11 | Аватарка-программа | ✅ Закрыто | `api/account/avatar/route.ts` — MIME только `image/webp` + **проверка magic-bytes RIFF/WEBP** (не доверяет заголовку), путь привязан к uid, лимит 500KB + 10/час |
| 12 | Гонки (100 запросов сразу) | ✅ В основном | Биллинг идемпотентен (unique key); балансов/промокодов/вывода средств пока нет. DB rate-limit на всех чувствительных ручках. Отдельного гэпа нет |
| 13 | Supabase без RLS | ✅ Закрыто | RLS включён на ~29 таблицах (`supabase/*-rls.sql`, `*-ddl.ts`); каталог — select-only, юзер-данные — `auth.uid() = user_id`. Клиент НЕ ходит `.from()` напрямую — всё через серверные ручки |
| 14 | Счёт за платный API | 🟡 Частично | Gemini (OCR+image) — per-user 10/час + auth-gate + cap размера (`api/profile-ocr`, `api/ai/image`). YouTube/Twitch — без per-user лимита (но бесплатные квоты, низкий риск). Общего cost-cap kill-switch нет |
| 15 | Промпт-инъекция (скиллы) | ✅ N/A для кода | Организационное: скиллы держим локально (`feedback-skills-local`), не тянем мусор с GitHub. §7 CLAUDE.md уже регламентирует |

## ✅ ИСПОЛНЕНО (ветка `feat/security-hardening`, 2026-08-27)

**A. п.8 — Зависимости.** `npm audit fix` + `sharp@0.35.4` → закрыты все 6 HIGH (postcss XSS/path-traversal, next SSRF/DoS/middleware-bypass, sharp/libvips CVE). Осталось 4 moderate — dev-only `drizzle-kit`, не в рантайме. Билд webpack + tsc зелёные, sharp webp-encode проверен. Побочка: бамп Next 16.2.7→16.3.3 подтянул строгий `eslint-config-next` → всплыл пред-существующий `react-hooks/purity` (Date.now в useMemo, ~несколько мест) — **не блокирует билд/деплой**, отдельная уборка (см. долг).

**B1. п.2 — Парольная политика.** Единый `src/lib/auth/password-policy.ts` (12–128 + минимум 3 класса символов). Подключён: сервер `register`, клиент формы регистрации, `reset-password`, смена пароля в кабинете. Подсказка `PASSWORD_HINT` в UI.

**B2. п.2 — 2FA (TOTP).** Реальная двухфакторка вместо мокапа:
- Кабинет → Безопасность → 2FA: enroll (QR + ручной ключ) → verify → включено/отключить.
- Логин: после верного пароля при наличии фактора — шаг ввода 6-значного кода (`challengeAndVerify` → AAL2).
- Гарды `getAdmin`/`getCmsUser` требуют AAL2, если у пользователя включён фактор (`src/lib/auth/mfa.ts`, fail-open на сбое провайдера).

**C. п.14 — Cost-cap.** Проверено: изменений НЕ требуется. Gemini — per-user 10/час + auth-gate + cap размера; YouTube — `unstable_cache` (CATALOG_TTL) + фиксированные плейлисты; Twitch — `revalidate:30` + кэш токена. Все три уже ограничены по квоте/стоимости.

### Требует ручного шага на инфре (self-hosted Supabase / Coolify env)
- `GOTRUE_PASSWORD_MIN_LENGTH=12` + `GOTRUE_PASSWORD_REQUIRED_CHARACTERS=...` — единственный серверный гейт на пароль при reset (updateUser идёт мимо наших ручек).
- Проверить, что MFA включён в GoTrue (`GOTRUE_MFA_ENABLED`/factor TOTP), иначе enroll вернёт ошибку.

### Требует live-verify V4DYA перед пушем в main
- Пройти enroll 2FA на своём аккаунте (Google Authenticator/Aegis), выйти, войти с кодом.
- Убедиться, что админ-действия под 2FA работают (AAL2-гейт не залочил).

---

## (архив) Первичный план — 3 гэпа

### A. п.8 — Зависимости (высокий приоритет, но осторожно с деплоем)
- `npm audit fix` — закрывает `postcss` (non-breaking). Безопасно.
- `sharp` → 0.35.4 — **breaking bump**. Sharp используется в рендере иконок/аватаров/тайлов. Требует проверки билда (`next build --webpack`, см. `gotcha-turbopack-build`) и smoke-теста рендера ПЕРЕД пушем — Coolify авто-деплоит на push в main (`hosting-autonomy-migration`). Риск для живого `cta.quest`.
- `next` 16.2.7 → 16.3.x — закрывает часть HIGH; в пределах мажора 16, низкий риск.

### B. п.2 — Парольная политика + 2FA
- **Дёшево и surgical:** поднять минимум до 12 символов + требование смешивать классы символов в `register/route.ts:47` (+ фронт-подсказка). Затрагивает UX регистрации → V4DYA.
- **2FA для админов** — полноценная фича (TOTP через Supabase Auth `enroll`/`challenge`), нужен UX-дизайн V4DYA. Не «промпт на 5 минут».

### C. п.14 — Cost-cap (низкий приоритет)
- Per-user суточный лимит на YouTube/Twitch (бесплатные, но квота). Опционально: глобальный kill-switch расходов.

## Развилки для V4DYA
1. **sharp/deps breaking bump** трогает живой деплой — делать сейчас с проверкой билда или отдельным окном?
2. **2FA** — это UX-фича, нужна отрисовка потока. Сейчас или в бэклог?
3. Парольная политика (12+сложность) меняет форму регистрации — ок?

## Замыкание петли
- [x] A — deps (6 HIGH закрыты, билд зелёный)
- [x] B1 — парольная политика (12+, 3 класса)
- [x] B2 — 2FA (TOTP: enroll + login-challenge + AAL2-гейт)
- [x] C — cost-cap (проверено: уже закрыто, код не нужен)
- [ ] Инфра: GoTrue env (`GOTRUE_PASSWORD_*`, MFA) — V4DYA на Coolify
- [ ] Live-verify 2FA на cta.quest → затем merge в main
- [ ] Долг: уборка `react-hooks/purity` (Date.now в useMemo) — фоллаут строгого линта Next 16.3
- [ ] Обновить `docs/state/` срез после merge
