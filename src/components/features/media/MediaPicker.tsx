'use client';

// Пикер изображения для форм редактора: модалка поверх формы с той же библиотекой.
// Выбор картинки не должен уводить редактора со страницы и терять несохранённый текст.
import { X } from 'lucide-react';
import { MediaLibrary } from './MediaLibrary';

interface Props {
  onPick: (url: string) => void;
  /** Bug 6: батч-выбор (режим «Выбрать») — добавить несколько картинок разом. */
  onPickMany?: (urls: string[]) => void;
  onClose: () => void;
}

export function MediaPicker({ onPick, onPickMany, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="my-8 w-full max-w-4xl rounded-sm border border-lines-hover bg-(--color-base) p-4">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-blender-medium text-base uppercase tracking-widest text-text-primary">
            Медиа-библиотека
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-11 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <MediaLibrary
          onPick={(url) => {
            onPick(url);
            onClose();
          }}
          onPickMany={
            onPickMany
              ? (urls) => {
                  onPickMany(urls);
                  onClose();
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
