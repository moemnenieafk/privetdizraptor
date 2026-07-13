// Витрина готовых пресетов игры (463 штуки) для вкладки «Пресеты» в /find.
//
// Пресет — самостоятельный item со своим id, а значит и со своей ОТРЕНДЕРЕННОЙ
// картинкой собранного ствола (items/eft/512/{presetId}.webp в R2). Это единственный
// раздел каталога, где картинка честная, а не «база + планка иконок».
//
// Статы берём из самого пресета (tarkov.dev считает их за нас: ergonomics /
// recoilVertical / recoilHorizontal / moa) — солвер и движок здесь не нужны.
//
// Только для сервера. Импортировать из RSC.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { items, weaponPresets } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { memoTTL } from "@/lib/server-cache";

export interface PresetListItem {
  /** id пресета — он же ключ картинки. */
  id: string;
  name: string;
  baseItemId: string;
  baseName: string;
  caliber: string | null;
  isDefault: boolean;
  ergonomics: number | null;
  recoilSum: number | null;
  moa: number | null;
  /** Сколько деталей в пресете. */
  partCount: number;
}

const PRESETS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Все пресеты, сгруппированные по стволу: дефолтный первым, дальше по числу деталей
 * (богаче обвес — интереснее карточка).
 */
export async function getPresetList(): Promise<PresetListItem[]> {
  return memoTTL("eft-preset-list", PRESETS_TTL_MS, async () => {
    const gameId = await eftGameId();

    const [presetRows, itemRows] = await Promise.all([
      db.select().from(weaponPresets).where(eq(weaponPresets.gameId, gameId)),
      db
        .select({ id: items.inGameId, name: items.name })
        .from(items)
        .where(eq(items.gameId, gameId)),
    ]);

    const names = new Map(itemRows.map((r) => [r.id, r.name]));

    // Калибр берём с базы: у пресета своего поля нет.
    const { getWeaponBaseList } = await import("@/db/weapons");
    const bases = await getWeaponBaseList();
    const caliberOf = new Map(bases.map((b) => [b.id, b.caliber]));

    const list: PresetListItem[] = presetRows.map((p) => ({
      id: p.id,
      name: p.name,
      baseItemId: p.baseItemId,
      baseName: names.get(p.baseItemId) ?? p.baseItemId,
      caliber: caliberOf.get(p.baseItemId) ?? null,
      isDefault: p.isDefault,
      ergonomics: p.ergonomics,
      recoilSum:
        p.recoilVertical != null && p.recoilHorizontal != null
          ? p.recoilVertical + p.recoilHorizontal
          : null,
      moa: p.moa,
      partCount: p.parts.length,
    }));

    return list.sort((a, b) => {
      const byBase = a.baseName.localeCompare(b.baseName, "ru");
      if (byBase !== 0) return byBase;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return b.partCount - a.partCount;
    });
  });
}