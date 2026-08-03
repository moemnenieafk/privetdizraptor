// Матч иконок 1.1.0 с предметами (жадное one-to-one по type-aware скору) + заливка в Supabase.
// Переиспользует готовые рендеры out-unity/ (без пере-рендера). Ключ заливки = BSG-id предмета.
// Запуск: node scripts/icon-render/upload_icons.mjs        (заливка)
//         node scripts/icon-render/upload_icons.mjs --dry  (только отчёт назначений)
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const RENDERS = "scripts/icon-render/out-unity";
const manifest = JSON.parse(readFileSync("scripts/icon-render/out-poc/icon-matching.json", "utf8"));

// Все пары (иконка, кандидат-предмет, скор) → жадное назначение по убыванию скора.
const pairs = [];
for (const ic of manifest.icons) {
  const fake = ic.iconFile.replace(/\.webp$/, "");
  for (const c of ic.candidates || []) pairs.push({ fake, id: c.id, name: c.name, cat: c.cat, score: c.score });
}
pairs.sort((a, b) => b.score - a.score);
const usedIcon = new Set(), usedItem = new Set(), assign = [];
for (const p of pairs) {
  if (usedIcon.has(p.fake) || usedItem.has(p.id) || p.score <= 0) continue;
  usedIcon.add(p.fake); usedItem.add(p.id); assign.push(p);
}

console.log(`иконок: ${manifest.icons.length} · назначено one-to-one: ${assign.length}`);
const low = assign.filter((a) => a.score < 0.45).sort((a, b) => a.score - b.score);
console.log(`--- НИЗКАЯ уверенность (${low.length}) — проверь глазами ---`);
for (const a of low) console.log(`  ${a.score.toFixed(2)}  ${a.name.slice(0, 44).padEnd(44)}  <- ${a.fake}`);

if (DRY) { console.log("DRY: не заливаю."); process.exit(0); }

const { createClient } = await import("@supabase/supabase-js");
const bucket = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
).storage.from("cta-media");

let up = 0, fail = 0;
for (const a of assign) {
  for (const suf of ["", "-1024"]) {
    const f = join(RENDERS, `${a.fake}${suf}.webp`);
    if (!existsSync(f)) continue;
    const { error } = await bucket.upload(`items/eft/${a.id}${suf}.webp`, readFileSync(f), {
      contentType: "image/webp", upsert: true,
    });
    if (error) { fail++; console.log(`  FAIL ${a.id}${suf}: ${error.message}`); }
    else if (!suf) up++;
  }
}
console.log(`ЗАЛИТО иконок: ${up} (BSG-id) · ошибок: ${fail}`);
