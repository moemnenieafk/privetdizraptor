import { create } from 'zustand';
import type { BarterItemBase, BarterTrade, StashItem } from '@/types/barter';
import { findFirstFit } from '@/lib/stash-packing';

const STASH_COLS = 10;
const INITIAL_ROWS = 5;

interface BarterStore {
  stashCols: number;
  stashRows: number;
  items: StashItem[];
  selectedBarter: BarterTrade | null;
  addItem: (raw: BarterItemBase) => void;
  removeItem: (uid: string) => void;
  clearStash: () => void;
  selectBarter: (trade: BarterTrade) => void;
  clearBarter: () => void;
}

type PriceEntry = { price: number; priceRUB?: number | null; vendor: { normalizedName: string } };

function getBestSellRub(entries: PriceEntry[], excludeFlea = false): number | null {
  const filtered = excludeFlea
    ? entries.filter(e => e.vendor.normalizedName !== 'flea-market')
    : entries;
  const prices = filtered.map(e => e.priceRUB ?? e.price).filter((p): p is number => p > 0);
  return prices.length ? Math.max(...prices) : null;
}

function buildStashItem(raw: BarterItemBase, position: { col: number; row: number }): StashItem {
  const fleaEntry = raw.sellFor.find(e => e.vendor.normalizedName === 'flea-market');
  const fleaPrice = fleaEntry ? (fleaEntry.priceRUB ?? fleaEntry.price) : null;
  const bestTraderPriceRub = getBestSellRub(raw.sellFor, true);

  return {
    uid: crypto.randomUUID(),
    id: raw.id,
    name: raw.name,
    shortName: raw.shortName,
    image512pxLink: raw.image512pxLink,
    backgroundColor: raw.backgroundColor,
    width: raw.width,
    height: raw.height,
    col: position.col,
    row: position.row,
    fleaPrice,
    bestTraderPriceRub,
  };
}

function packItemsIntoStash(rawItems: BarterItemBase[]): { items: StashItem[]; stashRows: number } {
  let stashRows = INITIAL_ROWS;
  const items: StashItem[] = [];

  for (const raw of rawItems) {
    let position = findFirstFit(items, stashRows, STASH_COLS, raw.width, raw.height);
    while (!position) {
      stashRows += Math.max(raw.height, 1);
      position = findFirstFit(items, stashRows, STASH_COLS, raw.width, raw.height);
    }
    items.push(buildStashItem(raw, position));
  }

  return { items, stashRows };
}

export const useBarterStore = create<BarterStore>((set) => ({
  stashCols: STASH_COLS,
  stashRows: INITIAL_ROWS,
  items: [],
  selectedBarter: null,

  addItem: (raw) => {
    set((state) => {
      let { stashRows, items } = state;
      let position = findFirstFit(items, stashRows, STASH_COLS, raw.width, raw.height);
      while (!position) {
        stashRows += Math.max(raw.height, 1);
        position = findFirstFit(items, stashRows, STASH_COLS, raw.width, raw.height);
      }
      return { stashRows, items: [...items, buildStashItem(raw, position)] };
    });
  },

  removeItem: (uid) =>
    set((state) => ({ items: state.items.filter(i => i.uid !== uid) })),

  clearStash: () =>
    set({ items: [], stashRows: INITIAL_ROWS }),

  // Clears stash and fills it with the trade's required items in a single set() call
  selectBarter: (trade) => {
    set(() => {
      const rawItems = trade.requiredItems.flatMap(({ item, count }) =>
        Array.from({ length: Math.ceil(count) }, () => item)
      );
      const { items, stashRows } = packItemsIntoStash(rawItems);
      return { items, stashRows, selectedBarter: trade };
    });
  },

  clearBarter: () =>
    set({ selectedBarter: null, items: [], stashRows: INITIAL_ROWS }),
}));
