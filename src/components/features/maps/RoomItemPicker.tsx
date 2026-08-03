'use client';

// Пикер предметов открытия меченой комнаты: быстрые чипы из лут-таблицы комнаты + ПОИСК по всему
// каталогу (предмет мог выпасть вне топ-таблицы). Поиск — searchEftItemsAction (наше зеркало, без
// рантайм-вызова api.tarkov.dev), дебаунс 250мс — паттерн как в EditorialMarkerCard. Владеет выбором,
// сообщает родителю актуальный список id через onChange. Общий для формы юзера (RoomOpenSubmit) и
// модератора (RoomOpenAdder). Решение: docs/decisions/done/marked-rooms.md (трекер v2.1 — поиск вне лут-таблицы).
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { searchEftItemsAction } from '@/actions/search-actions';
import type { SearchItemResult } from '@/types/search';

export interface PickerItem {
  itemId: string;
  name: string;
  shortName: string;
  backgroundColor: string | null;
}

interface Props {
  /** Предметы лут-таблицы комнаты (быстрые чипы, частый случай). */
  lootItems: PickerItem[];
  /** Актуальный список выбранных id — для сабмита в родителе. */
  onChange: (selectedIds: string[]) => void;
  /** Предвыбранные предметы (модерация: то, что заявил подавший) — читаются только на маунт. */
  initial?: PickerItem[];
}

/** Чип-иконка предмета (общий вид с лут-таблицей: фон-редкость + инсет-тень + кольцо выбора). */
function ItemChip({ item, on, onClick }: { item: PickerItem; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.name}
      aria-pressed={on}
      className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xs border transition-colors ${
        on ? 'border-(--primary)' : 'border-lines-hover hover:border-(--primary)/40'
      }`}
      style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor ?? undefined) }}
    >
      <div className="absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
      <img src={itemIconUrl(item.itemId)} alt="" className="absolute inset-0 z-10 h-full w-full object-contain p-0.5" />
      {on && <div className="absolute inset-0 z-20 rounded-xs ring-1 ring-inset ring-(--primary)" />}
    </button>
  );
}

export function RoomItemPicker({ lootItems, onChange, initial }: Props) {
  // Множество id лут-таблицы — стабильно на маунт (сброс = remount по key в родителе).
  const lootIds = useRef<Set<string>>(new Set(lootItems.map((i) => i.itemId)));
  // Преднаполнение (модерация): выбранные id + чипы для тех предвыбранных, что вне лут-таблицы.
  const [sel, setSel] = useState<Set<string>>(() => new Set((initial ?? []).map((i) => i.itemId)));
  const [extra, setExtra] = useState<PickerItem[]>(() => {
    const ids = new Set(lootItems.map((i) => i.itemId)); // локальный набор — реф нельзя читать в рендере
    return (initial ?? []).filter((i) => !ids.has(i.itemId));
  });
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchItemResult[]>([]);

  // Родитель получает актуальный выбор (эффект, не сайд-эффект в updater'е). onChange стабилен (useState-сеттер).
  useEffect(() => {
    onChange([...sel]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const toggle = (id: string) => {
    const wasOn = sel.has(id);
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    // Снятый off-table чип (не из лут-таблицы) убираем из ряда — незачем держать невыбранный.
    if (wasOn && !lootIds.current.has(id)) setExtra((e) => e.filter((x) => x.itemId !== id));
  };

  const addHit = (h: SearchItemResult) => {
    if (!lootIds.current.has(h.id) && !extra.some((x) => x.itemId === h.id)) {
      setExtra((e) => [...e, { itemId: h.id, name: h.name, shortName: h.shortName, backgroundColor: h.backgroundColor ?? null }]);
    }
    setSel((s) => new Set(s).add(h.id));
    setQ('');
    setHits([]);
  };

  // Дебаунс-поиск по каталогу (зеркало). ≥2 символов; alive-флаг гасит гонку ответов.
  useEffect(() => {
    const query = q.trim();
    let alive = true;
    const t = setTimeout(async () => {
      const res = query.length < 2 ? [] : await searchEftItemsAction(query);
      if (alive) setHits(res);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {lootItems.map((it) => (
          <ItemChip key={it.itemId} item={it} on={sel.has(it.itemId)} onClick={() => toggle(it.itemId)} />
        ))}
        {extra.map((it) => (
          <ItemChip key={it.itemId} item={it} on={sel.has(it.itemId)} onClick={() => toggle(it.itemId)} />
        ))}
      </div>

      {/* Поиск по всему каталогу — предмет мог выпасть вне топ-таблицы комнаты */}
      <div className="relative">
        <div className="flex h-9 items-center gap-2 rounded-xs border border-lines-hover bg-(--color-base) px-2.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Найти предмет вне таблицы…"
            className="w-full bg-transparent font-blender-book text-xs text-text-primary outline-none placeholder:text-text-muted"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Очистить" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {hits.length > 0 && (
          <div className="absolute top-10 right-0 left-0 z-20 max-h-48 overflow-y-auto rounded-xs border border-lines-hover bg-(--color-base) shadow-xl">
            {hits.map((it) => {
              const on = sel.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addHit(it)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-card-menu"
                >
                  <span className="relative size-6 shrink-0 overflow-hidden rounded-xs border-[0.5px] border-lines-hover">
                    <span className="absolute inset-0 bg-(--color-darkbase)" />
                    <span className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(it.backgroundColor) }} />
                    <img src={itemIconUrl(it.id)} alt="" className="absolute inset-0 size-full object-contain p-0.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">{it.name}</span>
                  {on && <span className="shrink-0 font-blender-medium text-[10px] uppercase text-(--primary)">выбрано</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
