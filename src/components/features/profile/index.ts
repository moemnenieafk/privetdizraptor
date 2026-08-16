// Тактический кит досье игрока (T01, фундамент). Волна 2 (T02/T03/T04) импортит отсюда.
// Компоненты — на NIGHTFALL + существующих keyframes; каждый несёт своё seed/пустое
// состояние (§4.5). Доменная логика standing — в @/lib/player-standing (не тут).

export { TacticalCard } from './TacticalCard';
export { DogTag, serviceNumberFrom } from './DogTag';
export { RankChevron } from './RankChevron';
export { ArchetypeBadge } from './ArchetypeBadge';
export { XpNotchBar } from './XpNotchBar';
export { CompetencyRadar, type RadarSpoke } from './CompetencyRadar';
export { RollUpCounter } from './RollUpCounter';
export { StatusLed, type OperatorStatus } from './StatusLed';
export { StandingPanel } from './StandingPanel';
export {
  usePlayerStandingSignals,
  type StandingServerSignals,
} from './usePlayerStandingSignals';
