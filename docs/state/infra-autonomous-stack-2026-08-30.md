---
kind: state-snapshot
topic: инфраструктура (автономный стек)
date: 2026-08-30
supersedes: release-readiness-2026-08-19.md (в части инфры)
canon: docs/decisions/done/hosting-autonomy-migration.md
---

# Срез инфраструктуры CTA — автономный стек (2026-08-30)

Снимок текущего состояния после закрытия эпопеи «Переезд на автономный стек» + харденинга.
Полный разбор/журнал/доступы/гочи: **`docs/decisions/done/hosting-autonomy-migration.md`**.
Операционка БД/бэкенда: скилл **`/cta-backend`**. Доступ к БД (правило): **CLAUDE.md §4.13**.

## Что где живёт
- **`https://cta.quest`** — портал ЦТА, полностью на **своём VPS**. Внешних зависимостей нет, кроме R2 (тот же CF-аккаунт).
- **Стек:** Timeweb VPS (Амстердам, `201.51.20.217`) + Cloudflare (CDN/DNS/SSL/WAF) + Coolify (панель/деплой) + self-hosted Supabase (Postgres 15 + GoTrue-Auth + PostgREST + Realtime + Storage/MinIO + Kong) + Next.js 16.
- **Ассеты:** Cloudflare R2 (иконки `pub-…r2.dev`, тайлы карт, приватный бакет бэкапов `cta-db-backups`).
- **Резерв ПОГАШЕН:** Vercel-проект на паузе, облачный Supabase (`swcjyvztljokdycpviio`) УДАЛЁН (холодный архив в R2 `archive/`), обе PRO-подписки сняты + карты отвязаны. Автономность — 100%.

## Деплой
- `git push origin main` (репо `moemnenieafk/privetdizraptor`). **Авто-деплой по вебхуку ОТКЛЮЧЁН** (порт 8000 закрыт firewall'ом) → деплой командой: `ssh -i <key> root@201.51.20.217 /root/cta-deploy.sh` (триггерит Coolify-деплой через localhost-API).
- `next build` **не ходит в БД** (guard в `src/db/index.ts`). DB-страница/GET-роут → `force-dynamic` или `generateStaticParams: []`, иначе деплой падает.
- Билд webpack'ом (`next build --webpack`), НЕ turbopack.

## Доступ к БД (§4.11/§4.13)
- Прод-рантайм: внутренняя docker-сеть `cta-db-forward:5432` (socat-форвардер → `supabase-db`).
- Локальный dev: SSH-туннель — **`bash ~/cta-provision/dev.sh`** (`.env.local`→`127.0.0.1:5432`). Нет туннеля → 500 на DB-страницах (это норма, не баг кода).
- Кэш: горячие ридеры на `memoTTL` (in-memory, `src/lib/server-cache.ts`).

## Безопасность (харденинг 2026-08-29/30)
- **Порт БД 5432 — ЗАКРЫТ** снаружи (нет docker-publish; рантайм внутр. сетью). Не открывать, `DATABASE_URL` на публичный IP не возвращать.
- **SSH — только по ключу** (`PasswordAuthentication no`, root `prohibit-password`, fail2ban).
- **Timeweb-firewall** `cta-prod-fw` (белый список): вход TCP 22/80/443; выход TCP/UDP+TCP6/UDP6 все порты. Прочее вход закрыто → **8000 (админка Coolify), 6001, 5432, 10050 — недоступны снаружи**. Админка Coolify — через SSH-туннель (`ssh -N -L 8000:localhost:8000`).
- SSL Cloudflare Full (strict); origin-cert wildcard `*.cta.quest` (CF Origin CA) на Traefik.
- **www→apex** — CF Redirect Rule (301, путь+query сохр.).
- Урок: Timeweb-firewall фильтрует, ЕСЛИ порт НЕ в разрешающем списке (docker-published порты host-iptables/ufw НЕ ловят).

## Надёжность
- Все контейнеры `restart: unless-stopped` (переживают крэш/ребут).
- **Мониторинг** `/root/cta-monitor/check.sh` (крон */5): сайт+БД, app/db-контейнеры, путь app→forward→БД, диск, свежесть бэкапа. Алерты в **Telegram** (@cta_bug_parcer_bot, chat 648355197) — только на смену состояния.
- **Бэкапы** nightly (03:30 UTC) полным дампом `supabase_admin` → R2 `cta-db-backups/daily/` (14д) + weekly (90д). **Restore-drill** `/root/cta-backup/restore-test.sh` (ежемесячно) — проверка восстановимости.
- **Ретеншен** append-таблиц: `price_history` 2г / `silent_changes` 1г (`/root/cta-cron/prune-history.sh`, еженедельно).
- Крон синков — host-crontab root'а (`/root/cta-cron/`), не Coolify.

## Доступы (детали — в канон-заметке, секреты НЕ здесь)
- SSH-ключ `C:\Users\vadim\.ssh\cta_hetzner_ed25519`; инфра-скрипты/токены `C:\Users\vadim\cta-provision\`.
- Coolify UI `http://201.51.20.217:8000` (только через SSH-туннель). Аккаунты-владельцы НЕ основной V4DYA (GitHub `moemnenieafk`, Cloudflare `Moemnenieyt@gmail.com`).

## Остаточные опц.-хвосты (некритичны)
- `docker login` на VPS против редких Docker Hub 429 (нужны Docker Hub креды; app-редеплои тянут с GHCR, не Docker Hub → низкий приоритет).
- Удалить мёртвое OAuth-приложение `ctamedia` в Twitch (живое `a3mky` уже чистое).
