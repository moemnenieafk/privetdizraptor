// Дорезолв gap-модов (новых 1.1.0, нет в SPT) для 4 стволов с ТОЧНЫМ составом зеркала → полные точные деревья.
// Матч: слот→папка мод-бандлов (сильный приор) + оверлап латинских/числовых токенов имени мода (RU) с именем бандла (EN).
// Общие токены — модельные (rpd, ds, arms, 370, surefire, m600, ak308, val, tkpd, 762x39…).
// Выход: мержит завершённые деревья в weapon-presets.json + отчёт матчей на глаз-сверку.
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
config({ path: join(ROOT, ".env.local") });
const WIN = "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows";
const items = JSON.parse(readFileSync("D:/Games/SPT/SPT_Runtime/SPT_Data/database/templates/items.json", "utf8"));
const prefab = (t) => items[t]?._props?.Prefab?.path || null;
const cat = JSON.parse(readFileSync(join(WIN, "Windows.json"), "utf8"));
const modKeys = Object.keys(cat).filter((k) => /\/items\/mods\/.*\.bundle$/.test(k));

// слот → регэксп папки мод-бандлов (приор)
const SLOT_DIR = {
  mod_barrel: /\/barrels\/barrel_/, mod_handguard: /\/handguards\/handguard_/, mod_stock: /\/stocks\/stock_/,
  mod_muzzle: /\/muzzle\/muzzle_/, mod_pistol_grip: /\/pistol grips\/pistolgrip_/, mod_reciever: /\/recievers\/reciever_/,
  mod_gas_block: /\/gasblock\/gas_block_/, mod_magazine: /\/magazines\/mag_/, mod_sight_rear: /\/sights rear\/sight_/,
  mod_sight_front: /\/sights front\/sight_/, mod_mount: /\/mounts\/mount_/, mod_bipod: /\/bipods\/bipod_/,
  mod_foregrip: /\/foregrips?\//, mod_tactical: /\/(flashlights|tactical|laser)\//, mod_scope: /\/(scopes|sights)/,
  mod_charge: /\/charging|\/charges|\/bolt/, mod_launcher: /\/launcher/,
};
const tokset = (s) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !["for","the","mod","std"].includes(t)));

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: g } = await db.from("games").select("id").eq("code", "eft").single();
  const GAPPY = { "707265736574000000000024": "assets/content/weapons/rpd/", "707265736574000000000027": "", "707265736574000000000028": "", "707265736574000000000029": "" };
  const ids = Object.keys(GAPPY);
  const { data: presets } = await db.from("weapon_presets").select("id,base_item_id,parts").eq("game_id", g.id).in("id", ids);
  // имена всех частей
  const allTpls = [...new Set(presets.flatMap((p) => p.parts.map((x) => x.itemId)))];
  const names = new Map();
  for (let i = 0; i < allTpls.length; i += 200) {
    const { data } = await db.from("items").select("in_game_id,name").eq("game_id", g.id).in("in_game_id", allTpls.slice(i, i + 200));
    for (const r of data) names.set(r.in_game_id, r.name);
  }
  const BASE_OVERRIDE = {
    "707265736574000000000027": "assets/content/weapons/ak308/weapon_izhmash_ak308_762x51_container.bundle",
    "707265736574000000000028": "assets/content/weapons/val_mod4/weapon_nb_val_mod4_9x39_container.bundle",
    "707265736574000000000029": "assets/content/weapons/svdk/weapon_sniperarms_dynamics_tkpd_93x64_container.bundle",
  };
  const RANK = ["mod_barrel","mod_reciever","mod_gas_block","mod_handguard","mod_mount","mod_scope_mount","mod_stock","mod_pistol_grip","mod_muzzle","mod_sight_front","mod_sight_rear","mod_scope","mod_foregrip","mod_tactical","mod_magazine","mod_charge","mod_bipod"];
  const rk = (s) => { const i = RANK.indexOf(s); return i < 0 ? 50 : i; };

  const trees = JSON.parse(readFileSync(join(ROOT, "scripts/reports/weapon-presets.json"), "utf8"));
  const map = JSON.parse(readFileSync(join(ROOT, "scripts/reports/weapon-map.json"), "utf8"));
  const report = [];

  for (const p of presets) {
    const base = prefab(p.base_item_id) || BASE_OVERRIDE[p.id];
    map[p.id] = base;
    const asm = [{ partId: "root", parentId: null, slot: null, bundleKey: base, root: true }];
    let i = 0; const matched = [];
    for (const part of [...p.parts].sort((a, b) => rk(a.slotNameId) - rk(b.slotNameId))) {
      let b = prefab(part.itemId), how = "SPT";
      if (!b) {
        // name-match: фильтр по слот-папке, ранжируем по оверлапу токенов
        const nm = names.get(part.itemId) || "";
        const nt = tokset(nm);
        const dirRe = SLOT_DIR[part.slotNameId] || SLOT_DIR[part.slotNameId.replace(/_\d+$/, "")];
        let cands = modKeys.filter((k) => !dirRe || dirRe.test(k));
        if (!cands.length) cands = modKeys;
        let best = null, bestScore = -1;
        for (const k of cands) {
          const kt = tokset(k.split("/").pop());
          let s = 0; for (const t of nt) if (kt.has(t)) s += (/^\d/.test(t) ? 2 : 1);
          if (s > bestScore) { bestScore = s; best = k; }
        }
        if (best && bestScore > 0) { b = best; how = `name(${bestScore})`; }
      }
      if (b) { asm.push({ partId: `p${i++}`, parentId: "root", slot: part.slotNameId, bundleKey: b, root: false }); matched.push(`${part.slotNameId}[${how}] ${b.split("/").pop()}`); }
      else matched.push(`${part.slotNameId} ✗ (${(names.get(part.itemId)||"?").slice(0,30)})`);
    }
    trees[p.id] = asm;
    report.push(`\n### ${p.id}  parts ${asm.length - 1}/${p.parts.length}  base=${base.split("/").pop()}\n  ` + matched.join("\n  "));
  }
  writeFileSync(join(ROOT, "scripts/reports/weapon-presets.json"), JSON.stringify(trees, null, 1));
  writeFileSync(join(ROOT, "scripts/reports/weapon-map.json"), JSON.stringify(map, null, 1));
  console.log(report.join("\n"));
}
main();
