import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryScans } from '@/db/schema/vision';
import { detectGeometry, segmentItems, cropSlot } from '@/lib/vision/grid';
import { dhash } from '@/lib/vision/phash';
import { findCandidates, MATCH_TUNING } from '@/lib/vision/item-index';
import { resolveSlots, type VisionRequestSlot } from '@/lib/vision/gemini';
import { consume } from '@/lib/vision/rate-limit';
import { createClient } from '@/lib/supabase/server';
import type { RecognizedSlot, ScanResponse, ScanFailure } from '@/lib/vision/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);

function fail(body: ScanFailure, status: number): NextResponse<ScanFailure> {
  return NextResponse.json(body, { status });
}

// Авторизация: скан идёт в платный Gemini → пускаем ТОЛЬКО залогиненных
// (защита от cost-абьюза = счёт). Пользователь берётся из сессии Supabase.
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: Request): Promise<NextResponse<ScanResponse | ScanFailure>> {
  const userId = await currentUserId();
  if (!userId) {
    // ScanFailure не имеет литерала «auth» → отдаём 'upstream' с понятным message.
    return fail({ error: 'upstream', message: 'Требуется вход' }, 401);
  }

  // Rate-limit по userId (стабильнее IP: x-forwarded-for легко крутить).
  const verdict = consume('vision:' + userId);
  if (!verdict.allowed) {
    return fail({ error: 'rate_limited', retryAfterMs: verdict.retryAfterMs }, 429);
  }

  const form = await request.formData();
  const file = form.get('screenshot');
  if (!(file instanceof File)) {
    return fail({ error: 'unsupported_media', message: 'Поле screenshot обязательно' }, 400);
  }
  if (!ACCEPTED.has(file.type)) {
    return fail({ error: 'unsupported_media', message: `Тип ${file.type} не поддерживается` }, 415);
  }
  if (file.size > MAX_BYTES) {
    return fail({ error: 'too_large', message: 'Максимум 8 МБ' }, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageHash = createHash('sha256').update(buffer).digest('hex');

  const [cachedRow] = await db
    .select({ result: inventoryScans.result })
    .from(inventoryScans)
    .where(eq(inventoryScans.imageHash, imageHash))
    .limit(1);

  if (cachedRow) {
    return NextResponse.json({ ...cachedRow.result, cached: true });
  }

  const geometry = await detectGeometry(buffer);
  if (!geometry) {
    return fail({ error: 'grid_not_found', message: 'Сетка инвентаря не распознана' }, 422);
  }

  const rects = await segmentItems(buffer, geometry);
  const slots: RecognizedSlot[] = [];
  const pending: VisionRequestSlot[] = [];

  for (const [index, rect] of rects.entries()) {
    const crop = await cropSlot(buffer, geometry, rect);
    const hash = await dhash(crop);
    const candidates = await findCandidates(hash, rect.w, rect.h);
    const best = candidates[0];

    if (best && best.distance <= MATCH_TUNING.acceptDistance) {
      slots.push({
        kind: 'phash',
        rect,
        itemId: best.itemId,
        name: best.name,
        normalizedName: best.normalizedName,
        distance: best.distance,
      });
      continue;
    }

    slots.push({ kind: 'unknown', rect, candidates });
    if (candidates.length > 0) {
      pending.push({ slotIndex: index, png: crop, candidates });
    }
  }

  let visionCalls = 0;
  if (pending.length > 0) {
    try {
      const verdicts = await resolveSlots(pending);
      visionCalls = 1;

      for (const item of verdicts) {
        const slot = slots[item.slotIndex];
        if (!slot || slot.kind !== 'unknown' || item.itemId === null) continue;
        const matched = slot.candidates.find((c) => c.itemId === item.itemId);
        if (!matched) continue;

        slots[item.slotIndex] = {
          kind: 'vision',
          rect: slot.rect,
          itemId: matched.itemId,
          name: matched.name,
          normalizedName: matched.normalizedName,
          confidence: item.confidence,
          candidates: slot.candidates,
        };
      }
    } catch (error) {
      // pHash-результаты уже есть — отдаём их, вместо того чтобы валить весь скан
      const message = error instanceof Error ? error.message : 'Vision fallback failed';
      console.error('[vision] fallback failed', message);
    }
  }

  const result: ScanResponse = { geometry, slots, visionCalls, cached: false };

  await db
    .insert(inventoryScans)
    .values({ imageHash, result, cellPitch: geometry.pitch, visionCalls, userId })
    .onConflictDoNothing();

  return NextResponse.json(result);
}
