import type { TaskRaw } from '@/types/quest';
import rawData from './eft-quests.json';

export const EFT_QUESTS = rawData as unknown as TaskRaw[];
