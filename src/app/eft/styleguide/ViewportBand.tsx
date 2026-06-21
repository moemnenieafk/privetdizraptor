'use client';

import { useEffect, useState } from 'react';

type Band = 'mobile' | 'tablet' | 'desktop' | '2K' | '4K';

function getBand(w: number): Band {
  if (w < 768) return 'mobile';
  if (w < 1280) return 'tablet';
  if (w < 1920) return 'desktop';
  if (w < 3840) return '2K';
  return '4K';
}

const BAND_COLOR: Record<Band, string> = {
  mobile:  'text-mode-pve',
  tablet:  'text-accent-frago',
  desktop: 'text-tactical-amber',
  '2K':    'text-(--primary)',
  '4K':    'text-nvg-green',
};

export default function ViewportBand() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const band = getBand(width);

  return (
    <div className="flex items-baseline gap-4 font-blender-medium">
      <span className="text-type-h2 text-text-primary tabular-nums">{width}px</span>
      <span className={`text-type-h3 uppercase tracking-widest ${BAND_COLOR[band]}`}>
        {band}
      </span>
    </div>
  );
}
