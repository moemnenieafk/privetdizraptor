/**
 * Боссы EFT для раздела «Кодекс → Боссы».
 * Лор/мотивация — research-контент; HP по зонам — по данным tarkov.dev/сообщества
 * (заполнено там, где подтверждено; остальное уточняется при синхронизации).
 */

export type BossThreat = 'Низкая' | 'Средняя' | 'Высокая' | 'Экстрим';
export type LoreConfidence = 'rich' | 'sparse';

export interface BossHealthPart {
  part: string;
  hp: number;
}

export interface BossSpawn {
  map: string;
  chance?: string;
}

export interface Boss {
  slug: string;
  nameRu: string;
  nameEn: string;
  role: string;
  location: string;
  portrait: string;
  threat?: BossThreat;
  totalHp?: number;
  health?: BossHealthPart[];
  armor?: string;
  weapon?: string;
  followers?: string;
  spawns?: BossSpawn[];
  lore: string;
  motivation: string;
  loreConfidence?: LoreConfidence;
}
