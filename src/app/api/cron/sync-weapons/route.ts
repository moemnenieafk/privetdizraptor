// Синк оружейного слоя EFT (weapon_bases / weapon_slots / weapon_parts / weapon_presets).
// Дёргается вручную из GitHub Actions (.github/workflows/sync-weapons.yml) после патча игры.
// Расписания нет: слоты и модификаторы модулей меняются раз в патч, а не ежечасно.
//
// Защита — CRON_SECRET (fail-closed, как в sync-prices).
// Синк идёт В ТРАНЗАКЦИИ: при любой ошибке таблицы остаются в старом рабочем состоянии.
import { NextResponse } from "next/server";
import { syncEftWeapons } from "@/db/weapons";
import { getEftWeaponsDump } from "@/lib/eft-weapons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // потолок Hobby-плана Vercel

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Диагностика до записи: три вещи, которые молча ломают конструктор.
    const dump = await getEftWeaponsDump();
    const basesNoSlots = dump.bases.filter((b) => b.slots.length === 0).length;
    const basesNoPreset = dump.bases.filter((b) => b.defaultPresetId === null).length;
    const presetParts = dump.presets.reduce((n, p) => n + p.parts.length, 0);
    const presetPartsNoSlotName = dump.presets.reduce(
      (n, p) => n + p.parts.filter((x) => x.slotNameId === "").length,
      0,
    );

    const result = await syncEftWeapons();

    return NextResponse.json({
      ok: true,
      ...result,
      diagnostics: {
        // >0 → у этих стволов пустой конструктор, дерево слотов не распарсилось
        basesWithoutSlots: basesNoSlots,
        // >0 → hero-картинка деградирует до голой базы (без обвеса)
        basesWithoutDefaultPreset: basesNoPreset,
        // если ≈ presetParts → не сработает автозаполнение дерева из пресета
        // (совпадение сборки с пресетом это НЕ ломает — оно сверяется по id)
        presetParts,
        presetPartsWithoutSlotName: presetPartsNoSlotName,
      },
      at: new Date().toISOString(),
    });
  } catch (e) {
    // Эндпоинт за CRON_SECRET — отдаём реальный текст ошибки, чтобы было видно в логах Actions.
    console.error("[cron/sync-weapons]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
