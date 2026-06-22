'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Текущий пользователь Supabase (браузер). loading=true пока сессия не проверена. */
export function useUser(): { user: AuthUser | null; loading: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Не пересоздаём объект, если id/email не изменились — иначе TOKEN_REFRESHED
    // (раз в ~час) дёргает все эффекты на `user` и плодит лишние ре-синки.
    const sameUser = (prev: AuthUser | null, next: AuthUser | null) =>
      prev?.id === next?.id && prev?.email === next?.email;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const next = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
      setUser((prev) => (sameUser(prev, next) ? prev : next));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user
        ? { id: session.user.id, email: session.user.email ?? null }
        : null;
      setUser((prev) => (sameUser(prev, next) ? prev : next));
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
