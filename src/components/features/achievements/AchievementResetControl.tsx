'use client';

// Кнопка «Сброс достижений» + модалка подтверждения. Чистит ТОЛЬКО домен достижений:
// useAchievementStore.resetProgress() (completed + tracked). Облако для залогиненных
// обновит AchievementSync автоматически. Механика/стиль — общий ResetControl.
// Используется на странице достижений (ряд счётчика) и во вкладке «Трекинг».
import { useAchievementStore } from '@/store/useAchievementStore';
import { ResetControl } from '@/components/features/tracking/ResetControl';

export function AchievementResetControl() {
  const resetProgress = useAchievementStore((s) => s.resetProgress);

  return (
    <ResetControl
      buttonLabel="СБРОС ДОСТИЖЕНИЙ"
      buttonTitle="Сбросить прогресс достижений"
      modalTitle="Подтверждение сброса достижений"
      onConfirm={resetProgress}
    >
      <p>Вы действительно хотите сбросить прогресс достижений?</p>
      <p>
        Будут очищены отметки <span className="text-zinc-100">«выполнено»</span> и вотчлист{' '}
        <span className="text-zinc-100">«отслеживаю»</span> только раздела Достижений. Задания,
        бартеры и убежище не затрагиваются.
      </p>
      <p className="text-text-muted">Для залогиненных изменение синхронизируется с облаком</p>
    </ResetControl>
  );
}
