import { create } from 'zustand';
import type { TierId } from '@/data/subscription-tiers';

// Тир — серверная истина (таблица `subscriptions`), поэтому НЕ persist:
// закешированный премиум локально был бы дырой. Хук наполняет стор из БД.
interface SubscriptionState {
  tier: TierId;
  loading: boolean;
  /** id юзера, для которого загружен tier (дедуп фетчей между компонентами). */
  userId: string | null;
  setResult: (userId: string | null, tier: TierId) => void;
  setLoading: (loading: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'free',
  loading: true,
  userId: null,
  setResult: (userId, tier) => set({ userId, tier, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
