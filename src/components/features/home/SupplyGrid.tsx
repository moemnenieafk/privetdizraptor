import type { SupplyItem } from "@/types/supply";

interface SupplyGridProps {
  items: SupplyItem[];
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(price)) + " ₽";
}

function formatPercent(value: number, sign = true): string {
  const s = sign && value >= 0 ? "+" : "";
  return `${s}${value.toFixed(1)}%`;
}

export function SupplyGrid({ items }: SupplyGridProps) {
  if (items.length === 0) return null;

  return (
    <section className="w-full px-4 md:px-8 pb-16 bg-darkbase">
      <div className="flex items-center justify-center w-full gap-4 md:gap-7 mb-2">
        <div className="hidden md:block h-px flex-1 max-w-40 lg:max-w-87 bg-linear-to-l from-lines-hover to-transparent" />
        <h3 className="font-blender-medium uppercase tracking-widest text-text-primary shrink-0 text-xl sm:text-2xl md:text-3xl lg:text-[32px]">
          МОНИТОРИНГ РЫНКА
        </h3>
        <div className="hidden md:block h-px flex-1 max-w-40 lg:max-w-87 bg-linear-to-r from-lines-hover to-transparent" />
      </div>
      <p className="text-center font-blender-medium text-[10px] tracking-[0.3em] uppercase text-text-muted mb-8">
        // ПРИБЫЛЬНЫЕ АКТИВЫ · АРБИТРАЖ · 24H ДИАПАЗОН
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-lines-hover max-w-480 mx-auto border border-lines-hover">
        {items.map((item) => {
          const changePos = item.changeLast48hPercent >= 0;
          const buybackPos = item.buybackRatio >= 0;
          const rangeHigh = item.range24hPercent >= 20;

          return (
            <div key={item.normalizedName} className="relative bg-card-menu p-3 flex flex-col gap-1.5 group">
              {/* Item name */}
              <p className="font-blender-medium text-[10px] uppercase tracking-wider text-text-primary leading-tight line-clamp-2">
                {item.name}
              </p>

              {/* Avg price + 24h range */}
              <div className="flex items-baseline gap-2">
                <p className="font-blender-medium text-xs text-text-secondary tabular-nums">
                  {formatPrice(item.avg24hPrice)}
                </p>
                <p className="font-blender-medium text-[9px] text-text-muted tabular-nums">
                  L {formatPrice(item.low24hPrice)} / H {formatPrice(item.high24hPrice)}
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {/* 48h trend */}
                <span
                  className={`font-blender-medium text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 border ${
                    changePos
                      ? "text-nvg-green border-nvg-green/30 bg-nvg-green/5"
                      : "text-danger border-danger/30 bg-danger/5"
                  }`}
                >
                  {changePos ? "▲" : "▼"} {formatPercent(item.changeLast48hPercent)}
                </span>

                {/* 24h range badge */}
                <span
                  className={`font-blender-medium text-[9px] tracking-widest uppercase px-1.5 py-0.5 border ${
                    rangeHigh
                      ? "text-tactical-amber border-tactical-amber/30 bg-tactical-amber/5"
                      : "text-text-muted border-lines-hover"
                  }`}
                >
                  RNG {formatPercent(item.range24hPercent, false)}
                </span>

                {/* Buyback badge */}
                {item.bestTraderBuy && (
                  <span
                    className={`font-blender-medium text-[9px] tracking-widest uppercase px-1.5 py-0.5 border ${
                      buybackPos
                        ? "text-nvg-green border-nvg-green/30 bg-nvg-green/5"
                        : "text-danger border-danger/30 bg-danger/5"
                    }`}
                  >
                    BUY {formatPercent(item.buybackRatio * 100)}
                  </span>
                )}
              </div>

              {/* Best trader */}
              {item.bestTraderBuy && (
                <div className="flex items-center gap-1.5 mt-auto">
                  <img
                    src={`/images/traders/eft/${item.bestTraderBuy.vendorNormalizedName}.webp`}
                    alt={item.bestTraderBuy.vendorName}
                    width={16}
                    height={16}
                    className="w-4 h-4 object-cover grayscale opacity-60"
                  />
                  <p className="font-blender-medium text-[9px] uppercase tracking-wider text-text-muted">
                    {item.bestTraderBuy.vendorName} · {formatPrice(item.bestTraderBuy.price)}
                  </p>
                </div>
              )}

              {/* Bottom accent */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-(--primary) opacity-0 group-hover:opacity-40 transition-opacity" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
