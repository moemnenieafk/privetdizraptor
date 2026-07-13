// CLI-синк оружейного слоя: npm run db:sync-weapons
//
// Полностью пересобирает weapon_bases / weapon_parts / weapon_presets / weapon_slots
// из tarkov.dev. Идемпотентен, запускается вручную после патча игры (крон не нужен:
// слоты и модификаторы меняются раз в патч, а не раз в час — в отличие от цен).
//
// Печатает диагностику по трём вещам, которые молча ломают конструктор:
//   • стволы без слотов        → не распарсилось дерево
//   • стволы без defaultPreset → hero-картинка деградирует до голой базы
//   • детали пресетов без slotNameId → не сработает автозаполнение из пресета
import "dotenv/config";
import { syncEftWeapons } from "../src/db/weapons";
import { getEftWeaponsDump } from "../src/lib/eft-weapons";

async function main(): Promise<void> {
  const started = Date.now();
  console.log("🔫 Синк оружейного слоя EFT (tarkov.dev → Supabase)…");

  const dump = await getEftWeaponsDump();

  const noSlots = dump.bases.filter((b) => b.slots.length === 0);
  const noPreset = dump.bases.filter((b) => b.defaultPresetId === null);
  const presetParts = dump.presets.flatMap((p) => p.parts);
  const noSlotName = presetParts.filter((p) => p.slotNameId === "");

  const result = await syncEftWeapons();
  const sec = ((Date.now() - started) / 1000).toFixed(1);

  console.log("");
  console.log(`✅ Готово за ${sec}с`);
  console.log(`   стволы:  ${result.bases}`);
  console.log(`   детали:  ${result.parts} (модули + патроны)`);
  console.log(`   пресеты: ${result.presets}`);
  console.log(`   слоты:   ${result.slots}`);
  console.log("");

  if (noSlots.length > 0) {
    console.warn(`⚠️  стволов БЕЗ слотов: ${noSlots.length} — конструктор для них пуст`);
    console.warn(`   ${noSlots.slice(0, 5).map((b) => b.itemId).join(", ")}`);
  }
  if (noPreset.length > 0) {
    console.warn(`⚠️  стволов без defaultPreset: ${noPreset.length} — hero-картинка = голая база`);
  }
  if (presetParts.length > 0 && noSlotName.length > 0) {
    const pct = Math.round((noSlotName.length / presetParts.length) * 100);
    console.warn(
      `⚠️  деталей пресетов без slotNameId: ${noSlotName.length}/${presetParts.length} (${pct}%)`,
    );
    console.warn(`   совпадение сборки с пресетом (hero-рендер) работать будет — оно по id.`);
    console.warn(`   не сработает автозаполнение дерева из пресета: чинится в mapPreset.`);
  }

  process.exit(0);
}

main().catch((e: unknown) => {
  console.error("❌ Синк оружия упал — таблицы НЕ тронуты:");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});