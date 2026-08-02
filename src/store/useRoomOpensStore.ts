import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Личный счётчик открытий меченой комнаты (per-room, localStorage). Индивидуальный для пользователя —
// НЕ путать с общим счётчиком сообщества (totalOpens в трекере). Ключ записи — room.id.
interface RoomOpensState {
  counts: Record<string, number>;
  inc: (roomId: string) => void;
  dec: (roomId: string) => void;
  reset: (roomId: string) => void;
}

export const useRoomOpensStore = create<RoomOpensState>()(
  persist(
    (set) => ({
      counts: {},
      inc: (roomId) => set((s) => ({ counts: { ...s.counts, [roomId]: (s.counts[roomId] ?? 0) + 1 } })),
      dec: (roomId) => set((s) => ({ counts: { ...s.counts, [roomId]: Math.max(0, (s.counts[roomId] ?? 0) - 1) } })),
      reset: (roomId) => set((s) => ({ counts: { ...s.counts, [roomId]: 0 } })),
    }),
    { name: 'cta-room-opens' },
  ),
);
