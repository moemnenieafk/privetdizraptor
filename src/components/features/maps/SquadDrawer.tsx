'use client';

// Правый drawer «Сквад» (шаринг позиции) — по образцу «Легенды»/«Удаления»: right-slide, h-14 шапка.
// Всё эфемерно: состояние в useSquadStore, канал — в useSquad (родитель). Здесь только вход/ростер.
import { Users, Copy, Check, LogOut, Radio } from 'lucide-react';
import { useState } from 'react';
import { useSquadStore, genRoomCode } from '@/store/useSquadStore';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** id текущей карты — чтобы бейджить тиммейтов на другой карте. */
  currentMapId: string;
  /** код из ?squad=… для префилла поля входа. */
  initialCode?: string;
}

export function SquadDrawer({ open, onOpenChange, currentMapId, initialCode }: Props) {
  const roomCode = useSquadStore((s) => s.roomCode);
  const nickname = useSquadStore((s) => s.nickname);
  const members = useSquadStore((s) => s.members);
  const memberId = useSquadStore((s) => s.memberId);
  const setNickname = useSquadStore((s) => s.setNickname);
  const joinRoom = useSquadStore((s) => s.joinRoom);
  const leaveRoom = useSquadStore((s) => s.leaveRoom);

  const [codeInput, setCodeInput] = useState(initialCode ?? '');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const inviteLink =
    roomCode && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?squad=${roomCode}`
      : '';

  const copy = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard недоступен — молча */
    }
  };

  return (
    <div
      className={`absolute top-0 right-0 z-[540] flex h-full w-87 flex-col border-l border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Шапка 56px */}
      <div className="flex h-14 shrink-0 items-center justify-end gap-3 px-3.5">
        <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">Отряд</span>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Закрыть отряд"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-(--primary) bg-(--primary) text-(--color-base)"
        >
          <Users className="h-5 w-5" />
        </button>
      </div>

      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {/* Ник — всегда */}
        <label className="flex flex-col gap-1">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">Твой ник</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Позывной"
            maxLength={20}
            className="h-9 rounded-xs border-[0.5px] border-lines-hover bg-card-menu px-2.5 font-blender-book text-sm text-text-primary outline-none focus:border-(--primary)"
          />
        </label>

        {!roomCode ? (
          <>
            <button
              type="button"
              onClick={() => joinRoom(genRoomCode())}
              disabled={!nickname.trim()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xs bg-(--primary) font-blender-medium text-sm uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Users className="h-4 w-4" /> Создать отряд
            </button>
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-lines-hover" />
              <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">или</span>
              <span className="h-px flex-1 bg-lines-hover" />
            </div>
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="КОД"
                maxLength={6}
                className="h-9 min-w-0 flex-1 rounded-xs border-[0.5px] border-lines-hover bg-card-menu px-2.5 font-blender-medium text-sm uppercase tracking-widest text-text-primary outline-none focus:border-(--primary)"
              />
              <button
                type="button"
                onClick={() => codeInput.trim() && joinRoom(codeInput)}
                disabled={!codeInput.trim() || !nickname.trim()}
                className="h-9 shrink-0 rounded-xs border-[0.5px] border-lines-hover px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-40"
              >
                Войти
              </button>
            </div>
            <p className="text-center font-blender-book text-xs leading-relaxed text-text-muted">
              Введи ник, создай отряд и скинь код тиммейтам — или войди в готовый по коду.
            </p>
          </>
        ) : (
          <>
            {/* Код комнаты */}
            <div className="flex flex-col gap-1">
              <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">Код комнаты</span>
              <div className="flex gap-2">
                <div className="flex h-9 min-w-0 flex-1 items-center rounded-xs border-[0.5px] border-lines-hover bg-card-menu px-2.5 font-blender-medium text-base uppercase tracking-widest text-(--primary)">
                  {roomCode}
                </div>
                <button
                  type="button"
                  onClick={() => copy(roomCode, 'code')}
                  title="Копировать код"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xs border-[0.5px] border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                >
                  {copied === 'code' ? <Check className="h-4 w-4 text-nvg-green" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Инвайт-ссылка */}
            <button
              type="button"
              onClick={() => copy(inviteLink, 'link')}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-xs border-[0.5px] border-lines-hover font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              {copied === 'link' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-nvg-green" /> Скопировано
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Копировать ссылку-инвайт
                </>
              )}
            </button>

            {/* Ростер */}
            <div className="flex flex-col gap-1">
              <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">В отряде · {members.length}</span>
              {members.length === 0 ? (
                <p className="px-2 py-4 text-center font-blender-book text-xs text-text-muted">Подключаемся…</p>
              ) : (
                members.map((m) => {
                  const onOtherMap = m.mapId !== currentMapId;
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-xs border-[0.5px] border-lines-hover px-2.5 py-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-primary">
                        {m.nick || 'Боец'}
                        {m.id === memberId && ' (ты)'}
                      </span>
                      {onOtherMap ? (
                        <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-wide text-text-muted">{m.mapName}</span>
                      ) : m.broadcasting ? (
                        <Radio className="h-3.5 w-3.5 shrink-0 text-nvg-green" />
                      ) : (
                        <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-wide text-text-muted">не в игре</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {roomCode && (
        <div className="shrink-0 border-t border-lines-hover p-3">
          <button
            type="button"
            onClick={leaveRoom}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xs border-[0.5px] border-danger/50 font-blender-medium text-sm uppercase tracking-widest text-danger transition-colors hover:border-danger hover:bg-danger-dim"
          >
            <LogOut className="h-4 w-4" /> Покинуть отряд
          </button>
        </div>
      )}
    </div>
  );
}
