// Синк оружейного слоя EFT: weapon_bases / weapon_slots / weapon_parts / weapon_presets
// + спеки квестов «Оружейник» (gunsmith_specs).
//
// Дёргается вручную из GitHub Actions (.github/workflows/sync-weapons.yml) после патча игры.
// Расписания нет: слоты, модификаторы модулей и пороги квестов меняются раз в патч.
//
// Защита — CRON_SECRET (fail-closed, как в sync-prices).
// Каждый синк идёт В СВОЕЙ транзакции: падение спек не откатывает оружейный слой,
// и наоборот. Спеки — best-effort: без них живёт конструктор, но не вкладка «Оружейник».
import { NextResponse } from "next/server";
import { syncEftWeapons, syncEftGunsmith, type SyncGunsmithResult } from "@/db/weapons";
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

    const weapons = await syncEftWeapons();

    // Спеки — best-effort: их падение не должно валить уже записанный оружейный слой.
    let gunsmith: SyncGunsmithResult = { specs: 0, specsWithoutThresholds: 0 };
    let gunsmithError: string | null = null;
    try {
      gunsmith = await syncEftGunsmith();
    } catch (e) {
      console.error("[cron/sync-weapons] gunsmith:", e);
      gunsmithError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      ok: true,
      ...weapons,
      gunsmith,
      gunsmithError,
      diagnostics: {
        // >0 → у этих стволов пустой конструктор, дерево слотов не распарсилось
        basesWithoutSlots: basesNoSlots,
        // >0 → hero-картинка деградирует до голой базы (без обвеса)
        basesWithoutDefaultPreset: basesNoPreset,
        // слот детали пресета выводится из allowedItemIds (см. lib/preset-slots) —
        // остаток здесь это детали, не влезающие ни в один слот (патроны в магазинах)
        presetParts,
        presetPartsWithoutSlotName: presetPartsNoSlotName,
      },
      at: new Date().toISOString(),
    });
  } catch (e) {
    // Эндпоинт за CRON_SECRET — отдаём реальный текст ошибки, чтобы было видно в логах Actions.
    // postgres-js прячет исходную ошибку БД в cause: без неё видно только «Failed query».
    console.error("[cron/sync-weapons]", e);
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    return NextResponse.json(
      {
        ok: false,
        error: err.message ?? String(e),
        dbError: err.cause?.message ?? null,
        dbCode: err.cause?.code ?? null,
      },
      { status: 500 },
    );
  }
}