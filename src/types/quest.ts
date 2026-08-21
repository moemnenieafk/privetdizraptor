export type QuestNodeStatus = 'locked' | 'active' | 'completed';
export type QuestLockReason = 'level' | 'prereq' | 'both';

export interface TaskObjective {
  id: string;
  type: string;
  __typename?: string;
  description: string;
  optional: boolean;
  // TaskObjectiveItem
  item?: { id: string; name: string; shortName: string; image512pxLink: string };
  count?: number;
  foundInRaid?: boolean;
  // any-of цель («N любых из списка»): item — представитель, acceptedItems — весь список
  // принимаемых вариантов (для «групповой строки» трекера «Важные предметы»).
  anyOf?: boolean;
  acceptedItems?: Array<{ id: string; name: string; shortName: string; image512pxLink: string }>;
  // TaskObjectiveShoot
  target?: string;
  distance?: { value: number; compareMethod: string } | null;
  // TaskObjectivePlayerLevel
  playerLevel?: number;
  // TaskObjectiveTraderLevel
  trader?: { name: string; normalizedName: string };
  level?: number;
  // TaskObjectiveMark
  markerItem?: { id: string; name: string; shortName: string; image512pxLink: string };
  // TaskObjectiveBasic (location/visit)
  maps?: Array<{ id: string; name: string; normalizedName: string }> | null;
}

// Discriminated types for type-safe narrowing (UX-3+)
export interface TaskObjectiveItem extends TaskObjective {
  __typename: 'TaskObjectiveItem';
  // Дамп 1.1.0.0: у части item-целей (уникальные квест-предметы) предмет не резолвится
  // в каталог → item отсутствует. Тип повторяет реальность данных (§4.4); читатели гардят.
  item?: { id: string; name: string; shortName: string; image512pxLink: string };
  count: number;
  foundInRaid: boolean;
}

export interface TaskObjectiveTraderLevel extends TaskObjective {
  __typename: 'TaskObjectiveTraderLevel';
  trader: { name: string; normalizedName: string };
  level: number;
}

export interface FinishRewards {
  items: Array<{
    item: { id: string; name: string; shortName: string; image512pxLink: string };
    count: number;
  }>;
  traderStanding: Array<{
    trader: { name: string; normalizedName: string };
    standing: number;
  }>;
}

export interface TaskTrader {
  name: string;
  normalizedName: string;
  imageLink?: string;
}

export interface TaskRaw {
  id: string;
  name: string;
  normalizedName: string;
  kappaRequired: boolean;
  lightkeeperRequired: boolean;
  minPlayerLevel: number;
  experience: number;
  trader: TaskTrader;
  taskRequirements: Array<{ task: { id: string; name: string } }>;
  objectives: TaskObjective[];
  finishRewards: FinishRewards;
  /** Уровень лояльности торговца (1..4) — ось раскладки questmap 1.1.0.0. Из dump-quests. */
  ulTier?: number;
  /** УЛ-гейт: требования лояльности торговца (где размечено tarkov.dev). */
  traderRequirements?: Array<{
    trader: { id: string; name: string; normalizedName: string };
    requirementType: string | null;
    compareMethod: string;
    level: number | null;
  }>;
  requiredPrestige?: string | null;
  factionName?: string | null;
}

// Бартер, открываемый квестом (для бейджа ноды + списка в QuestDetail).
export interface QuestBarterRewardItem {
  id: string;
  name: string;
  shortName: string;
  normalizedName?: string;
  image: string;
  count: number;
}
export interface QuestBarterLite {
  id: string;
  trader: { name: string; normalizedName: string };
  level: number;
  rewardItems: QuestBarterRewardItem[];
}

export interface QuestNodeData {
  task: TaskRaw;
  status: QuestNodeStatus;
  lockReason?: QuestLockReason;
  levelGap?: number;
  dimmed?: boolean;
  isSubgraphTarget?: boolean;
  isMapTarget?: boolean;
  freshlyUnlocked?: boolean;
  traderLevels?: Record<string, number>;
  chainRole?: 'ancestor' | 'descendant' | 'self' | null;
  pinned?: boolean;
  barterCount?: number; // сколько бартеров открывает квест
  /** Иконка-маска шапки вместо фото трейдера (карты сюжетных историй: убежище/барахолка/локации). */
  headerIconClass?: string;
  /** Спрятать кнопку-скрепку (карты сюжетных историй — пины не поддерживаются). */
  hidePin?: boolean;
  onToggle: (id: string) => void;
  onSelect: (task: TaskRaw) => void;
  onHover: (id: string | null) => void;
  onPin: (id: string) => void;
}
