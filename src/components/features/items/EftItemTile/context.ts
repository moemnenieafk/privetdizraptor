import { createContext, useContext } from 'react';
import type { EftItemData } from './types';

export interface EftItemTileContextValue {
  item: EftItemData;
  categorySlug?: string;
}

export const EftItemTileContext = createContext<EftItemTileContextValue | null>(null);

export function useEftItemTile(): EftItemTileContextValue {
  const ctx = useContext(EftItemTileContext);
  if (!ctx) throw new Error('EftItemTile sub-component used outside EftItemTile.Root');
  return ctx;
}
