'use client';

import { useModalAnimation } from '@/hooks/useModalAnimation';

interface ProfileResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export function ProfileResetModal({ isOpen, onClose, onConfirm }: ProfileResetModalProps) {
  const { isRendered, isVisible, modalRef } = useModalAnimation(isOpen, onClose);

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-110 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        ref={modalRef}
        className={`flex w-87 flex-col shadow-[0_0_40px_rgba(194,67,57,0.15)] transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
      >

        {/* ШАПКА */}
        <div className="relative flex h-7 w-full items-center justify-start gap-1 rounded-t bg-danger">
          <div className="flex h-7 w-7 items-center justify-center p-1.5">
            <div className="h-full w-full icon-mask icon-eft-profile-reset text-zinc-100" />
          </div>
          <div className="text-sm font-blender-medium leading-4 text-zinc-100">Подтверждение сброса профиля игрока</div>

          <button onClick={onClose} className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-80 focus:outline-none">
            <div className="flex h-3 w-4 items-center justify-center rounded-xs bg-danger-dim">
              <div className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
            </div>
          </button>
        </div>

        {/* ТЕЛО */}
        <div className="relative flex w-full flex-col items-center justify-start overflow-hidden rounded-b border border-danger bg-(--color-base) p-8 text-center">

          <div className="pointer-events-none absolute left-0 top-0 h-20 w-full bg-[url('/images/warning-bg-pannel-top.svg')] bg-cover bg-top bg-no-repeat opacity-50" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-[url('/images/warning-bg-pannel-bottom.svg')] bg-cover bg-bottom bg-no-repeat opacity-50" />

          <div className="relative z-10 flex w-full flex-col items-center gap-6">

            <div className="flex flex-col items-center gap-1.5">
              <div className="h-10 w-10 icon-mask icon-eft-profile-warning text-danger" />
              <div className="text-xl font-blender-medium uppercase tracking-wide text-danger">ВНИМАНИЕ</div>
            </div>

            <div className="flex flex-col gap-4 text-left text-sm font-blender-medium leading-4 text-text-secondary">
              <p>Вы действительно хотите осуществить сброс прогресса профиля игрока?</p>
              <p>
                Вы подтверждаете, что абсолютно <span className="font-bold text-zinc-100">ВЕСЬ</span> прогресс завершенных заданий, найденных предметов, построенных модулей убежища, уровень ЧВК, уровни торговцев будут сброшены по умолчанию.
              </p>
              <p className="text-text-muted">Выполняется автоматически после вайпа</p>
            </div>

            <div className="mt-2 flex w-full gap-5">
              <button
                onClick={() => { if (onConfirm) onConfirm(); onClose(); }}
                className="flex h-9 flex-1 items-center justify-center rounded border border-danger bg-transparent text-base font-blender-medium text-danger transition-colors hover:bg-danger hover:text-(--color-base) focus:outline-none"
              >
                ДА
              </button>
              <button
                onClick={onClose}
                className="flex h-9 flex-1 items-center justify-center rounded border border-danger bg-transparent text-base font-blender-medium text-danger transition-colors hover:bg-danger hover:text-(--color-base) focus:outline-none"
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
