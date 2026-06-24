'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, DoorOpen, Footprints, Layers, MapPin, ScrollText, TriangleAlert } from 'lucide-react';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { traderImg } from '@/lib/trader-utils';
import type { MapViewMarker } from './map-types';
import type { MapViewerApi, MapQuestLite } from './map-frame-types';

const LEGEND = [
  { key: 'extract', label: 'Выходы' },
  { key: 'spawn', label: 'Спавны' },
  { key: 'transit', label: 'Переходы' },
  { key: 'hazard', label: 'Опасности' },
];

const ROW = 'flex w-full items-center gap-2 px-3 h-9 border-b border-lines-hover hover:bg-card-menu transition-colors text-left shrink-0';
const ROW_TEXT = 'text-xs font-blender-book text-text-primary leading-tight truncate';

function MarkerIcon({ type }: { type: string }) {
  const cls = 'w-3.5 h-3.5 shrink-0 text-(--primary)';
  if (type === 'extract') return <DoorOpen className={cls} />;
  if (type === 'spawn') return <Footprints className={cls} />;
  if (type === 'transit') return <ArrowLeftRight className={cls} />;
  return <TriangleAlert className={cls} />;
}

function GroupLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 h-6 bg-card-menu/60 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
      {icon} {text}
    </div>
  );
}

interface Props {
  markers: MapViewMarker[];
  quests: MapQuestLite[];
  apiRef: React.RefObject<MapViewerApi | null>;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

/** Единый поиск по карте: маркеры + квесты локации + легенда (переключение слоёв). */
export function MapSearch({ markers, quests, apiRef, anchorRef, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 12, left: r.left });
  }, [anchorRef]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();
  const active = q.length >= 2;

  const markerHits = active
    ? markers.filter((m) => m.label && m.position && m.label.toLowerCase().includes(q)).slice(0, 40)
    : [];
  const questHits = active ? quests.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 40) : [];
  const legendHits = active ? LEGEND.filter((l) => l.label.toLowerCase().includes(q)) : [];
  const total = markerHits.length + questHits.length + legendHits.length;

  if (!pos) return null;

  const selectMarker = (m: MapViewMarker) => {
    if (m.position) apiRef.current?.flyTo({ x: m.position.x, z: m.position.z }, 4);
    onClose();
  };

  return (
    <div className="animate-quest-search fixed z-200" style={{ top: pos.top, left: pos.left }}>
      <div className="flex items-center gap-2 px-3 w-87 h-9 bg-(--color-darkbase) border border-(--primary) rounded-xs">
        <span className="icon-mask icon-eft-search-icon w-3.5 h-3.5 text-(--primary) shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: маркеры, квесты, легенда..."
          className="bg-transparent outline-none w-full text-xs font-blender-book text-text-primary placeholder:text-text-secondary"
        />
      </div>

      {active && (
        <div className="mt-2 w-87 max-h-87 bg-(--color-darkbase) border border-lines-hover rounded-xs overflow-y-auto scrollbar-hidden">
          {total === 0 ? (
            <div className="flex items-center px-3 h-9 text-xs text-text-secondary">Ничего не найдено</div>
          ) : (
            <>
              {markerHits.length > 0 && <GroupLabel icon={<MapPin className="w-3 h-3" />} text="Маркеры" />}
              {markerHits.map((m) => (
                <button key={m.id} onClick={() => selectMarker(m)} className={ROW}>
                  <MarkerIcon type={m.type} />
                  <span className={ROW_TEXT}><HighlightedText text={m.label!} query={query} /></span>
                </button>
              ))}

              {questHits.length > 0 && <GroupLabel icon={<ScrollText className="w-3 h-3" />} text="Квесты" />}
              {questHits.map((t) => (
                <Link key={t.id} href={`/eft/questmap?quest=${t.id}`} onClick={onClose} className={ROW}>
                  <img src={traderImg(t.trader)} alt="" width={20} height={20} className="rounded-xs shrink-0 opacity-70" />
                  <span className={ROW_TEXT}><HighlightedText text={t.name} query={query} /></span>
                </Link>
              ))}

              {legendHits.length > 0 && <GroupLabel icon={<Layers className="w-3 h-3" />} text="Легенда" />}
              {legendHits.map((l) => (
                <button key={l.key} onClick={() => apiRef.current?.toggleLayer(l.key)} className={ROW}>
                  <MarkerIcon type={l.key} />
                  <span className={ROW_TEXT}>{l.label} <span className="text-text-secondary">— переключить слой</span></span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
