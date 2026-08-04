// Сборка assembly-деревьев оружейных пресетов из состава зеркала (weapon_presets.parts).
// parts = плоский [{itemId(tpl),slotNameId,count}]. Строим ПЛОСКОЕ дерево (все parent=root),
// упорядоченное по слот-рангу (родитель-слота раньше потребителя) — рекурсивный слот-поиск
// рендерера видит слоты уже прицепленных частей. tpl→бандл через SPT items.json Prefab.path.
//
// Выход: scripts/reports/weapon-presets.json {id:[{partId,parentId,slot,bundleKey,root}]}
//        scripts/reports/weapon-map.json     {id: rootBundleKey}
//        + отчёт: у кого не резолвится база/часть.
// Запуск: node scripts/icon-render/build_weapon_trees.mjs
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
config({ path: join(ROOT, ".env.local") });
const SPT = "D:/Games/SPT/SPT_Runtime/SPT_Data/database/templates/items.json";
const items = JSON.parse(readFileSync(SPT, "utf8"));
const prefab = (tpl) => items[tpl]?._props?.Prefab?.path || null;

// ранг слота: меньше = раньше. Родитель-слота (barrel/gasblock/mount) раньше потребителя (muzzle/handguard/scope).
const RANK = ["mod_barrel","mod_reciever","mod_receiver","mod_gas_block","mod_handguard","mod_mount","mod_mount_000","mod_mount_001","mod_mount_002","mod_scope_mount","mod_stock","mod_stock_000","mod_stock_001","mod_pistol_grip","mod_pistolgrip","mod_muzzle","mod_sight_front","mod_sight_rear","mod_scope","mod_scope_000","mod_foregrip","mod_tactical","mod_tactical_000","mod_tactical_001","mod_tactical_002","mod_magazine","mod_charge","mod_bipod","mod_flashlight","mod_launcher"];
const rankOf = (s) => { const i = RANK.indexOf(s); return i === -1 ? 50 : i; };

// база из КЛИЕНТ-каталога для новых 1.1.0-стволов, которых нет в SPT items.json
const BASE_OVERRIDE = {
  "707265736574000000000027": "assets/content/weapons/ak308/weapon_izhmash_ak308_762x51_container.bundle",
  "707265736574000000000028": "assets/content/weapons/val_mod4/weapon_nb_val_mod4_9x39_container.bundle",
  "707265736574000000000029": "assets/content/weapons/svdk/weapon_sniperarms_dynamics_tkpd_93x64_container.bundle",
};

const missing = JSON.parse(readFileSync(join(ROOT, "scripts/reports/missing-weapons.json"), "utf8"));
const ids = missing.map((m) => m.id);
const nameById = new Map(missing.map((m) => [m.id, m.name]));

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: g } = await db.from("games").select("id").eq("code", "eft").single();
const { data: presets } = await db.from("weapon_presets").select("id,base_item_id,parts").eq("game_id", g.id).in("id", ids);
const pById = new Map((presets || []).map((p) => [p.id, p]));

const trees = {}, map = {};
const report = { ok: [], noParts: [], baseUnresolved: [], partGaps: [] };

for (const id of ids) {
  const p = pById.get(id);
  if (!p) { report.noParts.push(`${id}  ${nameById.get(id)}`); continue; }
  const baseBundle = prefab(p.base_item_id) || BASE_OVERRIDE[id];
  if (!baseBundle) { report.baseUnresolved.push(`${id} base=${p.base_item_id}  ${nameById.get(id)}`); continue; }
  map[id] = baseBundle;
  const parts = [...p.parts].sort((a, b) => rankOf(a.slotNameId) - rankOf(b.slotNameId));
  const asm = [{ partId: "root", parentId: null, slot: null, bundleKey: baseBundle, root: true }];
  const gaps = [];
  let i = 0;
  for (const part of parts) {
    const b = prefab(part.itemId);
    if (!b) { gaps.push(part.slotNameId + ":" + part.itemId); continue; }
    asm.push({ partId: `p${i++}`, parentId: "root", slot: part.slotNameId, bundleKey: b, root: false });
  }
  trees[id] = asm;
  report.ok.push(`${id}  части ${asm.length - 1}/${parts.length}${gaps.length ? "  ПРОБЕЛЫ:" + gaps.length : ""}  ${nameById.get(id)}`);
  if (gaps.length) report.partGaps.push(`${id}: ${gaps.join(", ")}`);
}

writeFileSync(join(ROOT, "scripts/reports/weapon-presets.json"), JSON.stringify(trees, null, 1));
writeFileSync(join(ROOT, "scripts/reports/weapon-map.json"), JSON.stringify(map, null, 1));
console.log(`=== OK ${report.ok.length} (деревья построены) ===\n` + report.ok.join("\n"));
console.log(`\n=== нет parts в зеркале: ${report.noParts.length} ===\n` + report.noParts.join("\n"));
if (report.baseUnresolved.length) console.log(`\n=== база не резолвится: ${report.baseUnresolved.length} ===\n` + report.baseUnresolved.join("\n"));
if (report.partGaps.length) console.log(`\n=== пробелы частей (tpl нет в SPT): ${report.partGaps.length} ===\n` + report.partGaps.join("\n"));
