// DDL таблицы `feature_gates` (маппинг «фича/раздел → мин. тир + поведение замка»)
// как массив идемпотентных стейтментов — накатывается роутом /api/cron/migrate-billing.
// Повторный прогон безопасен.
//
// Отсутствие строки → дефолт из GATE_REGISTRY (src/data/gate-registry.ts). Реестр в
// коде — источник имён и дефолтов (fail-safe), таблица — оверрайд, что живьём меняет
// админ из матрицы. behavior: lock (апселл) | hide (спрятать) | teaser. RLS: читают
// авторизованные (карта не секретна, но не для анона), пишет owner-роль.
export const FEATURE_GATES_DDL: string[] = [
  `create table if not exists public.feature_gates (
    feature_key text primary key,
    min_tier    text not null default 'free',
    behavior    text not null default 'lock',
    enabled     boolean not null default true,
    updated_by  uuid references public.profiles(id),
    updated_at  timestamptz not null default now()
  )`,

  `alter table public.feature_gates drop constraint if exists feature_gates_behavior_chk`,
  `alter table public.feature_gates
     add constraint feature_gates_behavior_chk check (behavior in ('lock', 'hide', 'teaser'))`,

  `alter table public.feature_gates enable row level security`,
  `drop policy if exists feature_gates_read on public.feature_gates`,
  `create policy feature_gates_read on public.feature_gates
     for select to authenticated using (true)`,
];
