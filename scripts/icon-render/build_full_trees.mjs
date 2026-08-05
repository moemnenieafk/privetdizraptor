// Полные assembly-деревья gap-стволов: состав зеркала (weapon_presets.parts) → резолв каждой части
// (SPT items.json Prefab.path ИЛИ курированный gap-mods-map.json для новых 1.1.0-модов).
// Ранг-сортировка слотов + вложение дублей: 2-е вхождение слота крепится к 1-му (рама→UBR, ствол→глушитель).
// Выход: scripts/reports/full-weapon-trees.json  {id:[{partId,parentId,slot,bundleKey,root}]} — для --assembly-map.
// Запуск: node scripts/icon-render/build_full_trees.mjs <id...>   (по умолч. 24,27,28,29)
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
config({ path: join(ROOT, ".env.local") });

const items = JSON.parse(readFileSync("D:/Games/SPT/SPT_Runtime/SPT_Data/database/templates/items.json", "utf8"));
const prefab = (tpl) => items[tpl]?._props?.Prefab?.path || null;
const gap = JSON.parse(readFileSync(join(ROOT, "scripts/reports/gap-mods-map.json"), "utf8"));
const baseMap = JSON.parse(readFileSync(join(ROOT, "scripts/reports/weapon-map.json"), "utf8"));

// ранг слота: родитель-слота (ствол/ресивер/газблок) раньше потребителя (дульник/цевьё/оптика/тактикал)
const RANK = ["mod_barrel","mod_reciever","mod_receiver","mod_gas_block","mod_handguard","mod_mount","mod_mount_000","mod_mount_001","mod_mount_002","mod_mount_003","mod_scope_mount","mod_stock","mod_stock_000","mod_stock_001","mod_pistol_grip","mod_pistolgrip","mod_muzzle","mod_sight_front","mod_sight_rear","mod_scope","mod_scope_000","mod_foregrip","mod_tactical","mod_tactical_000","mod_tactical_001","mod_tactical_002","mod_magazine","mod_charge","mod_bipod","mod_flashlight","mod_launcher"];
const rankOf = (s) => { const i = RANK.indexOf(s); return i === -1 ? 50 : i; };
const isAmmo = (slot) => !slot || /cartridge|patron|camora|chamber/i.test(slot);

const ids = process.argv.slice(2).filter(Boolean).length ? process.argv.slice(2).filter(Boolean)
  : ["707265736574000000000024","707265736574000000000027","707265736574000000000028","707265736574000000000029"];

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: g } = await db.from("games").select("id").eq("code", "eft").single();
const { data: presets } = await db.from("weapon_presets").select("id,base_item_id,parts").eq("game_id", g.id).in("id", ids);
const pById = new Map((presets || []).map((p) => [p.id, p]));

const out = {};
for (const id of ids) {
  const p = pById.get(id);
  if (!p) { console.log(`SKIP ${id}: нет в weapon_presets`); continue; }
  const baseBundle = baseMap[id] || prefab(p.base_item_id);
  if (!baseBundle) { console.log(`SKIP ${id}: база не резолвится`); continue; }
  const parts = p.parts
    .filter((x) => !isAmmo(x.slotNameId))
    .map((x) => ({ slot: x.slotNameId, tpl: x.itemId, bundle: prefab(x.itemId) || gap[x.itemId] || null }))
    .sort((a, b) => rankOf(a.slot) - rankOf(b.slot));

  const tree = [{ partId: "root", parentId: null, slot: null, bundleKey: baseBundle, root: true }];
  const lastBySlot = {}; // slot → partId последнего вхождения (для вложения дублей)
  const gaps = [];
  let i = 0;
  for (const part of parts) {
    if (!part.bundle) { gaps.push(`${part.slot}:${part.tpl}`); continue; }
    const pid = `p${i++}`;
    const parentId = lastBySlot[part.slot] || "root"; // дубль слота → крепим к предыдущему носителю слота
    tree.push({ partId: pid, parentId, slot: part.slot, bundleKey: part.bundle, root: false });
    lastBySlot[part.slot] = pid;
  }
  out[id] = tree;
  console.log(`\n${id}  ${p.parts.length} parts → дерево ${tree.length - 1}${gaps.length ? `  ⚠ПРОБЕЛЫ:${gaps.length} ${gaps.join(", ")}` : "  (полное)"}`);
  for (const t of tree) console.log(`  ${t.root ? "[ROOT]" : (t.parentId + " → ").padStart(6)} ${(t.slot || "").padEnd(16)} ${t.bundleKey.split("/").pop()}`);
}

writeFileSync(join(ROOT, "scripts/reports/full-weapon-trees.json"), JSON.stringify(out, null, 1));
console.log(`\n→ scripts/reports/full-weapon-trees.json (${Object.keys(out).length} деревьев)`);
