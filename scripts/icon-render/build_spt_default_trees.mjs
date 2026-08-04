// Полные деревья дефолт-пресетов из SPT globals.json ItemPresets (иерархия parentId+slotId — точнее плоских parts).
// Для наших preset-id, чей БАЗОВЫЙ ствол есть в SPT (см. MAP: myId → encyclopedia _name).
// Даёт ПОЛНУЮ стандартную сборку (не оптик-версию пресета) — на ревью V4DYA.
// Мержит в scripts/reports/weapon-presets.json + weapon-map.json (НЕ трёт уже собранные из parts).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const items = JSON.parse(readFileSync("D:/Games/SPT/SPT_Runtime/SPT_Data/database/templates/items.json", "utf8"));
const globals = JSON.parse(readFileSync("D:/Games/SPT/SPT_Runtime/SPT_Data/database/globals.json", "utf8"));
const prefab = (tpl) => items[tpl]?._props?.Prefab?.path || null;

// myId → _name базового ствола (encyclopedia). Вариант выбираем точным именем.
const MAP = {
  "6a15ae2ae5267ba21c07f98f": "weapon_hk_416a5_556x45",
  "6a2a77cae232fdab260b484a": "weapon_hk_416a5_556x45",
  "70726573657400000000002e": "weapon_hk_g36_556x45",
  "70726573657400000000002f": "weapon_izhmash_ak12_545x39",
  "707265736574000000000072": "weapon_adar_2-15_556x45",
  "707265736574000000000075": "weapon_izhmash_ak74n_545x39",
  "707265736574000000000076": "weapon_izhmash_pp-19-01_9x19",
  "707265736574000000000077": "weapon_iwi_uzi_9x19",
  "707265736574000000000078": "weapon_hk_mp5_navy3_9x19",
  "707265736574000000000079": "weapon_sig_mcx_spear_68x51",
  "70726573657400000000007c": "weapon_izhmash_svd_s_762x54",
  "70726573657400000000007d": "weapon_sako_trg_m10_86x70",
  "70726573657400000000007e": "weapon_accuracy_inernational_axmc_86x70",
};

// индекс: encName → лучший пресет (предпочтение isDefault / _name~default, иначе с макс. деталей)
const P = globals.ItemPresets;
const byEnc = new Map();
for (const k of Object.keys(P)) {
  const p = P[k];
  const encName = items[p._encyclopedia]?._name;
  if (!encName) continue;
  const cur = byEnc.get(encName);
  const scoreOf = (pp) => (pp._changeWeaponName === false ? 0 : 0) + (/default/i.test(pp._name || "") ? 1000 : 0) + pp._items.length;
  if (!cur || scoreOf(p) > scoreOf(cur)) byEnc.set(encName, p);
}

const treesF = join(ROOT, "scripts/reports/weapon-presets.json");
const mapF = join(ROOT, "scripts/reports/weapon-map.json");
const trees = JSON.parse(readFileSync(treesF, "utf8"));
const map = JSON.parse(readFileSync(mapF, "utf8"));
const report = [], skip = [];

for (const [myId, encName] of Object.entries(MAP)) {
  const p = byEnc.get(encName);
  if (!p) { skip.push(`${myId} enc=${encName} — пресет не найден`); continue; }
  const root = p._items[0];
  const rootBundle = prefab(root._tpl);
  if (!rootBundle) { skip.push(`${myId} enc=${encName} — база ${root._tpl} без Prefab`); continue; }
  const asm = [{ partId: root._id, parentId: null, slot: null, bundleKey: rootBundle, root: true }];
  let gaps = 0;
  for (const it of p._items.slice(1)) {
    const b = prefab(it._tpl);
    if (!b) { gaps++; continue; }
    asm.push({ partId: it._id, parentId: it.parentId, slot: it.slotId, bundleKey: b, root: false });
  }
  trees[myId] = asm;
  map[myId] = rootBundle;
  report.push(`${myId}  [${p._name}]  части ${asm.length - 1}/${p._items.length - 1}${gaps ? ` (пробелы ${gaps})` : ""}`);
}

writeFileSync(treesF, JSON.stringify(trees, null, 1));
writeFileSync(mapF, JSON.stringify(map, null, 1));
console.log(`=== SPT-дефолт деревья: ${report.length} ===\n` + report.join("\n"));
if (skip.length) console.log(`\n=== пропущены: ${skip.length} ===\n` + skip.join("\n"));
