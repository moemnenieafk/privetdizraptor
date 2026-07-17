'use client';

// «Вход через сервисы» в Аккаунт Центре: РЕАЛЬНЫЕ OAuth-идентичности (не ручные
// хендлы). Читаем через supabase.auth.getUserIdentities(), привязываем/отвязываем
// linkIdentity/unlinkIdentity. Привязка требует включённого «Manual linking» в
// Supabase; если выключено — показываем понятную ошибку, а не молчим.

import { useState, useEffect, useCallback } from 'react';
import { Link2, Unlink, Check, Loader2 } from 'lucide-react';
import type { UserIdentity } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { DiscordIcon, TwitchIcon } from '@/components/ui/BrandIcons';

type ProviderId = 'discord' | 'twitch';

const PROVIDERS: { id: ProviderId; name: string; color: string; Icon: typeof DiscordIcon }[] = [
  { id: 'discord', name: 'Discord', color: '#5865F2', Icon: DiscordIcon },
  { id: 'twitch', name: 'Twitch', color: '#9146FF', Icon: TwitchIcon },
];

export function OAuthLogins() {
  const supabase = createClient();
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      setError('Не удалось получить список входов');
      setIdentities([]);
      return;
    }
    setIdentities(data.identities);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const label = (id: ProviderId) => (id === 'discord' ? 'Discord' : 'Twitch');

  const link = async (id: ProviderId) => {
    setError(null);
    setBusy(id);
    const { error } = await supabase.auth.linkIdentity({
      provider: id,
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (error) {
      setBusy(null);
      setError(
        /disabled|manual linking/i.test(error.message)
          ? 'Привязка входов отключена в Supabase (Auth → Manual linking)'
          : `Не удалось привязать ${label(id)}`,
      );
    }
    // успех → браузер редиректит на провайдера, вернётся на /account
  };

  const unlink = async (id: ProviderId, identity: UserIdentity) => {
    if (!identities || identities.length < 2) {
      setError('Нельзя отвязать единственный способ входа — сначала задайте пароль или привяжите другой сервис');
      return;
    }
    setError(null);
    setBusy(id);
    const { error } = await supabase.auth.unlinkIdentity(identity);
    setBusy(null);
    if (error) setError(`Не удалось отвязать ${label(id)}. Попробуйте позже.`);
    else await load();
  };

  const loading = identities === null;

  return (
    <div className="rounded border border-lines-hover bg-card-menu px-6 py-5">
      <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
        Вход через сервисы
      </h2>
      <p className="mt-1 font-blender-book text-xs text-text-secondary">
        Подключите Discord или Twitch, чтобы входить в один клик.
      </p>

      {error && <p className="mt-3 font-blender-book text-xs text-danger">{error}</p>}

      <div className="mt-4 flex flex-col">
        {PROVIDERS.map(({ id, name, color, Icon }) => {
          const identity = identities?.find((i) => i.provider === id) ?? null;
          const isBusy = busy === id;
          return (
            <div
              key={id}
              className="flex items-center gap-4 border-t border-lines-hover py-4 first:border-t-0"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${color}1a`, color }}
              >
                <Icon size={18} />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
                  {name}
                </span>
                {loading ? (
                  <span className="mt-1 h-3.5 w-24 animate-pulse rounded bg-lines-hover" />
                ) : identity ? (
                  <span className="flex items-center gap-1 font-blender-book text-sm text-text-secondary">
                    <Check size={12} style={{ color: 'var(--color-success)' }} />
                    Подключён
                  </span>
                ) : (
                  <span className="font-blender-book text-sm text-text-secondary">Не подключён</span>
                )}
              </div>

              {!loading &&
                (identity ? (
                  <button
                    type="button"
                    onClick={() => unlink(id, identity)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 rounded border border-lines-hover px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-danger hover:text-danger disabled:opacity-40"
                  >
                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                    Отвязать
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => link(id)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 rounded border px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest transition-colors disabled:opacity-40"
                    style={{ color, borderColor: `${color}80` }}
                  >
                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                    Привязать
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
