// GET /api/eft/prestige-items — резолв id фигурок престижа → slug (normalizedName)
// для кросс-линка на страницу предмета. Косметика в каталоге отсутствует и сюда не входит.
import { NextResponse } from 'next/server';
import { getEftPricesByIds } from '@/db/prices';
import { PRESTIGE_LINKABLE_ITEM_IDS } from '@/data/prestige';

export const runtime = 'nodejs';
// Резолв item→slug идёт в рантайме (БД доступна), а не на билде:
// иначе Next статически пререндерит роут и дёргает БД во время сборки.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const prices = await getEftPricesByIds(PRESTIGE_LINKABLE_ITEM_IDS);
    const map: Record<string, string> = {};
    for (const id of PRESTIGE_LINKABLE_ITEM_IDS) {
      const slug = prices.get(id)?.normalizedName;
      if (slug) map[id] = slug;
    }
    return NextResponse.json(map, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
