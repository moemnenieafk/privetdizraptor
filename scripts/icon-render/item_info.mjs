// Инфо о предметах из НАШЕГО зеркала (name/shortName/description/категория) — для резолва бандлов по смыслу.
// Запуск: node scripts/icon-render/item_info.mjs <id1> <id2> ...
import { config } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
config({ path: join(ROOT, ".env.local") });
const ids = process.argv.slice(2).filter(Boolean);
if (!ids.length) { console.error("нужны id аргументами"); process.exit(1); }
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: g } = await db.from("games").select("id").eq("code", "eft").single();
const { data, error } = await db.from("items").select("in_game_id,name,short_name,description,category_id,item_categories(name)").eq("game_id", g.id).in("in_game_id", ids);
if (error) { console.error(error.message); process.exit(1); }
const byId = new Map(data.map((r) => [r.in_game_id, r]));
for (const id of ids) {
  const r = byId.get(id);
  if (!r) { console.log(`\n${id}\n  (нет в зеркале)`); continue; }
  console.log(`\n${id}\n  name: ${r.name}\n  short: ${r.short_name || "—"}\n  cat:  ${r.item_categories?.name || "—"}\n  desc: ${(r.description || "—").replace(/\s+/g, " ").slice(0, 260)}`);
}
