'use client';

// Обёртка Supabase Realtime-канала сквада: presence = ростер, broadcast = позы.
// Ничего в БД. Канал живёт, пока задан roomCode; при выходе/размонтировании — removeChannel.
import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useSquadStore, type SquadMember, type SquadPose } from '@/store/useSquadStore';

interface PresenceMeta {
  nick: string;
  color: string;
  mapId: string;
  mapName: string;
  broadcasting: boolean;
}

interface SquadOpts {
  /** карта, которую смотрит этот клиент (для скоупа точек). */
  mapId: string;
  mapName: string;
  /** своя поза из трекера без ts (null — трекер выключен); ts ставится при отправке. */
  selfPose: Omit<SquadPose, 'ts'> | null;
  /** транслируем ли позицию (трекер активен И мы в комнате). */
  broadcasting: boolean;
}

export function useSquad({ mapId, mapName, selfPose, broadcasting }: SquadOpts): void {
  const roomCode = useSquadStore((s) => s.roomCode);
  const memberId = useSquadStore((s) => s.memberId);
  const nickname = useSquadStore((s) => s.nickname);
  const color = useSquadStore((s) => s.color);
  const setMembers = useSquadStore((s) => s.setMembers);
  const setPose = useSquadStore((s) => s.setPose);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  // Свежие значения для колбэков subscribe/track без пересоздания канала.
  const metaRef = useRef<PresenceMeta>({ nick: nickname, color, mapId, mapName, broadcasting });
  const selfPoseRef = useRef<Omit<SquadPose, 'ts'> | null>(selfPose);
  const broadcastingRef = useRef(broadcasting);
  useEffect(() => {
    selfPoseRef.current = selfPose;
    broadcastingRef.current = broadcasting;
  });

  // Жизненный цикл канала — только по смене комнаты/идентити.
  useEffect(() => {
    if (!roomCode) return;
    const supabase = createClient();
    const channel = supabase.channel(`squad:${roomCode}`, {
      config: { presence: { key: memberId }, broadcast: { self: false } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const members: SquadMember[] = Object.entries(state).map(([id, metas]) => {
          const m = metas[0];
          return { id, nick: m.nick, color: m.color, mapId: m.mapId, mapName: m.mapName, broadcasting: m.broadcasting };
        });
        setMembers(members);
      })
      .on('broadcast', { event: 'pose' }, ({ payload }) => {
        const p = payload as { id: string; pose: SquadPose };
        if (p.id !== memberId) setPose(p.id, p.pose);
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        subscribedRef.current = true;
        void channel.track(metaRef.current);
        // отправить текущую позу сразу, если уже вещаем (иначе ждали бы след. скриншота)
        if (broadcastingRef.current && selfPoseRef.current) {
          void channel.send({ type: 'broadcast', event: 'pose', payload: { id: memberId, pose: { ...selfPoseRef.current, ts: Date.now() } } });
        }
      });
    channelRef.current = channel;
    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomCode, memberId, setMembers, setPose]);

  // Пере-track presence при смене ника/цвета/карты/флага вещания.
  useEffect(() => {
    metaRef.current = { nick: nickname, color, mapId, mapName, broadcasting };
    if (subscribedRef.current) void channelRef.current?.track(metaRef.current);
  }, [nickname, color, mapId, mapName, broadcasting]);

  // Транслировать свою позу при её смене (частота = скриншоты).
  useEffect(() => {
    if (!subscribedRef.current || !broadcasting || !selfPose) return;
    void channelRef.current?.send({ type: 'broadcast', event: 'pose', payload: { id: memberId, pose: { ...selfPose, ts: Date.now() } } });
  }, [selfPose, broadcasting, memberId]);
}
