import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerManualOverrides } from '@/types/eft-player';

/**
 * Ручные оверрайды профиля (Слой C, спека player-profile-persistence). Уровни, введённые БЕЗ
 * загрузки JSON: навык (id→уровень), станция убежища (type→уровень), трейдер (slug→лояльность).
 *
 * Семантика — last-write-wins по полю (спека): ручной ввод = явный патч, при отображении бьёт
 * загруженное (мерж-хелперы в lib/tarkov/player-view-merge). Трейдеры вдобавок пишутся write-through
 * в usePlayerStore.traderLevels (их читает весь сайт — бартеры/квест-мапа), здесь — зеркало для
 * серверного снапшота.
 *
 * Аноним: живёт в localStorage (persist). Залогинен: снапшот с этими оверрайдами уезжает на сервер
 * (buildSnapshot тянет отсюда), при входе гидрируется обратно (applySnapshot).
 */
interface ManualProfileStore {
  skills: Record<string, number>;
  hideout: Record<string, number>;
  traders: Record<string, number>;
  _hasHydrated: boolean;

  setSkill: (id: string, level: number) => void;
  setHideout: (type: number, level: number) => void;
  setTrader: (slug: string, level: number) => void;
  /** Массовая заливка (гидрация из серверного снапшота). Заменяет, не мержит. */
  replaceAll: (overrides: PlayerManualOverrides) => void;
  reset: () => void;
}

/** Записать/убрать ключ: level<=0 удаляет запись (нет оверрайда — падаем на загруженное). */
function put(map: Record<string, number>, key: string, level: number): Record<string, number> {
  const next = { ...map };
  if (level > 0) next[key] = level;
  else delete next[key];
  return next;
}

export const useManualProfileStore = create<ManualProfileStore>()(
  persist(
    (set) => ({
      skills: {},
      hideout: {},
      traders: {},
      _hasHydrated: false,

      setSkill: (id, level) => set((s) => ({ skills: put(s.skills, id, level) })),
      setHideout: (type, level) => set((s) => ({ hideout: put(s.hideout, String(type), level) })),
      // Трейдер: уровень лояльности 1..4 всегда есть (нет «нулевого» трейдера) → пишем как есть.
      setTrader: (slug, level) => set((s) => ({ traders: { ...s.traders, [slug]: level } })),

      replaceAll: (o) =>
        set({ skills: { ...o.skills }, hideout: { ...o.hideout }, traders: { ...o.traders } }),
      reset: () => set({ skills: {}, hideout: {}, traders: {} }),
    }),
    {
      name: 'manual-profile-storage',
      partialize: (s) => ({ skills: s.skills, hideout: s.hideout, traders: s.traders }),
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
    },
  ),
);

/** Текущий снимок оверрайдов (для buildSnapshot). Пустые группы отбрасываем — снапшот компактнее. */
export function currentManualOverrides(): PlayerManualOverrides | undefined {
  const { skills, hideout, traders } = useManualProfileStore.getState();
  const out: PlayerManualOverrides = {};
  if (Object.keys(skills).length) out.skills = skills;
  if (Object.keys(hideout).length) out.hideout = hideout;
  if (Object.keys(traders).length) out.traders = traders;
  return Object.keys(out).length ? out : undefined;
}
