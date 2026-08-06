'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MAP_ICON_CSS as MAP_CSS, MAP_ORDER } from '@/data/map-icons';

interface MapEntry {
  id: string;
  name: string;
  normalizedName: string;
}

const STATIC_MAPS: MapEntry[] = [{ id: 'terminal', name: 'Терминал', normalizedName: 'terminal' }];

interface Props {
  maps: MapEntry[];
  selectedMaps: Set<string>;
  onMap: (id: string) => void;
}

/**
 * Плавающий док фильтра локаций снизу-по-центру (паттерн MapBossDock карт): подложка card-menu +
 * border + rounded-top (как трейдер-плашка), иконки 24×24, авто-ширина, шеврон-сворачивание.
 * По умолчанию развёрнут (фильтр локаций — частое действие). Десктоп-only (`hidden lg:block`).
 */
export function QuestLocationDock({ maps, selectedMaps, onMap }: Props) {
  const [open, setOpen] = useState(true);

  const dynamicIds = new Set(maps.map((m) => m.normalizedName));
  const allMaps = [...maps, ...STATIC_MAPS.filter((s) => !dynamicIds.has(s.normalizedName))]
    .filter((m) => !m.normalizedName.includes('night') && !m.name.includes('21+'))
    .sort((a, b) => {
      const ai = MAP_ORDER.indexOf(a.normalizedName);
      const bi = MAP_ORDER.indexOf(b.normalizedName);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  const mapBtn = (id: string, active: boolean, node: React.ReactNode, title: string) => (
    <button
      key={id}
      type="button"
      onClick={() => onMap(id)}
      title={title}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition-all ${active ? 'text-(--primary)' : 'text-text-secondary hover:text-(--primary)'}`}
      style={{ opacity: selectedMaps.size > 0 && !active ? 0.35 : 1 }}
    >
      {node}
    </button>
  );

  return (
    <div className="absolute bottom-0 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
      <div className="flex flex-col overflow-hidden rounded-t-lg border border-lines-hover bg-card-menu backdrop-blur-sm">
        {/* Ряд локаций — сворачивается вниз (grid-rows 1fr↔0fr) */}
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="flex h-12 items-center gap-2 px-5">
              {allMaps.map((m) => {
                const active = selectedMaps.has(m.id);
                const iconCls = MAP_CSS[m.normalizedName];
                return mapBtn(
                  m.id,
                  active,
                  iconCls
                    ? <span className={`icon-mask ${iconCls} h-6 w-6`} />
                    : <span className="font-blender-medium text-type-caption uppercase leading-none">{m.name.slice(0, 3)}</span>,
                  m.name,
                );
              })}
              {mapBtn('end-of-line', selectedMaps.has('end-of-line'), <span className="icon-mask icon-eft-end-of-line-map-icon h-6 w-6" />, 'Конец пути')}
            </div>
          </div>
        </div>

        {/* Шеврон-переключатель */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Свернуть локации' : 'Локации'}
          className={`flex h-6 items-center justify-center gap-1.5 text-text-muted transition-colors hover:bg-lines-hover hover:text-(--primary) ${open ? 'border-t border-lines-hover' : ''}`}
        >
          {!open && <span className="font-blender-medium text-type-micro uppercase tracking-widest">Локации</span>}
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </div>
  );
}
