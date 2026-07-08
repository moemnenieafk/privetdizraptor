import { create } from 'zustand';
import type { ScreenshotPose } from '@/lib/eft-screenshot';

export type TrackerStatus =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'tracking' }
  | { kind: 'error'; message: string }
  | { kind: 'unsupported' };

interface TrackingState {
  active: boolean;
  follow: boolean;
  status: TrackerStatus;
  pose: ScreenshotPose | null;
  setActive: (v: boolean) => void;
  setFollow: (v: boolean) => void;
  setStatus: (s: TrackerStatus) => void;
  setPose: (p: ScreenshotPose | null) => void;
  reset: () => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  active: false,
  follow: true,
  status: { kind: 'idle' },
  pose: null,
  setActive: (active) => set({ active }),
  setFollow: (follow) => set({ follow }),
  setStatus: (status) => set({ status }),
  setPose: (pose) => set({ pose }),
  reset: () => set({ active: false, status: { kind: 'idle' }, pose: null }),
}));
