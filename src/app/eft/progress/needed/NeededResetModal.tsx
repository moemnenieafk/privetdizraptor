'use client';

// Модалка-предупреждение общего сброса прогресса сбора (дизайн 1:1 с QuestResetModal).
import { useModalAnimation } from '@/hooks/useModalAnimation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function NeededResetModal({ isOpen, onClose, onConfirm }: Props) {
  const { isRendered, isVisible, modalRef } = useModalAnimation(isOpen, onClose);
  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-110 flex items-center justify-center bg-black/70
                  backdrop-blur-sm transition-opacity duration-300 ease-out
                  ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        ref={modalRef}
        className={`relative flex w-80 flex-col shadow-[0_0_40px_rgba(194,67,57,0.15)]
                    transition-all duration-300 ease-out
                    ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}
      >
        {/* HEADER */}
        <div className="relative flex h-7 w-full items-center gap-1 rounded-t bg-danger">
          <div className="flex h-7 w-7 items-center justify-center p-1.5">
            <div className="icon-mask icon-eft-profile-reset h-full w-full text-white" />
          </div>
          <span className="font-blender-medium text-xs uppercase tracking-widest text-white">
            Сброс прогресса сбора
          </span>
          <button
            onClick={onClose}
            className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-80"
          >
            <div className="flex h-3 w-4 items-center justify-center rounded-xs bg-danger-dim">
              <div className="icon-mask icon-eft-profile-btn-close h-2 w-2 text-white" />
            </div>
          </button>
        </div>

        {/* BODY */}
        <div className="relative flex w-full flex-col items-center overflow-hidden rounded-b border border-danger bg-(--color-base) px-8 py-6 text-center">
          <div className="pointer-events-none absolute left-0 top-0 h-20 w-full bg-[url('/images/warning-bg-pannel-top.svg')] bg-cover bg-top bg-no-repeat opacity-50" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-[url('/images/warning-bg-pannel-bottom.svg')] bg-cover bg-bottom bg-no-repeat opacity-50" />

          <div className="relative z-10 flex w-full flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-1.5">
              <div className="icon-mask icon-eft-profile-warning h-10 w-10 text-danger" />
              <div className="font-blender-medium text-base uppercase tracking-wide text-danger">ВНИМАНИЕ</div>
            </div>

            <div className="flex flex-col gap-3 text-left text-xs font-blender-medium leading-relaxed text-text-secondary">
              <p>Сбросить весь прогресс сбора важных предметов?</p>
              <p>
                Будут обнулены: <span className="text-text-primary">все собранные предметы</span> по заданиям и
                убежищу.
              </p>
              <p className="text-text-muted">
                Уровни убежища, схрон и выполненные задания останутся без изменений.
              </p>
            </div>

            <div className="mt-1 flex w-full gap-4">
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex h-9 flex-1 items-center justify-center rounded-xs border border-danger font-blender-medium text-xs uppercase tracking-widest text-danger transition-colors hover:bg-danger/10"
              >
                ДА
              </button>
              <button
                onClick={onClose}
                className="flex h-9 flex-1 items-center justify-center rounded-xs border border-lines-hover font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-text-primary"
              >
                НЕТ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
