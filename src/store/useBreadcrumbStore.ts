import { create } from 'zustand';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbState {
  dynamicCrumbs: BreadcrumbItem[];
  setDynamicCrumbs: (crumbs: BreadcrumbItem[]) => void;
  clearDynamicCrumbs: () => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  dynamicCrumbs: [],
  setDynamicCrumbs: (crumbs) => set({ dynamicCrumbs: crumbs }),
  clearDynamicCrumbs: () => set({ dynamicCrumbs: [] }),
}));
