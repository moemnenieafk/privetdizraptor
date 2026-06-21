import type { Metadata } from 'next';
import ViewportBand from './ViewportBand';

export const metadata: Metadata = {
  title: 'Typography & Grid Styleguide — CTA',
  robots: { index: false },
};

const TYPE_SCALE = [
  { token: '--type-display',  cls: 'text-type-display',  clamp: 'clamp(2rem, 1.6rem + 2vw, 4rem)',              range: '32 → 64px', sample: 'NIGHTFALL' },
  { token: '--type-h1',       cls: 'text-type-h1',       clamp: 'clamp(1.75rem, 1.5rem + 1.25vw, 3rem)',        range: '28 → 48px', sample: 'Extraction' },
  { token: '--type-h2',       cls: 'text-type-h2',       clamp: 'clamp(1.5rem, 1.35rem + 0.75vw, 2.25rem)',     range: '24 → 36px', sample: 'Tactical Items' },
  { token: '--type-h3',       cls: 'text-type-h3',       clamp: 'clamp(1.25rem, 1.15rem + 0.5vw, 1.75rem)',     range: '20 → 28px', sample: 'Category Overview' },
  { token: '--type-h4',       cls: 'text-type-h4',       clamp: 'clamp(1.125rem, 1.075rem + 0.25vw, 1.375rem)', range: '18 → 22px', sample: 'Section Header' },
  { token: '--type-body-lg',  cls: 'text-type-body-lg',  clamp: 'clamp(1rem, 0.95rem + 0.25vw, 1.25rem)',       range: '16 → 20px', sample: 'Lead paragraph text for important info.' },
  { token: '--type-body',     cls: 'text-type-body',     clamp: 'clamp(0.9375rem, 0.9rem + 0.125vw, 1.0625rem)',range: '15 → 17px', sample: 'Standard body copy and descriptions.' },
  { token: '--type-label',    cls: 'text-type-label',    clamp: 'clamp(0.8125rem, 0.7875rem + 0.125vw, 0.9375rem)', range: '13 → 15px', sample: 'Label, chip, table header' },
  { token: '--type-caption',  cls: 'text-type-caption',  clamp: 'clamp(0.75rem, 0.725rem + 0.125vw, 0.875rem)', range: '12 → 14px', sample: 'Meta, footnote, tooltip' },
] as const;

const SPAN_WIDTHS = [160, 348, 536, 724, 912, 1100];

export default function StyleguidePage() {
  return (
    <div className="min-h-screen bg-(--color-darkbase) text-text-primary py-16 px-6">
      <div style={{ maxWidth: 'var(--grid-max)', marginInline: 'auto' }} className="flex flex-col gap-20">

        {/* Header */}
        <header className="border-b border-lines-hover pb-8">
          <p className="text-type-caption font-blender-medium uppercase tracking-widest text-(--primary) mb-2">CTA / Styleguide</p>
          <h1 className="text-type-display font-blender-medium uppercase tracking-widest text-text-primary mb-1">
            Typography & Grid
          </h1>
          <p className="text-type-body text-text-secondary font-blender-book">
            Эталонная страница шкалы. Масштабируй браузер — все размеры адаптируются через clamp().
          </p>
        </header>

        {/* Live viewport counter */}
        <section>
          <h2 className="text-type-h4 font-blender-medium uppercase tracking-widest text-(--primary) mb-6">
            Viewport / Band
          </h2>
          <div className="bg-(--color-card-menu) border border-lines-hover rounded p-8">
            <ViewportBand />
            <div className="mt-6 grid grid-cols-5 gap-3 text-center">
              {(['mobile','tablet','desktop','2K','4K'] as const).map(b => (
                <div key={b} className="border border-lines-hover rounded p-3">
                  <p className="text-type-label font-blender-medium uppercase tracking-widest text-(--primary)">{b}</p>
                  <p className="text-type-caption font-blender-book text-text-muted mt-1">
                    {b === 'mobile' ? '< 768' : b === 'tablet' ? '768–1279' : b === 'desktop' ? '1280–1919' : b === '2K' ? '1920–3839' : '≥ 3840'}px
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Type scale */}
        <section>
          <h2 className="text-type-h4 font-blender-medium uppercase tracking-widest text-(--primary) mb-6">
            Type Scale
          </h2>
          <div className="flex flex-col gap-1">
            {/* Table header */}
            <div className="grid grid-cols-[140px_220px_80px_1fr] gap-4 px-4 py-2 border-b border-lines-hover">
              {['Token', 'Clamp formula', 'Range', 'Live sample'].map(h => (
                <span key={h} className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{h}</span>
              ))}
            </div>

            {TYPE_SCALE.map(({ token, cls, clamp, range, sample }) => (
              <div
                key={token}
                className="grid grid-cols-[140px_220px_80px_1fr] gap-4 items-center px-4 py-4 border-b border-lines-hover/40 hover:bg-(--color-card-menu) transition-colors"
              >
                <code className="text-type-caption font-blender-book text-(--primary) break-all">{token}</code>
                <code className="text-type-caption font-blender-book text-text-muted break-all leading-relaxed">{clamp}</code>
                <span className="text-type-caption font-blender-book text-text-secondary tabular-nums">{range}</span>
                <span className={`${cls} font-blender-medium uppercase tracking-wide text-text-primary leading-tight`}>
                  {sample}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Grid visualizer */}
        <section>
          <h2 className="text-type-h4 font-blender-medium uppercase tracking-widest text-(--primary) mb-2">
            Content Grid
          </h2>
          <p className="text-type-body-lg font-blender-book text-text-secondary mb-6">
            <span className="text-(--primary)">1100px</span> max-width ·{' '}
            <span className="text-(--primary)">6</span> колонок ·{' '}
            <span className="text-(--primary)">28px</span> gutter ·{' '}
            col-width = <span className="text-(--primary)">160px</span>
          </p>

          {/* 6-column visual */}
          <div className="bg-(--color-card-menu) border border-lines-hover rounded p-6 mb-8 overflow-x-auto">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, var(--grid-col))',
                gap: 'var(--grid-gap)',
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded flex flex-col items-center justify-center gap-1"
                  style={{ background: `color-mix(in srgb, var(--primary) ${20 + i * 10}%, transparent)` }}
                >
                  <span className="text-type-label font-blender-medium uppercase text-(--primary)">Col {i + 1}</span>
                  <span className="text-type-caption font-blender-book text-text-secondary">160px</span>
                </div>
              ))}
            </div>
          </div>

          {/* Span widths table */}
          <h3 className="text-type-h4 font-blender-medium uppercase tracking-widest text-text-secondary mb-4">
            Span Widths
          </h3>
          <div className="border border-lines-hover rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-lines-hover bg-(--color-card-menu)">
                  {['Span', 'Width', 'Use case'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SPAN_WIDTHS.map((w, i) => {
                  const useCase = ['Icon / badge', 'Card / tile', 'Sidebar panel', 'Article / main text', 'Wide content', 'Full container'][i];
                  return (
                    <tr key={w} className="border-b border-lines-hover/40 hover:bg-(--color-card-menu)/50 transition-colors">
                      <td className="px-4 py-3 text-type-label font-blender-medium text-(--primary)">{i + 1}</td>
                      <td className="px-4 py-3 text-type-body font-blender-medium text-text-primary tabular-nums">{w}px</td>
                      <td className="px-4 py-3 text-type-body font-blender-book text-text-secondary">{useCase}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer note */}
        <footer className="border-t border-lines-hover pt-6">
          <p className="text-type-caption font-blender-book text-text-muted">
            Root font-size: <code className="text-(--primary)">clamp(16px, 0.833vw, 28px)</code> — rem-значения масштабируются вместе с viewport на 2K/4K.
          </p>
        </footer>

      </div>
    </div>
  );
}
