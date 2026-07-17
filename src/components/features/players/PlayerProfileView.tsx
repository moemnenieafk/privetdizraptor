import Link from "next/link";
import { ArrowLeft, Clock, Crosshair, Shield, Trophy } from "lucide-react";
import { Paywall } from "@/components/features/subscription/Paywall";
import { playtime } from "@/lib/tarkov/player-stats";
import type { PlayerView, RaidStatLine } from "@/types/eft-player";

const MODE_LABEL: Record<string, string> = { regular: "PVP", pve: "PVE" };

function sideColorVar(sideLabel: string): string {
  if (sideLabel === "BEAR") return "var(--trader-prapor)";
  if (sideLabel === "USEC") return "var(--trader-peacekeeper)";
  return "var(--color-text-secondary)";
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function PlayerProfileView({ view }: { view: PlayerView }) {
  const { hours } = playtime(view.totalTimeSeconds);
  const total = view.raidStats.find((r) => r.side === "Total");

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-4xl px-4 xl:px-0">
        <Link
          href={`/eft/comlink/players?gameMode=${view.gameMode}`}
          className="mb-6 inline-flex items-center gap-2 font-blender-book text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />К поиску
        </Link>

        {/* Шапка профиля */}
        <header className="mb-8 border border-lines-hover bg-card-menu p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] leading-none font-blender-medium tracking-wide text-text-primary">
              {view.nickname}
            </h1>
            <span
              className="px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest"
              style={{ color: sideColorVar(view.sideLabel), border: `1px solid ${sideColorVar(view.sideLabel)}` }}
            >
              {view.sideLabel}
            </span>
            <span className="border border-lines-hover px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              {MODE_LABEL[view.gameMode] ?? view.gameMode}
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
            {view.registrationDate && (
              <span>
                Аккаунт с{" "}
                <span className="font-blender-medium text-text-primary">
                  {new Date(view.registrationDate * 1000).toLocaleDateString("ru-RU")}
                </span>
              </span>
            )}
          </div>
        </header>

        {/* Сводка (Total) */}
        {total && (
          <section className="mb-8">
            <h2 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">Сводка</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard icon={<Shield className="h-4 w-4" />} label="Рейды" value={fmt(total.raids)} />
              <SummaryCard
                icon={<Shield className="h-4 w-4" />}
                label="Выживаемость"
                value={`${total.survivalRate.toFixed(1)}%`}
                accent
              />
              <SummaryCard icon={<Crosshair className="h-4 w-4" />} label="K/D" value={total.kdr.toFixed(2)} accent />
              <SummaryCard icon={<Trophy className="h-4 w-4" />} label="Лучшая серия" value={fmt(total.streak)} />
            </div>
          </section>
        )}

        {/* Таблица по сторонам */}
        <section className="mb-8">
          <h2 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">
            Статистика рейдов
          </h2>
          <RaidTable rows={view.raidStats} />
        </section>

        {/* Навыки — за подпиской «Оперативник» */}
        <section>
          <h2 className="mb-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">Навыки</h2>
          <Paywall feature="player_deep_stats">
            {view.skills.length === 0 ? (
              <p className="font-blender-book text-sm text-text-secondary">Прокачанных навыков не найдено.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {view.skills.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between border border-lines-hover bg-card-menu px-3 py-2"
                  >
                    <span className="font-blender-book text-sm text-text-primary">{s.id}</span>
                    <span className="font-blender-medium text-xs text-(--primary)">{Math.floor(s.progress / 100)}</span>
                  </div>
                ))}
              </div>
            )}
          </Paywall>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
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
      <span
        className={`font-blender-medium text-2xl leading-none ${accent ? "text-(--primary)" : "text-text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

const COLS: Array<{ key: keyof RaidStatLine; label: string }> = [
  { key: "raids", label: "Рейды" },
  { key: "survived", label: "Выжил" },
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
