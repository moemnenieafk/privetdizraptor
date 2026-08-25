// Леджер начислений (read-only): последние N billing_events. Чистый рендер по пропсам —
// данные грузит страница-RSC. amount из БД numeric → строка, показываем как есть.
export interface LedgerRow {
  id: string;
  createdAt: string;
  user: string;
  provider: string;
  type: string;
  tier: string | null;
  amount: string | null;
  currency: string;
  status: string | null;
}

const cell = "px-3 py-2 font-blender-book text-xs text-white/70";
const head =
  "px-3 py-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted text-left";

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return <p className="font-blender-book text-xs text-white/40">Записей пока нет.</p>;
  }
  return (
    <div className="overflow-x-auto border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className={head}>Дата</th>
            <th className={head}>Юзер</th>
            <th className={head}>Провайдер</th>
            <th className={head}>Тип</th>
            <th className={head}>Тир</th>
            <th className={head}>Сумма</th>
            <th className={head}>Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5">
              <td className={cell}>{r.createdAt}</td>
              <td className={cell}>{r.user}</td>
              <td className={cell}>{r.provider}</td>
              <td className={cell}>{r.type}</td>
              <td className={cell}>{r.tier ?? "—"}</td>
              <td className="px-3 py-2 font-blender-medium text-xs text-white/70">
                {r.amount ? `${r.amount} ${r.currency}` : "—"}
              </td>
              <td className={cell}>{r.status ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
