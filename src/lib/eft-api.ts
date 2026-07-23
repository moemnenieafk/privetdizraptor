// Каталожные типы EFT + статические квест-данные для questmap/поиска.
// §4.11: рантайм НЕ ходит в api.tarkov.dev — каталог читается из нашей Supabase,
// квесты берутся из локального `EFT_QUESTS`. Прежние рантайм-фетчи каталога/патронов
// (getAllEftItems/getAmmoData → GraphQL) удалены как мёртвый код + латентная мина §4.11.
import type { TaskRaw } from '@/types/quest';
import { EFT_QUESTS } from '@/data/quests';

export interface EftItem {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  types: string[];
  width: number;
  height: number;
  gridImageLink: string;
  lastLowPrice: number | null;
  backgroundColor?: string;
  bsgCategoryId?: string;
}

export async function getQuestMapTasks(): Promise<TaskRaw[]> {
  return EFT_QUESTS;
}
