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
  item: { id: string; name: string; shortName: string; image512pxLink: string };
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
  onToggle: (id: string) => void;
  onForceComplete: (id: string) => void;
  onSelect: (task: TaskRaw) => void;
  onHover: (id: string | null) => void;
  onPin: (id: string) => void;
}
