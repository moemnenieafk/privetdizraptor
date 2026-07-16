// Прогон «Ульты» по ролям: гард от регрессий в адаптивном хабе.
// Запуск: npm run audit:roles  (или npx tsx scripts/role-hub-audit.ts)
//
// Проверяет две вещи:
//   1. ССЫЛКИ ХАБОВ — каждый href из ROLE_HUBS резолвится в реально существующий
//      роут src/app (с учётом [slug]/[...catch-all]). Ловит опечатки и удалённые страницы.
//   2. ДВИЖОК — computeRole для каждой роли выдаёт её как primary в «чистом» сценарии
//      (роль не осиротела и достижима авто-инференсом), + холодный старт → низкая уверенность.
//
// Импорт role-inference.ts безопасен под tsx (у файла нет зависимостей). ROLE_HUBS
// читаем как текст, чтобы не тянуть цепочку @/-импортов в CLI-контекст.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PLAYER_ROLES,
  computeRole,
  type PlayerRole,
  type ProfileFacts,
  type BehaviorSignals,
} from "../src/lib/role-inference.ts";

const ROOT = process.cwd();
const APP_DIR = join(ROOT, "src/app");
const HUBS_FILE = join(ROOT, "src/data/role-hubs.ts");

/* ─────────── 1. карта роутов из src/app ─────────── */
function collectRoutes(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === "page.tsx") out.push(base === "" ? "/" : base);
      continue;
    }
    // route-группы (..) не влияют на URL
    const seg = entry.startsWith("(") && entry.endsWith(")") ? "" : `/${entry}`;
    out.push(...collectRoutes(full, base + seg));
  }
  return out;
}

function routeToRegex(route: string): RegExp {
  const parts = route.split("/").filter(Boolean);
  const body = parts
    .map((p) => {
      if (/^\[\[\.\.\..+\]\]$/.test(p)) return "(?:/[^/]+)*"; // optional catch-all
      if (/^\[\.\.\..+\]$/.test(p)) return "/[^/]+(?:/[^/]+)*"; // catch-all (1+)
      if (/^\[.+\]$/.test(p)) return "/[^/]+"; // dynamic single
      return "/" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp("^" + (body || "/") + "/?$");
}

/* ─────────── 2. ссылки хабов из role-hubs.ts ─────────── */
function extractHubLinks(): Record<string, string[]> {
  const src = readFileSync(HUBS_FILE, "utf-8");
  const roleStarts = [...src.matchAll(/^ {2}(\w+):\s*\{/gm)];
  const byRole: Record<string, string[]> = {};
  roleStarts.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < roleStarts.length ? (roleStarts[i + 1].index ?? src.length) : src.length;
    const chunk = src.slice(start, end);
    byRole[m[1]] = [...chunk.matchAll(/href:\s*'([^']+)'/g)].map((h) => h[1]);
  });
  return byRole;
}

/* ─────────── прогон ─────────── */
const routes = [...new Set(collectRoutes(APP_DIR))].sort();
const compiled = routes.map((r) => [r, routeToRegex(r)] as const);

function resolve(href: string): { kind: "exact" | "dynamic" | null; match: string | null } {
  const clean = href.split("?")[0].split("#")[0];
  if (routes.includes(clean)) return { kind: "exact", match: clean };
  const hits = compiled.filter(([, rx]) => rx.test(clean)).map(([r]) => r);
  if (hits.length === 0) return { kind: null, match: null };
  hits.sort((a, b) => (a.split("[").length - b.split("[").length) || b.length - a.length);
  return { kind: "dynamic", match: hits[0] };
}

const hubs = extractHubLinks();
let dead = 0;
let linkTotal = 0;
console.log(`Роутов: ${routes.length} · ролей в хабе: ${Object.keys(hubs).length}\n— Ссылки хабов —`);
for (const [role, hrefs] of Object.entries(hubs)) {
  for (const href of hrefs) {
    linkTotal++;
    const { kind, match } = resolve(href);
    if (kind === null) {
      dead++;
      console.log(`  ❌ DEAD  ${role} → ${href}`);
    } else if (kind === "dynamic") {
      console.log(`  ~  dyn   ${role} → ${href}  (${match})`);
    }
  }
}
console.log(`  ${linkTotal} ссылок, мёртвых: ${dead}`);

/* ─────────── движок: достижимость ролей ─────────── */
const F = (o: Partial<ProfileFacts> = {}): ProfileFacts => ({
  hoursPlayed: null, level: null, prestige: null, mode: null,
  traderLevelAvg: null, survivalRate: null, raids: null, ...o,
});
const mid = F({ level: 30 });
const scenarios: Record<PlayerRole, [ProfileFacts, BehaviorSignals]> = {
  rookie: [F({ level: 8 }), {}],
  progressor: [mid, { quests: 10, questmap: 6, needed: 2 }],
  trader: [mid, { barters: 10, prices: 6 }],
  gunsmith: [mid, { loadouts: 10, gunsmith: 8 }],
  engineer: [mid, { hideout: 12, needed: 3 }],
  raider: [mid, { bosses: 10, maps: 5 }],
  viewer: [mid, { videos: 12 }],
  rat: [mid, { prices: 8, maps: 6, loot: 6 }],
  sherpa: [mid, { comlink: 10 }],
  lore: [mid, { lore: 10 }],
  squad: [mid, { partner: 10 }],
};

let unreachable = 0;
console.log("\n— Движок (достижимость роли как primary) —");
for (const role of PLAYER_ROLES) {
  const [facts, sig] = scenarios[role];
  const r = computeRole(facts, sig);
  if (r.primary !== role) {
    unreachable++;
    console.log(`  ✗ ${role} → primary=${r.primary} (не выдаётся авто-инференсом!)`);
  }
}
const cold = computeRole(F({}), {});
console.log(`  ${PLAYER_ROLES.length - unreachable}/${PLAYER_ROLES.length} ролей достижимы · холодный старт conf=${cold.confidence.toFixed(2)}`);

/* ─────────── вердикт ─────────── */
const failed = dead > 0 || unreachable > 0;
console.log(`\n${failed ? "❌ ПРОВАЛ" : "✅ OK"}: мёртвых ссылок ${dead}, недостижимых ролей ${unreachable}.`);
process.exit(failed ? 1 : 0);
