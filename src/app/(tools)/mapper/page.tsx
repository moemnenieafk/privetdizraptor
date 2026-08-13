// cta-mapper — локальный dev-тул (карантин, решение 7). Роут /mapper в группе (tools).
// В проде страница закрыта: тул читает/пишет диск по абсолютным путям, наружу не едет.

import { MapperClient } from '@/components/features/mapper/MapperClient';

export const metadata = { title: 'cta-mapper' };

export default function MapperPage() {
  if (process.env.NODE_ENV === 'production') {
    return <div className="p-8 text-sm text-neutral-400">cta-mapper — локальный dev-инструмент, в проде отключён.</div>;
  }
  return <MapperClient />;
}
