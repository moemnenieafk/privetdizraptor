-- Защита НАШИХ кастомных карт (HD-тайлы, id-слаг, НЕ из tarkov.dev) от прюна таблицы `maps`.
-- Прод-крон sync-prices → syncEftLandingData → pruneStale(maps) удаляет строки не из свежего набора
-- tarkov.dev; `factory-hd` туда не входит, а FK `markers.map_id ON DELETE CASCADE` сносит все его метки.
-- Триггер BEFORE DELETE ТИХО отменяет удаление защищённых карт (RETURN NULL) — остальной прюн проходит
-- без ошибок. Заглушка до деплоя keep-фикса в landing.ts; после деплоя безвредна (landing уже не пытается
-- удалять factory-hd). Идемпотентно. НЕ ловит DROP TABLE (db:push --force пересоздаёт maps в обход
-- триггера → тогда `npm run seed:factory-hd`). Новую HD-карту дописывать в список id ниже.
create or replace function public.protect_custom_maps()
returns trigger
language plpgsql
as $$
begin
  if old.id in ('factory-hd') then
    return null; -- отмена удаления защищённой карты
  end if;
  return old;
end;
$$;

drop trigger if exists protect_custom_maps_del on public.maps;
create trigger protect_custom_maps_del
  before delete on public.maps
  for each row
  execute function public.protect_custom_maps();
