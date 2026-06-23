-- Phase 4 — RLS для геометрии интерактивных карт (self-mirror tarkov.dev).
-- Запускать через `npm run db:sql` (после db:push). Не секретно: RLS + только чтение,
-- запись — кроном/CLI под owner-ролью (RLS обходит). Аналогично landing-rls.sql.

alter table public.map_assets enable row level security;
drop policy if exists "map_assets_read_all" on public.map_assets;
create policy "map_assets_read_all" on public.map_assets for select using (true);

alter table public.map_markers enable row level security;
drop policy if exists "map_markers_read_all" on public.map_markers;
create policy "map_markers_read_all" on public.map_markers for select using (true);
