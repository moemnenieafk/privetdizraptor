// Калибровка world→factory-hd-пиксель (аффинное). Якоря: синканные выходы+переходы Завода(день)
// [world, именованные] ↔ JSON-разметка factory-markers.json [пиксель, без имён].
// Корреспонденция неизвестна → RANSAC по триплетам (точное 3-точечное аффинное), скор по инлайерам,
// затем уточнение МНК по инлайерам. Печатает матрицу + остаточные ошибки. Ничего не пишет.
// Запуск: node scripts/calibrate-factory-hd.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFile } from "node:fs/promises";

const FACTORY_DAY = "55f2d3fd4bdc2d5f408b4567";
const ANCHOR_TYPES = new Set(["extract", "transit"]);
const INLIER_PX = 500; // порог инлайера (Завод ~120 px/world-unit; выходы разнесены >1000px)

// ── линейная алгебра ──────────────────────────────────────────────────────
function solve3(M, b) {
  // Гаусс с частичным выбором ведущего, 3x3
  const a = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-9) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}
// src[i]=[x,z] dst[i]=[px,py] (3 точки) → [a,b,c,d,e,f]: px=ax+bz+c, py=dx+ez+f
function affine3(src, dst) {
  const M = src.map((s) => [s[0], s[1], 1]);
  const abc = solve3(M.map((r) => [...r]), dst.map((d) => d[0]));
  const def = solve3(M.map((r) => [...r]), dst.map((d) => d[1]));
  return abc && def ? [...abc, ...def] : null;
}
// МНК аффинного по >=3 парам {s:[x,z], d:[px,py]}
function affineLSQ(pairs) {
  // Нормальные уравнения (A^T A) p = A^T b, A-строка=[x,z,1], отдельно для px и py
  const ATA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const ATx = [0, 0, 0], ATy = [0, 0, 0];
  for (const { s, d } of pairs) {
    const r = [s[0], s[1], 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) ATA[i][j] += r[i] * r[j];
      ATx[i] += r[i] * d[0];
      ATy[i] += r[i] * d[1];
    }
  }
  const abc = solve3(ATA.map((r) => [...r]), ATx);
  const def = solve3(ATA.map((r) => [...r]), ATy);
  return abc && def ? [...abc, ...def] : null;
}
const apply = (A, x, z) => [A[0] * x + A[1] * z + A[2], A[3] * x + A[4] * z + A[5]];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

// Гейт масштаба: px на world-unit по обеим осям должен быть в разумной полосе (Завод ~100 px/u).
// Убивает вырожденные (сжимающие всё в точку) аффинные.
const SCALE_MIN = 50, SCALE_MAX = 200;
function scaleOk(A) {
  const sx = Math.hypot(A[0], A[3]); // px на изменение world-x
  const sz = Math.hypot(A[1], A[4]); // px на изменение world-z
  return sx >= SCALE_MIN && sx <= SCALE_MAX && sz >= SCALE_MIN && sz <= SCALE_MAX;
}
// Инъективное жадное сопоставление: пары (si→tj) с dist<порога, по возрастанию, каждый tj ≤ 1 раз.
// Возвращает {inl, sum, corr[]}. Так «сжатие 12→3» не наберёт инлайеров.
function matchInjective(A, S, T, thr) {
  const cand = [];
  for (let i = 0; i < S.length; i++) {
    const p = apply(A, S[i].s[0], S[i].s[1]);
    for (let j = 0; j < T.length; j++) {
      const dd = dist(p, T[j].d);
      if (dd < thr) cand.push([dd, i, j]);
    }
  }
  cand.sort((a, b) => a[0] - b[0]);
  const usedS = new Set(), usedT = new Set();
  let inl = 0, sum = 0;
  const corr = [];
  for (const [dd, i, j] of cand) {
    if (usedS.has(i) || usedT.has(j)) continue;
    usedS.add(i); usedT.add(j); inl++; sum += dd;
    corr.push({ s: S[i].s, d: T[j].d });
  }
  return { inl, sum, corr };
}

// ── данные ────────────────────────────────────────────────────────────────
async function loadSynced() {
  const { db } = await import("../src/db/index.ts");
  const { sql } = await import("drizzle-orm");
  const res = await db.execute(
    sql`select type, label, position from map_markers
        where map_id = ${FACTORY_DAY} and type in ('extract','transit') order by type, label`,
  );
  const rows = Array.isArray(res) ? res : res.rows ?? [];
  return rows.map((r) => ({ type: r.type, label: r.label, x: r.position.x, z: r.position.z }));
}
async function loadJsonAnchors() {
  const data = JSON.parse(await readFile("public/maps/factory/markers/factory-markers.json", "utf8"));
  const out = [];
  for (const [floor, arr] of Object.entries(data))
    for (const m of arr) if (ANCHOR_TYPES.has(m.type)) out.push({ type: m.type, floor, px: m.x, py: m.y });
  return out;
}

// ── RANSAC ──────────────────────────────────────────────────────────────────
function* triples(n) {
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) yield [i, j, k];
}
function* perms3([a, b, c]) {
  yield [a, b, c]; yield [a, c, b]; yield [b, a, c]; yield [b, c, a]; yield [c, a, b]; yield [c, b, a];
}

async function main() {
  const S = (await loadSynced()).map((m) => ({ ...m, s: [m.x, m.z] }));
  const T = (await loadJsonAnchors()).map((m) => ({ ...m, d: [m.px, m.py] }));
  console.log(`Синканные якоря (world): ${S.length}`, S.map((m) => `${m.label}[${m.type}]`).join(", "));
  console.log(`JSON якоря (пиксель): ${T.length}`, T.map((m) => `${m.type}@${m.floor}`).join(", "));

  let best = null;
  for (const si of triples(S.length)) {
    for (const ti of triples(T.length)) {
      for (const tp of perms3(ti)) {
        const A = affine3(si.map((i) => S[i].s), tp.map((i) => T[i].d));
        if (!A || !scaleOk(A)) continue; // гейт масштаба режет вырожденные
        const { inl, sum, corr } = matchInjective(A, S, T, INLIER_PX);
        if (!best || inl > best.inl || (inl === best.inl && sum < best.sum)) best = { A, inl, sum, corr };
      }
    }
  }
  if (!best) { console.log("НЕ НАШЁЛ преобразование"); process.exit(1); }

  // Уточнение МНК по инлайерам + ICP (пере-сопоставить ↔ пере-подогнать) до стабилизации
  let Aref = affineLSQ(best.corr) ?? best.A;
  for (let it = 0; it < 6; it++) {
    const c = matchInjective(Aref, S, T, INLIER_PX).corr;
    if (c.length < 3) break;
    const next = affineLSQ(c);
    if (!next) break;
    Aref = next;
  }
  // Пересчёт остатков на уточнённом — инъективно (пара s↔t уникальна)
  const m2 = matchInjective(Aref, S, T, INLIER_PX);
  const paired = new Map(m2.corr.map((c) => [`${c.s[0]},${c.s[1]}`, c.d]));
  const report = S.map((sm) => {
    const p = apply(Aref, sm.s[0], sm.s[1]);
    const d = paired.get(`${sm.s[0]},${sm.s[1]}`);
    const resid = d ? dist(p, d) : Infinity;
    return { label: sm.label, type: sm.type, px: p.map((v) => +v.toFixed(1)), resid: +resid.toFixed(1), inlier: !!d };
  });

  console.log(`\nЛУЧШЕЕ: инъективных инлайеров ${m2.inl}/${S.length}`);
  console.log("Остатки (инлайеры), px: avg", +(m2.sum / Math.max(1, m2.inl)).toFixed(1), "max", +Math.max(0, ...report.filter((r) => r.inlier).map((r) => r.resid)).toFixed(1));
  console.log("\nАффинное world→пиксель [a,b,c,d,e,f] (px=ax+bz+c, py=dx+ez+f):");
  console.log(JSON.stringify(Aref.map((v) => +v.toFixed(6))));
  console.log("\nПроекция синканных якорей:");
  for (const r of report)
    console.log(`  ${r.inlier ? "✓" : "✗"} ${JSON.stringify(r.label)}[${r.type}] → px${JSON.stringify(r.px)} resid=${r.inlier ? r.resid : "—"}`);

  // Санити: масштаб (px на world-unit) и поворот
  const sx = Math.hypot(Aref[0], Aref[3]), sy = Math.hypot(Aref[1], Aref[4]);
  console.log(`\nМасштаб: |dx/dwx|=${sx.toFixed(1)} px/u, |dx/dwz|=${sy.toFixed(1)} px/u`);

  // Запись калибровки для скрипта проекции квест-зон
  const { writeFile } = await import("node:fs/promises");
  const outPath = "public/maps/factory/markers/factory-hd-calibration.json";
  await writeFile(
    outPath,
    JSON.stringify(
      {
        note: "world→factory-hd-пиксель. px=a*x+b*z+c, py=d*x+e*z+f. Затем CRS: x=px/64, z=-py/64.",
        source: `map_markers[${FACTORY_DAY}] extract+transit ↔ factory-markers.json`,
        affine: Aref.map((v) => +v.toFixed(6)),
        scalePxPerUnit: [+sx.toFixed(2), +sy.toFixed(2)],
        inliers: m2.inl,
        residualPxAvg: +(m2.sum / Math.max(1, m2.inl)).toFixed(1),
        residualPxMax: +Math.max(0, ...report.filter((r) => r.inlier).map((r) => r.resid)).toFixed(1),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nКалибровка записана → ${outPath}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
