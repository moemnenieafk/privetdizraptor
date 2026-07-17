import { Clock, Crosshair, Shield, Trophy, Award } from "lucide-react";
import { playtime } from "@/lib/tarkov/player-stats";
import type { PlayerView, RaidStatLine } from "@/types/eft-player";

// RU-имена ключевых Common-навыков (что показываем). Незнакомое → сам Id.
const SKILL_RU: Record<string, string> = {
  Endurance: "Выносливость",
  Strength: "Сила",
  Vitality: "Живучесть",
  Health: "Здоровье",
  StressResistance: "Стрессоустойчивость",
  Metabolism: "Метаболизм",
  Immunity: "Иммунитет",
  Perception: "Восприятие",
  Intellect: "Интеллект",
  Attention: "Внимание",
  Charisma: "Харизма",
  Memory: "Память",
  Search: "Поиск",
  MagDrills: "Работа с магазинами",
  Sniper: "Снайпинг",
  Assault: "Штурмовые винтовки",
  AimDrills: "Стрельба",
  Recoil: "Контроль отдачи",
  HideoutManagement: "Управление убежищем",
  Crafting: "Крафт",
  Surgery: "Хирургия",
  FirstAid: "Первая помощь",
  FieldMedicine: "Полевая медицина",
  Throwing: "Метание",
  MedicalStim: "Стимуляторы",
  ProneMovement: "Ползание",
  Sprinting: "Спринт",
  BodyBuilding: "Бодибилдинг",
  CovertMovement: "Скрытность",
  Freetrading: "Торговля",
  Auctions: "Аукционы",
  Perception2: "Восприятие",
  Pistol: "Пистолеты",
  Revolver: "Револьверы",
  SMG: "ПП",
  LMG: "Пулемёты",
  Shotgun: "Дробовики",
  DMR: "Марксманские винтовки",
};

function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

function sideColorVar(sideLabel: string): string {
  if (sideLabel === "BEAR") return "var(--trader-prapor)";
  if (sideLabel === "USEC") return "var(--trader-peacekeeper)";
  return "var(--color-text-secondary)";
}

export function ProfileStats({ view }: { view: PlayerView }) {
  const { hours } = playtime(view.totalTimeSeconds);
  const total = view.raidStats.find((r) => r.side === "Total");

  return (
    <div className="flex flex-col gap-8">
      {/* Шапка */}
      <header className="border border-lines-hover bg-card-menu p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl leading-none font-blender-medium tracking-wide text-text-primary">
            {view.nickname}
          </h2>
          <span
            className="px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest"
            style={{ color: sideColorVar(view.sideLabel), border: `1px solid ${sideColorVar(view.sideLabel)}` }}
          >
            {view.sideLabel}
          </span>
          <span className="border border-lines-hover px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
            Ур. {view.level}
          </span>
          {view.prestige > 0 && (
            <span className="flex items-center gap-1 border border-(--color-kappa) px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--color-kappa)">
              <Trophy className="h-3 w-3" />
              Престиж {view.prestige}
            </span>
          )}
          {view.badges.map((b) => (
            <span
              key={b}
              className="border border-(--color-edition-eod) px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--color-edition-eod)"
            >
              {b}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-blender-book text-sm text-text-secondary">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-muted" />
            {fmt(hours)} ч в рейдах
          </span>
          <span>
            Опыт: <span className="font-blender-medium text-text-primary">{fmt(view.experience)}</span>
          </span>
          <span className="flex items-center gap-2">
            <Award className="h-4 w-4 text-text-muted" />
            Достижений: <span className="font-blender-medium text-text-primary">{view.achievementsCount}</span>
          </span>
          {view.updatedAt && (
            <span>
              Снимок:{" "}
              <span className="font-blender-medium text-text-primary">
                {new Date(view.updatedAt * 1000).toLocaleDateString("ru-RU")}
              </span>
            </span>
          )}
        </div>
      </header>

      {/* Сводка (Total) */}
      {total && (
        <section>
          <h3 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">Сводка</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard icon={<Shield className="h-4 w-4" />} label="Рейды" value={fmt(total.raids)} />
            <SummaryCard label="Выживаемость" value={`${total.survivalRate.toFixed(1)}%`} accent />
            <SummaryCard icon={<Crosshair className="h-4 w-4" />} label="K/D" value={total.kdr.toFixed(2)} accent />
            <SummaryCard icon={<Trophy className="h-4 w-4" />} label="Лучшая серия" value={fmt(total.streak)} />
          </div>
        </section>
      )}

      {/* Таблица по сторонам */}
      <section>
        <h3 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">
          Статистика рейдов
        </h3>
        <RaidTable rows={view.raidStats} />
      </section>

      {/* Навыки */}
      {view.skills.length > 0 && (
        <section>
          <h3 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">
            Навыки <span className="text-text-muted">({view.skills.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {view.skills.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border border-lines-hover bg-card-menu px-3 py-2"
              >
                <span className="font-blender-book text-sm text-text-primary">{SKILL_RU[s.id] ?? s.id}</span>
                <span className="font-blender-medium text-xs text-(--primary)">{s.level}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Мастерство оружия */}
      {view.mastering.length > 0 && (
        <section>
          <h3 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">
            Мастерство оружия <span className="text-text-muted">({view.mastering.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {view.mastering.slice(0, 12).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border border-lines-hover bg-card-menu px-3 py-2"
              >
                <span className="font-blender-book text-sm text-text-primary">{m.id}</span>
                <span className="font-blender-medium text-xs text-text-secondary">{fmt(m.progress)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border border-lines-hover bg-card-menu px-4 py-3">
      <span className="flex items-center gap-1.5 font-blender-book text-xs text-text-muted">
        {icon}
        {label}
      </span>
      <span className={`font-blender-medium text-2xl leading-none ${accent ? "text-(--primary)" : "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

const COLS: Array<{ key: keyof RaidStatLine; label: string }> = [
  { key: "raids", label: "Рейды" },
  { key: "survived", label: "Выжил" },
  { key: "transit", label: "Транзит" },
  { key: "kia", label: "Погиб" },
  { key: "kills", label: "Убийства" },
  { key: "killsPmc", label: "ЧВК" },
  { key: "streak", label: "Серия" },
];

function RaidTable({ rows }: { rows: RaidStatLine[] }) {
  return (
    <div className="overflow-x-auto border border-lines-hover">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-darkbase">
            <th className="px-4 py-2 text-left font-blender-medium text-xs uppercase tracking-widest text-text-muted">
              Сторона
            </th>
            {COLS.map((c) => (
              <th
                key={c.key}
                className="px-4 py-2 text-right font-blender-medium text-xs uppercase tracking-widest text-text-muted"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.side} className="border-t border-lines-hover">
              <td className="px-4 py-2 text-left font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                {r.side === "Total" ? "Всего" : r.side}
              </td>
              {COLS.map((c) => (
                <td key={c.key} className="px-4 py-2 text-right font-blender-medium text-xs text-text-primary">
                  {fmt(r[c.key] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
