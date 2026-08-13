'use client';

// cta-mapper — оркестратор UI: источник → прогон стадий → гейты. Скелетоны, не спиннеры (§8).
// Панели гейтов (S2/S5/контактный лист) — скаффолды: структура и провод есть, тяжёлая
// интерактивность (merge/split/inline-персист, ≤512px превью) помечена TODO.

import { useEffect } from 'react';
import { useMapperStore } from '@/store/useMapperStore';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/mapper/types';
import { SourcePicker } from './SourcePicker';
import { SegmentReview } from './SegmentReview';
import { SubjectReview } from './SubjectReview';
import { ContactSheet } from './ContactSheet';

const STAGE_LABEL: Record<PipelineStage, string> = {
  segment: 'S1 · Сегментация',
  vision: 'S4 · Типизация',
  cluster: 'S3 · Кластеризация',
  generate: 'S6 · Генерация',
  trace: 'S7 · Трассировка',
  assemble: 'S8 · Сборка',
};

export function MapperClient() {
  const { objects, running, log, error, billing, reload, runStage } = useMapperStore();

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 text-neutral-200">
      <header className="border-b border-neutral-800 pb-3">
        <h1 className="font-blender-medium text-xl uppercase tracking-widest">cta-mapper</h1>
        <p className="mt-1 text-xs text-neutral-500">
          растр → векторные объекты в токенах палитры → библиотека <code>&lt;symbol&gt;</code> для Figma · {objects.length} объектов
        </p>
      </header>

      <SourcePicker />

      <section className="space-y-2">
        <div className="font-blender-medium text-[10px] uppercase tracking-widest text-neutral-500">Конвейер</div>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => void runStage(s)}
              disabled={running !== null}
              className="rounded border border-neutral-700 px-3 py-2 text-xs transition enabled:hover:border-(--primary) disabled:opacity-40"
              style={running === s ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
            >
              {running === s ? '… ' : ''}
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">
          {billing ? '💳 ' : '⚠ '}
          {error}
          {billing && <div className="mt-1 text-red-400/70">Включите биллинг и пополните баланс в ai.studio/projects, затем повторите стадию.</div>}
        </div>
      )}

      <SegmentReview />
      <SubjectReview />
      <ContactSheet />

      {log.length > 0 && (
        <section className="space-y-1">
          <div className="font-blender-medium text-[10px] uppercase tracking-widest text-neutral-500">Журнал</div>
          <pre className="max-h-40 overflow-auto rounded bg-neutral-900/60 p-2 text-[11px] leading-relaxed text-neutral-400">{log.join('\n')}</pre>
        </section>
      )}
    </div>
  );
}
