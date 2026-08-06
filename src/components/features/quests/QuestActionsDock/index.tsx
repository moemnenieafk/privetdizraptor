'use client';

import { useRef } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';

interface Props {
  onExport: () => void;
  onImport: (file: File) => void;
  onResetProgress: () => void;
}

const btnCls = 'flex h-9 w-9 items-center justify-center rounded border bg-card-menu backdrop-blur-sm transition-colors';

/** Плавающий док действий снизу-справа (десктоп): импорт · экспорт · сброс прогресса. */
export function QuestActionsDock({ onExport, onImport, onResetProgress }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="absolute bottom-3.5 right-3.5 z-20 hidden items-center gap-2 lg:flex">
      <button onClick={() => fileInputRef.current?.click()} title="Импорт прогресса" className={`${btnCls} border-lines-hover text-text-secondary hover:border-(--primary)/40 hover:text-(--primary)`}>
        <Upload className="h-4 w-4" />
      </button>
      <button onClick={onExport} title="Экспорт прогресса" className={`${btnCls} border-lines-hover text-text-secondary hover:border-(--primary)/40 hover:text-(--primary)`}>
        <Download className="h-4 w-4" />
      </button>
      <button onClick={onResetProgress} title="Сбросить прогресс заданий" className={`${btnCls} border-danger/60 text-danger/60 hover:border-danger hover:bg-danger/10 hover:text-danger`}>
        <RotateCcw className="h-4 w-4" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) { onImport(f); e.currentTarget.value = ''; } }}
      />
    </div>
  );
}
