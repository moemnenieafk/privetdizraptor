import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoProgress } from '@/types/video';
import type { ViewMode } from '@/components/ui/DataViewToggle';
import { isWatched } from '@/lib/video-utils';

/**
 * Клиентское состояние раздела «Видео». Персонализация без БД:
 * прогресс просмотра, «Продолжить просмотр», избранное и режим выдачи
 * живут в localStorage — profile-free, работает и без авторизации.
 */

const MIN_TRACK_POSITION = 15;
const MAX_PROGRESS_ENTRIES = 200;

export type ProgressMap = Record<string, VideoProgress>;

interface VideoStore {
  progress: ProgressMap;
  favorites: string[];
  view: ViewMode;

  setProgress: (videoId: string, position: number, duration: number) => void;
  clearProgress: (videoId: string) => void;
  resetAllProgress: () => void;

  toggleFavorite: (videoId: string) => void;
  setView: (view: ViewMode) => void;
}

function trim(entries: ProgressMap): ProgressMap {
  const keys = Object.keys(entries);
  if (keys.length <= MAX_PROGRESS_ENTRIES) return entries;

  return keys
    .sort((a, b) => entries[b].updatedAt - entries[a].updatedAt)
    .slice(0, MAX_PROGRESS_ENTRIES)
    .reduce<ProgressMap>((acc, key) => {
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
    { name: 'cta-video-progress', version: 1 },
  ),
);

/**
 * ВАЖНО: это НЕ zustand-селектор, а чистая функция над уже полученным объектом.
 *
 * Zustand v5 сидит на useSyncExternalStore и сравнивает результат селектора
 * по ССЫЛКЕ. Селектор, возвращающий свежий массив на каждый вызов, уводит React
 * в бесконечный ре-рендер («Maximum update depth exceeded») и убивает страницу.
 * Поэтому из стора всегда достаём стабильную ссылку (s.progress), а производные
 * массивы считаем через useMemo на стороне компонента.
 */
export function getContinueIds(progress: ProgressMap): string[] {
  return Object.entries(progress)
    .filter(([, p]) => !p.completed && p.position >= MIN_TRACK_POSITION)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .map(([id]) => id);
}