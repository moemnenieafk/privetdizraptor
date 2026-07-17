import { Clock, Crosshair, Award, Zap } from "lucide-react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { playtime } from "@/lib/tarkov/player-stats";
import type { PlayerView, ProfileEdition, RaidStatLine } from "@/types/eft-player";

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
  Pistol: "Пистолеты",
  Revolver: "Револьверы",
  SMG: "ПП",
  LMG: "Пулемёты",
  Shotgun: "Дробовики",
  DMR: "Марксманские винтовки",
};

// Мета изданий — зеркалит EDITIONS из ProfileSettingsModal (чтобы не тянуть весь модал).
const EDITION_META: Record<ProfileEdition, { name: string; color: string; border: string; icon: string }> = {
  TUE: { name: "The Unheard", color: "text-edition-tue", border: "border-edition-tue", icon: "icon-eft-profile-tue" },
  EOD: { name: "Edge of Darkness", color: "text-edition-eod", border: "border-edition-eod", icon: "icon-eft-profile-eod" },
  PFE: { name: "Prepare for Escape", color: "text-edition-pfe", border: "border-edition-pfe", icon: "icon-eft-profile-pfe" },
  LB: { name: "Left Behind", color: "text-edition-lb", border: "border-edition-lb", icon: "icon-eft-profile-lb" },
  Standard: { name: "Standard", color: "text-edition-std", border: "border-edition-std", icon: "icon-eft-profile-s" },
};

const getLevelGroup = (level: number) => (level < 5 ? 1 : Math.min(16, Math.floor(level / 5) + 1));

function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function ProfileStats({ view }: { view: PlayerView }) {
  const { hours } = playtime(view.totalTimeSeconds);
  const total = view.raidStats.find((r) => r.side === "Total");
  const ed = EDITION_META[view.edition];
  const factionEmblem =
    view.sideLabel === "BEAR" || view.sideLabel === "USEC"
      ? `/icons/eft/profile-pannel/${view.sideLabel}-logo-sign.svg`
      : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Профиль-панель */}
      <header className="flex flex-col gap-5 border border-lines-hover bg-card-menu p-5">
        <div className="flex items-center gap-4">
          {factionEmblem && (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-lines-hover bg-(--color-base)">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={factionEmblem} alt={view.sideLabel} className="h-9 w-9 object-contain" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl leading-none font-blender-medium tracking-wide text-text-primary">
              {view.nickname}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`flex items-center gap-1.5 border px-2 py-0.5 ${ed.border}`}>
                <span className={`icon-mask ${ed.icon} h-3.5 w-3.5 ${ed.color}`} />
                <span className={`font-blender-medium text-xs uppercase tracking-widest ${ed.color}`}>{ed.name}</span>
              </span>
              <span className="border border-lines-hover px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                {view.sideLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Уровень / Престиж — как в модалке профиля */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Уровень ЧВК">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/icons/eft/lvl-icons/player-level-group-${getLevelGroup(view.level)}.webp`}
              alt={`Уровень ${view.level}`}
              className="h-7 w-7 object-contain"
            />
            <span className="text-2xl font-blender-medium leading-none text-text-primary">{view.level}</span>
          </StatBox>
          <StatBox label="Престиж">
            {view.prestige > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/icons/eft/prestige/prestige-${view.prestige}.webp`}
                alt={`Престиж ${view.prestige}`}
                className="h-7 w-7 object-contain"
              />
            ) : (
              <span className="icon-mask icon-eft-prog-prestige h-4 w-4 text-lines-hover" />
            )}
            <span className="text-2xl font-blender-medium leading-none text-text-primary">
              {view.prestige > 0 ? view.prestige : "—"}
            </span>
          </StatBox>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-2 font-blender-book text-sm text-text-secondary">
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
        </div>
      </header>

      {/* Сводка: кольцо выживаемости + карточки */}
      {total && (
        <section>
          <h3 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">Сводка</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex items-center justify-center gap-4 border border-lines-hover bg-card-menu px-6 py-4 sm:w-56">
              <ProgressRing percent={total.survivalRate} size={92} stroke={8}>
                <span className="text-xl font-blender-medium leading-none text-(--primary)">
                  {total.survivalRate.toFixed(0)}%
                </span>
                <span className="mt-1 font-blender-book text-[10px] uppercase tracking-widest text-text-muted">Выжил</span>
              </ProgressRing>
            </div>
            <div className="grid flex-1 grid-cols-3 gap-3">
              <SummaryCard icon={<Crosshair className="h-4 w-4" />} label="K/D" value={total.kdr.toFixed(2)} accent />
              <SummaryCard label="Рейды" value={fmt(total.raids)} />
              <SummaryCard icon={<Zap className="h-4 w-4" />} label="Лучшая серия" value={fmt(total.streak)} />
              <SummaryCard label="Убийства" value={fmt(total.kills)} />
              <SummaryCard label="Убийства ЧВК" value={fmt(total.killsPmc)} />
              <SummaryCard label="Погибло" value={fmt(total.kia)} />
            </div>
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
                <span className="truncate font-blender-book text-sm text-text-primary">{SKILL_RU[s.id] ?? s.id}</span>
                <span className="ml-2 shrink-0 font-blender-medium text-xs text-(--primary)">{s.level}</span>
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
                <span className="truncate font-blender-book text-sm text-text-primary">{m.id}</span>
                <span className="ml-2 shrink-0 font-blender-medium text-xs text-text-secondary">{fmt(m.progress)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">{label}</span>
      <div className="flex h-12 items-center gap-3 border border-lines-hover bg-(--color-base) px-3">{children}</div>
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
      <span className={`font-blender-medium text-xl leading-none ${accent ? "text-(--primary)" : "text-text-primary"}`}>
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
