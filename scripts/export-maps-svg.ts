/**
 * ЭКСПОРТ карт EFT в SVG с текущими позициями маркеров (для правки в Figma).
 * Для каждой интерактивной карты: подложка из Supabase Storage + маркеры из map_markers,
 * спроецированные через аффинный переход game→SVG (снят с live-рендера Leaflet, per-map).
 * Маркеры — цветные точки, сгруппированы по типам в <g> (имя = имя слоя, удобно в Figma).
 * Вывод: map-exports/{slug}.svg. Одноразовый дев-скрипт (в прод не идёт).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Аффин game(x,z)→svg: svgX=a*x+b*z+e, svgY=c*x+d*z+f. Снят браузером с live-рендера.
type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };
const AFFINE: Record<string, Affine> = {
  customs: { a: -0.9937, b: 0, c: 0, d: 0.9927, e: 693.1342, f: 302.9708 },
  lighthouse: { a: -1.0003, b: 0, c: 0, d: 1.0003, e: 514.6837, f: 997.7606 },
  reserve: { a: -1.3965, b: 0, c: 0, d: 1.3965, e: 403.9213, f: 382.3499 },
  interchange: { a: -1.0933, b: 0, c: 0, d: 1.0948, e: 653.7759, f: 482.1152 },
  shoreline: { a: -0.9997, b: 0, c: 0, d: 0.9997, e: 504.0898, f: 413.9346 },
  woods: { a: -1.0478, b: 0, c: 0, d: 1.0478, e: 677.087, f: 957.4219 },
  "ground-zero": { a: -1.0018, b: 0, c: 0, d: 1.0018, e: 248.9945, f: 124.3069 },
  factory: { a: 0, b: -0.9921, c: -0.9921, d: 0, e: 66.6784, f: 76.3855 },
  terminal: { a: -0.9545, b: 0, c: 0, d: 0.9545, e: -644.2991, f: -330.5255 },
  "streets-of-tarkov": { a: -1.0064, b: 0, c: 0, d: 1.0064, e: 323.8487, f: 296.6136 },
};

const COLOR: Record<string, string> = {
  extract: "#5FB85B", spawn: "#E6A23C", transit: "#FF7724", hazard: "#E5484D",
  lock: "#BDA550", switch: "#C26BE0", loot_container: "#9A8866", loot_loose: "#E68E25",
  stationary_weapon: "#8FA3B0", quest_zone: "#E0C24A",
};
const GROUP: Record<string, string> = {
  extract: "Выходы", spawn: "Спавны", transit: "Переходы", hazard: "Опасности",
  lock: "Замки", switch: "Рычаги", loot_container: "Контейнеры", loot_loose: "Случайная добыча",
  stationary_weapon: "Стационарки", quest_zone: "Зоны квестов",
};

interface MarkerRow {
  type: string;
  x: number;
  z: number;
  label: string | null;
  faction: string | null;
  sides: string[] | null;
  categories: string[] | null;
}

/** Под-группа маркера (ЧВК/Дикий/Снайпер/Босс для выходов и спавнов). */
function sub(m: MarkerRow): string | null {
  if (m.type === "extract") {
    const f = (m.faction ?? "").toLowerCase();
    return f === "pmc" ? "ЧВК" : f === "scav" ? "Дикий" : "Общий";
  }
  if (m.type === "spawn") {
    const c = (m.categories ?? []).map((x) => x.toLowerCase());
    if (c.includes("sniper")) return "Снайпер";
    if (c.includes("boss")) return "Босс";
    const s = ((m.sides ?? [])[0] ?? "").toLowerCase();
    return s === "pmc" || s === "botpmc" ? "ЧВК" : "Дикий";
  }
  return null;
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

async function main() {
  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!SUPA) throw new Error("NEXT_PUBLIC_SUPABASE_URL не задан");
  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL_SESSION!, { prepare: false, onnotice: () => {} });

  const outDir = path.join(process.cwd(), "map-exports");
  mkdirSync(outDir, { recursive: true });

  for (const [slug, af] of Object.entries(AFFINE)) {
    // 1) подложка
    const res = await fetch(`${SUPA}/storage/v1/object/public/cta-media/maps/eft/${slug}.svg`);
    if (!res.ok) { console.warn(`[${slug}] подложка → HTTP ${res.status}, пропуск`); continue; }
    const svg = await res.text();

    // 2) маркеры
    const rows = (await sql`
      SELECT mm.type,
        (mm.position->>'x')::float x, (mm.position->>'z')::float z,
        mm.label, mm.faction, mm.sides, mm.categories
      FROM map_markers mm JOIN map_assets ma ON ma.map_id = mm.map_id
      WHERE ma.normalized_name = ${slug} AND mm.position IS NOT NULL AND mm.type <> 'boss'
    `) as unknown as MarkerRow[];

    // масштаб маркера-точки в svg-единицах (аффин ≈ игровых единиц)
    const scale = Math.hypot(af.a, af.c) || Math.hypot(af.b, af.d) || 1;
    const r = (3 * scale).toFixed(2);

    // 3) группировка group → sub → круги
    const tree = new Map<string, Map<string, string[]>>();
    for (const m of rows) {
      if (m.x == null || m.z == null) continue;
      const g = GROUP[m.type];
      if (!g) continue;
      const svgX = af.a * m.x + af.b * m.z + af.e;
      const svgY = af.c * m.x + af.d * m.z + af.f;
      const color = COLOR[m.type] ?? "#9696A1";
      const title = m.label ? `<title>${esc(m.label)}</title>` : "";
      const circle = `<circle cx="${svgX.toFixed(2)}" cy="${svgY.toFixed(2)}" r="${r}" fill="${color}" fill-opacity="0.85" stroke="#0d0f12" stroke-width="0.5">${title}</circle>`;
      const s = sub(m) ?? "—";
      if (!tree.has(g)) tree.set(g, new Map());
      const gm = tree.get(g)!;
      if (!gm.has(s)) gm.set(s, []);
      gm.get(s)!.push(circle);
    }

    // 4) сборка <g id="CTA-Markers">
    let markersG = `\n<g id="CTA-Markers" data-cta-markers="1">`;
    for (const [g, subs] of tree) {
      markersG += `\n  <g id="${esc(g)}">`;
      for (const [s, circles] of subs) {
        const inner = circles.join("\n      ");
        markersG += s === "—"
          ? `\n    ${inner}`
          : `\n    <g id="${esc(g)} · ${esc(s)}">\n      ${inner}\n    </g>`;
      }
      markersG += `\n  </g>`;
    }
    markersG += `\n</g>\n`;

    // 5) вставка перед закрывающим </svg>
    const idx = svg.lastIndexOf("</svg>");
    const out = svg.slice(0, idx) + markersG + svg.slice(idx);
    const total = rows.length;
    writeFileSync(path.join(outDir, `${slug}.svg`), out, "utf8");
    console.log(`✓ ${slug}.svg — ${total} маркеров`);
  }

  await sql.end();
  console.log(`\nГотово → ${outDir}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
