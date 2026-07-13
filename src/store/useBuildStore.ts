import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emptyBuild, setMod, type BuildNode } from '@/lib/weapon-build';

/**
 * Конструктор сборок оружия. Хранит ЧЕРНОВИК (то, что сейчас крутится в /add) и
 * СПИСОК сохранённых сборок. Про тир подписки стор НЕ знает — он чистый; гейт живёт
 * в useBuildQuota + <Paywall feature="weapon_builds"> и дублируется на сервере
 * при облачном сохранении (клиентский лимит — UX, не защита).
 *
 * Дерево — BuildNode из lib/weapon-build (та же форма, что уедет в weapon_builds.tree),
 * поэтому облачный синк потом идёт напрямую, без конвертации (паттерн ProgressSync).
 */

export interface SavedBuild {
  id: string;
  name: string;
  baseItemId: string;
  tree: BuildNode;
  /** Свободная метка: «мета», «бюджет», «Оружейник ч.7»… */
  purpose: string;
  createdAt: number;
  updatedAt: number;
  /** Опубликована ли в community (слаг проставляет сервер после POST). */
  publicSlug: string | null;
}

interface BuildStore {
  /** Текущий черновик конструктора. null — база ещё не выбрана. */
  draft: BuildNode | null;
  /** id редактируемой сохранённой сборки (null — новая). */
  editingId: string | null;
  /** Стек для undo (только внутри сессии, в persist не уезжает). */
  history: BuildNode[];
  saved: SavedBuild[];

  startBuild: (baseItemId: string) => void;
  /** path — цепочка slotNameId от корня до родителя слота. itemId=null → снять модуль. */
  putMod: (path: string[], slotNameId: string, itemId: string | null) => void;
  undo: () => void;
  clearDraft: () => void;

  /** Сохраняет черновик. Возвращает id или null, если черновика нет. */
  saveDraft: (name: string, purpose?: string) => string | null;
  loadBuild: (id: string) => void;
  duplicateBuild: (id: string) => string | null;
  renameBuild: (id: string, name: string) => void;
  removeBuild: (id: string) => void;
  markPublished: (id: string, slug: string) => void;
}

const HISTORY_LIMIT = 30;

const uid = (): string =>
  `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const useBuildStore = create<BuildStore>()(
  persist(
    (set, get) => ({
      draft: null,
      editingId: null,
      history: [],
      saved: [],

      startBuild: (baseItemId) =>
        set({ draft: emptyBuild(baseItemId), editingId: null, history: [] }),

      putMod: (path, slotNameId, itemId) =>
        set((s) => {
          if (!s.draft) return s;
          return {
            draft: setMod(s.draft, path, slotNameId, itemId),
            history: [...s.history, s.draft].slice(-HISTORY_LIMIT),
          };
        }),

      undo: () =>
        set((s) => {
          const prev = s.history[s.history.length - 1];
          if (!prev) return s;
          return { draft: prev, history: s.history.slice(0, -1) };
        }),

      clearDraft: () => set({ draft: null, editingId: null, history: [] }),

      saveDraft: (name, purpose = '') => {
        const { draft, editingId, saved } = get();
        if (!draft) return null;
        const now = Date.now();

        if (editingId) {
          set({
            saved: saved.map((b) =>
              b.id === editingId
                ? { ...b, name, purpose, tree: draft, baseItemId: draft.itemId, updatedAt: now }
                : b,
            ),
          });
          return editingId;
        }

        const id = uid();
        set({
          saved: [
            ...saved,
            {
              id,
              name,
              purpose,
              baseItemId: draft.itemId,
              tree: draft,
              createdAt: now,
              updatedAt: now,
              publicSlug: null,
            },
          ],
          editingId: id,
        });
        return id;
      },

      loadBuild: (id) =>
        set((s) => {
          const b = s.saved.find((x) => x.id === id);
          if (!b) return s;
          return { draft: b.tree, editingId: b.id, history: [] };
        }),

      duplicateBuild: (id) => {
        const { saved } = get();
        const src = saved.find((b) => b.id === id);
        if (!src) return null;
        const now = Date.now();
        const copy: SavedBuild = {
          ...src,
          id: uid(),
          name: `${src.name} (копия)`,
          createdAt: now,
          updatedAt: now,
          publicSlug: null,
        };
        set({ saved: [...saved, copy] });
        return copy.id;
      },

      renameBuild: (id, name) =>
        set((s) => ({
          saved: s.saved.map((b) => (b.id === id ? { ...b, name, updatedAt: Date.now() } : b)),
        })),

      removeBuild: (id) =>
        set((s) => ({
          saved: s.saved.filter((b) => b.id !== id),
          editingId: s.editingId === id ? null : s.editingId,
        })),

      markPublished: (id, slug) =>
        set((s) => ({
          saved: s.saved.map((b) => (b.id === id ? { ...b, publicSlug: slug } : b)),
        })),
    }),
    {
      name: 'cta-weapon-builds',
      // history в persist не тащим — undo живёт только внутри сессии конструктора.
      partialize: (s) => ({ draft: s.draft, editingId: s.editingId, saved: s.saved }),
    },
  ),
);