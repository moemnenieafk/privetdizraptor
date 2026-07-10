'use client';

import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  PRESTIGE_LEVELS,
  PRESTIGE_RESETS,
  PRESTIGE_KEEPS,
  PRESTIGE_SHOWCASE,
  PRESTIGE_COSMETICS,
} from '@/data/prestige';

/** Картинка со скелетоном (animate-pulse), без спиннеров. */
function ImgTile({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className="relative block size-full overflow-hidden">
      {!loaded && <span className="absolute inset-0 animate-pulse bg-lines-hover/40" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`size-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
      />
    </span>
  );
}

export function PrestigeClient() {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const active = profiles.find((p) => p.id === activeId);
  const playerLevel = Number(active?.level ?? 1);
  const playerPrestige = Number(active?.prestige ?? 0);

  const [tab, setTab] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const lvl = PRESTIGE_LEVELS[tab];
  const metCount = lvl.requirements.filter((r) => r.minLevel != null && playerLevel >= r.minLevel).length;
  const autoReqs = lvl.requirements.filter((r) => r.minLevel != null).length;

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox]);

  return (
    <div className="flex flex-col gap-6">
      {/* Навигация по престижам — эмблемы, snap-скролл на мобиле */}
      <nav className="-mx-4 px-4 xl:mx-0 xl:px-0">
        <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] xl:flex-wrap xl:overflow-visible">
          {PRESTIGE_LEVELS.map((p, i) => {
            const activeTab = tab === i;
            const current = playerPrestige === p.level;
            return (
              <li key={p.level} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => setTab(i)}
                  aria-pressed={activeTab}
                  className={`flex w-18 flex-col items-center gap-1 rounded-md border px-2 py-2 transition-colors sm:w-20 ${
                    activeTab
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]'
                      : 'border-lines-hover bg-card-menu hover:border-(--primary)/50'
                  }`}
                >
                  <span className={`relative size-11 sm:size-12 ${p.planned ? 'opacity-40 grayscale' : ''}`}>
                    <ImgTile src={`/icons/eft/prestige/prestige-${p.level}.webp`} alt={`Престиж ${p.level}`} />
                    {current && (
                      <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-(--primary) ring-2 ring-card-menu" />
                    )}
                  </span>
                  <span
                    className={`text-type-caption font-blender-medium uppercase tracking-widest ${
                      activeTab ? 'text-(--primary)' : 'text-text-secondary'
                    }`}
                  >
                    {p.level}{p.planned ? '*' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Showcase-рендеры активного набора */}
      <section>
        <h2 className="mb-3 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
          Витрина наград
        </h2>
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
          {PRESTIGE_SHOWCASE.map((src) => (
            <li
              key={src}
              className="relative aspect-square w-36 shrink-0 snap-center overflow-hidden rounded-md border border-lines-hover bg-card-menu sm:w-44"
            >
              <ImgTile src={src} alt="Награда престижа" />
            </li>
          ))}
        </ul>
      </section>

      {/* Требования / Награды */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-lines-hover bg-card-menu p-5">
          <h2 className="mb-4 text-lg font-blender-medium uppercase tracking-widest text-text-primary">
            Требования (Престиж {lvl.level})
          </h2>
          <ul className="flex flex-col gap-2.5">
            {lvl.requirements.map((req, i) => {
              const auto = req.minLevel != null;
              const met = auto && playerLevel >= (req.minLevel ?? 0);
              return (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-xs border text-type-caption ${
                      met ? 'border-success bg-success/15 text-success' : 'border-lines-hover text-text-muted'
                    }`}
                  >
                    {met ? '✓' : auto ? '✕' : '•'}
                  </span>
                  <span className="text-text-secondary font-blender-book">
                    {req.label}
                    {auto && <span className="ml-1 text-text-muted">(сейчас ур. {playerLevel})</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {autoReqs > 0 && (
            <p className="mt-4 text-type-caption uppercase tracking-widest text-text-muted">
              Авто-проверка по уровню: {metCount}/{autoReqs}
            </p>
          )}
        </section>

        <section className="rounded-md border border-lines-hover bg-card-menu p-5">
          <h2 className="mb-4 text-lg font-blender-medium uppercase tracking-widest text-text-primary">Награды</h2>
          <ul className="flex flex-col gap-2.5">
            {lvl.rewards.map((rw, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-text-secondary font-blender-book">
                <span className="text-(--primary)">🏅</span> {rw}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Косметика — сетка с лайтбоксом */}
      <section>
        <h2 className="mb-3 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
          Косметика престижей
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {PRESTIGE_COSMETICS.map((src) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setLightbox(src)}
                className="block aspect-[4/3] w-full overflow-hidden rounded-sm border border-lines-hover bg-card-menu transition-colors hover:border-(--primary)"
              >
                <ImgTile src={src} alt="Косметика престижа" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Сбрасывается / переносится */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border-l-2 border-danger bg-card-menu p-5">
          <h3 className="mb-3 text-type-caption font-blender-medium uppercase tracking-widest text-danger">Сбрасывается</h3>
          <ul className="flex flex-col gap-1.5">
            {PRESTIGE_RESETS.map((x) => (
              <li key={x} className="text-sm text-text-secondary font-blender-book">• {x}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border-l-2 border-success bg-card-menu p-5">
          <h3 className="mb-3 text-type-caption font-blender-medium uppercase tracking-widest text-success">Переносится</h3>
          <ul className="flex flex-col gap-1.5">
            {PRESTIGE_KEEPS.map((x) => (
              <li key={x} className="text-sm text-text-secondary font-blender-book">• {x}</li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-type-caption text-text-muted font-blender-book">
        ⚠ Точные числовые пороги (уровни навыков/убежища, суммы) меняются между патчами — сверяйтесь с актуальной
        версией перед престижем.
      </p>

      {/* Лайтбокс */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <span className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
          <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-md border border-(--primary) bg-card-menu p-4">
            <ImgTile src={lightbox} alt="Награда престижа" />
          </div>
        </div>
      )}
    </div>
  );
}
