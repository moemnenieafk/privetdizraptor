'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePlayerStore } from '@/store/usePlayerStore';
import { EDITIONS } from '@/components/layout/header-modules/ProfileSettingsModal';

export function AccountHeader() {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const ed = EDITIONS[activeProfile?.edition ?? 'Standard'];
  const isPro = activeProfile?.edition === 'TUE' || activeProfile?.edition === 'EOD';

  return (
    <header className="sticky top-0 z-50 flex h-[60px] w-full shrink-0 items-center justify-between border-b border-lines-hover bg-base px-4 lg:px-8">

      {/* Left: Logo */}
      <Link href="/" className="shrink-0 transition-all hover:brightness-125 focus-visible:outline-none">
        <Image src="/images/cta-logo.svg" alt="ЦТА" width={130} height={46} priority />
      </Link>

      {/* Center: Icon + Title */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-lines-hover bg-card-menu">
          <div className="h-4 w-4 icon-mask icon-account_profile_icon bg-(--primary)" />
        </div>
        <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary lg:text-base">
          Аккаунт Центр
        </span>
      </div>

      {/* Right: Username + PRO + Avatar button */}
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className={`font-blender-medium text-sm leading-none ${ed.color}`}>
            {activeProfile?.nickname ?? '—'}
          </span>
          {isPro && (
            <div className="flex items-center gap-1 rounded border border-tactical-amber/30 bg-tactical-amber/10 px-1.5 py-0.5">
              <div className="h-3 w-3 icon-mask icon-account_prostatus_icon bg-tactical-amber" />
              <span className="font-mono text-[9px] font-bold tracking-wider text-tactical-amber">PRO</span>
            </div>
          )}
        </div>

        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded border border-lines-hover bg-card-menu transition-all hover:border-(--primary) focus-visible:outline-none"
          title="На главную"
        >
          <div className="h-4 w-4 icon-mask icon-account_profile_icon bg-text-muted" />
        </Link>
      </div>

    </header>
  );
}
