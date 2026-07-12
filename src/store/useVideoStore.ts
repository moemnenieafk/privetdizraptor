import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoProgress } from '@/types/video';
import type { ViewMode } from '@/components/ui/DataViewToggle';
import { isWatched } from '@/lib/video-utils';

/**
 * Клиентское состояние раздела «Видео». Персонализация без БД:
 * прогресс просмотра, «Продолжить просмотр», избранное и режим выдачи
 * живут в localStorage — profile-free, работает и без авторизации.
 *
 *   • progress  — позиция по каждому видео (пишет VideoPlayer раз в ~5с);
 *   • favorites — «Смотреть позже», ряд на хабе раздела;
 *   • view      — grid (плитка) / table (плотный список) для мобилки.
 */

/** Не пишем прогресс на первых секундах — случайный тап не должен плодить записи. */
const MIN_TRACK_POSITION = 15;
/** Верхняя граница истории «Продолжить», чтобы localStorage не пух. */
const MAX_PROGRESS_ENTRIES = 200;

interface VideoStore {
  progress: Record<string, VideoProgress>;
  favorites: string[];
  view: ViewMode;

  setProgress: (videoId: string, position: number, duration: number) => void;
  clearProgress: (videoId: string) => void;
  resetAllProgress: () => void;

  toggleFavorite: (videoId: string) => void;
  setView: (view: ViewMode) => void;
}

/** Обрезает историю до MAX_PROGRESS_ENTRIES самых свежих записей. */
function trim(entries: Record<string, VideoProgress>): Record<string, VideoProgress> {
  const keys = Object.keys(entries);
  if (keys.length <= MAX_PROGRESS_ENTRIES) return entries;

  const kept = keys
    .sort((a, b) => entries[b].updatedAt - entries[a].updatedAt)
    .slice(0, MAX_PROGRESS_ENTRIES);

  return kept.reduce<Record<string, VideoProgress>>((acc, key) => {
    acc[key] = entries[key];
    return acc;
  }, {});
}

export const useVideoStore = create<VideoStore>()(
  persist(
    (set) => ({
      progress: {},
      favorites: [],
      view: 'grid',

      setProgress: (videoId, position, duration) =>
        set((state) => {
          if (duration <= 0 || position < MIN_TRACK_POSITION) return state;

          const prev = state.progress[videoId];
          // Досмотренное не «откатываем» перемоткой в начало на повторном просмотре.
          if (prev?.completed && !isWatched(position, duration)) return state;

          const next: VideoProgress = {
            position: Math.floor(position),
            duration: Math.floor(duration),
            completed: isWatched(position, duration),
            updatedAt: Date.now(),
          };
          return { progress: trim({ ...state.progress, [videoId]: next }) };
        }),

      clearProgress: (videoId) =>
        set((state) => {
          if (!state.progress[videoId]) return state;
          const next = { ...state.progress };
          delete next[videoId];
          return { progress: next };
        }),

      resetAllProgress: () => set({ progress: {} }),

      toggleFavorite: (videoId) =>
        set((state) => ({
          favorites: state.favorites.includes(videoId)
            ? state.favorites.filter((id) => id !== videoId)
            : [videoId, ...state.favorites],
        })),

      setView: (view) => set({ view }),
    }),
    {
      name: 'cta-video-progress',
      version: 1,
      // Селективный partialize не нужен — всё поле стора персистится осознанно.
    },
  ),
);

/* ─────────────────── селекторы ─────────────────── */

/**
 * ID видео для ряда «Продолжить просмотр»: начатые, но не досмотренные,
 * свежие сверху. Компонент сам матчит их с каталогом.
 */
export function selectContinueIds(state: VideoStore): string[] {
  return Object.entries(state.progress)
    .filter(([, p]) => !p.completed && p.position >= MIN_TRACK_POSITION)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .map(([id]) => id);
}