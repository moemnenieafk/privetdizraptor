// DDL таблицы подписок как массив стейтментов — накатывается роутом
// /api/cron/migrate-subscriptions (db:push с телефона недоступен, паттерн weapons-ddl).
// Все стейтменты идемпотентны, повторный прогон безопасен.
//
// ⚠️ ВЛАДЕЛЕЦ ТАБЛИЦЫ — supabase_admin, а приложение ходит ролью postgres. Значит ЛЮБОЙ
// ALTER отсюда падает с `must be owner of table subscriptions` (42501): роль postgres
// НЕ входит в supabase_admin. То же у public.profiles; tiers/feature_gates/billing_events
// принадлежат postgres и меняются свободно.
// → Изменения СХЕМЫ этой таблицы применяются НЕ этим роутом, а суперпользователем внутри
//   контейнера БД. Рабочий рецепт (им накатана auto_renew 07.09.2026):
//     ssh -i ~/.ssh/cta_hetzner_ed25519 root@201.51.20.217 //       "docker exec supabase-db-ebq1smxegyuwgj6j7tgqhdjq //        psql -U supabase_admin -d postgres -c '<DDL>'"
//   (supabase_admin — единственный суперпользователь в этой инсталляции).
//   Роут остаётся полезен для policy/сида — там прав postgres хватает.
//   Найдено 06.09.2026 при добавлении auto_renew.
//
// Тир читают getSubscription (server) и fetchTier (client) через Supabase-клиент;
// пишет owner-роль (вебхук платёжки или ручной /api/cron/set-tier). До появления
// этой таблицы читалки деградировали в 'free' — то есть весь пэйвол был закрыт для
// всех. RLS: пользователь читает свою строку; апдейты — только серверной ролью.
export const SUBSCRIPTIONS_DDL: string[] = [
  `create table if not exists public.subscriptions (
    user_id     uuid primary key references public.profiles(id) on delete cascade,
    tier        text not null default 'free',
    valid_until timestamptz,
    source      text not null default 'manual',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  )`,

  // CHECK на tier СНЯТ: тиры уехали в таблицу public.tiers (динамические, админ
  // создаёт/переименовывает их без деплоя). CHECK по фикс-списку блокировал бы новый
  // тир → валидация slug теперь в коде (src/lib/gating/tiers.ts). Не воссоздаём.
  `alter table public.subscriptions drop constraint if exists subscriptions_tier_chk`,

  // Задел per-game: игровая подписка (scope_game_id != null) применима только к своей
  // игре, портальная (null) — везде. На запуске всегда null. Additive, идемпотентно.
  `alter table public.subscriptions
     add column if not exists scope_game_id uuid references public.games(id)`,

  // Автопродление. У ЮKassa рекуррент ИНИЦИИРУЕТ ПРОДАВЕЦ: следующее списание делаем мы
  // сами по сохранённому методу. Значит «отключить автопродление» — это НАШ флаг, по
  // которому мы просто не списываем дальше, а не запрос к провайдеру. Дефолт true:
  // подписка, оформленная как регулярная, продлевается, пока её не отключили.
  // Ручные выдачи (source='manual') не списываются вовсе — для них флаг не применяется.
  `alter table public.subscriptions
     add column if not exists auto_renew boolean not null default true`,

  `alter table public.subscriptions enable row level security`,
  `drop policy if exists subscriptions_read on public.subscriptions`,
  `create policy subscriptions_read on public.subscriptions
     for select to authenticated using (user_id = auth.uid())`,
];
