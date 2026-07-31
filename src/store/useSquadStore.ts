import { create } from 'zustand';

// Эфемерное состояние сквада-шаринга позиции (§ решение squad-position-sharing).
// Ничего не пишется в БД: members приходят из Realtime presence, poses — из broadcast.

export interface SquadMember {
  /** presence-key участника (стабильный self-id). */
  id: string;
  nick: string;
  color: string;
  /** карта, которую участник сейчас смотрит (для скоупа точек). */
  mapId: string;
  mapName: string;
  /** транслирует ли позицию (активен трекер) — иначе только в ростере. */
  broadcasting: boolean;
}

export interface SquadPose {
  x: number;
  z: number;
  y: number;
  yaw: number;
  floor: number;
  ts: number;
}

/** Палитра меток тиммейтов — различимые NIGHTFALL-дружественные оттенки. */
export const SQUAD_COLORS = ['#00CDAB', '#E68E25', '#C26BE0', '#5FB85B', '#4AA3E0', '#E5484D', '#E0C24A', '#8FA3B0'];

// Алфавит кода комнаты без визуально похожих (0/O, 1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genRoomCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i += 1) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

function genMemberId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
function initialNick(): string {
  if (typeof localStorage !== 'undefined') return localStorage.getItem('cta-squad-nick') ?? '';
  return '';
}

interface SquadState {
  roomCode: string | null;
  /** стабильный self-id (на сессию) = presence-key. */
  memberId: string;
  nickname: string;
  color: string;
  /** участники из presence (включая себя). */
  members: SquadMember[];
  /** memberId → поза (без себя: broadcast приходит с self:false). */
  poses: Record<string, SquadPose>;
  setNickname: (v: string) => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  setMembers: (m: SquadMember[]) => void;
  setPose: (id: string, p: SquadPose) => void;
}

export const useSquadStore = create<SquadState>((set) => ({
  roomCode: null,
  memberId: genMemberId(),
  nickname: initialNick(),
  color: SQUAD_COLORS[0],
  members: [],
  poses: {},
  setNickname: (nickname) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('cta-squad-nick', nickname);
    set({ nickname });
  },
  joinRoom: (code) =>
    set(() => ({
      roomCode: code.trim().toUpperCase(),
      // цвет — случайный из палитры при входе (коллизии редки на 5 человек; фронт довяжем).
      color: SQUAD_COLORS[Math.floor(Math.random() * SQUAD_COLORS.length)],
      members: [],
      poses: {},
    })),
  leaveRoom: () => set({ roomCode: null, members: [], poses: {} }),
  setMembers: (members) =>
    set((s) => {
      // подчистить позы вышедших участников
      const alive = new Set(members.map((m) => m.id));
      const poses = Object.fromEntries(Object.entries(s.poses).filter(([id]) => alive.has(id)));
      return { members, poses };
    }),
  setPose: (id, p) => set((s) => ({ poses: { ...s.poses, [id]: p } })),
}));
