import Link from "next/link";
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
    <section className="w-full px-4 md:px-8 pb-16">
      <div className="max-w-275 mx-auto">
        <div className="flex items-center justify-center w-full gap-4 md:gap-7 mb-2">
          <div className="hidden md:block h-px flex-1 bg-linear-to-l from-lines-hover to-transparent" />
          <h3 className="font-blender-medium uppercase tracking-widest text-text-primary shrink-0 text-xl sm:text-2xl md:text-3xl lg:text-[32px]">
            МОНИТОРИНГ РЫНКА
          </h3>
          <div className="hidden md:block h-px flex-1 bg-linear-to-r from-lines-hover to-transparent" />
        </div>
        <p className="text-center font-blender-medium text-type-caption tracking-[0.3em] uppercase text-text-muted mb-8">
          // ПРИБЫЛЬНЫЕ АКТИВЫ · АРБИТРАЖ · 24H ДИАПАЗОН
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const changePos = item.changeLast48hPercent >= 0;
            const buybackPos = item.buybackRatio >= 0;
            const rangeHigh = item.range24hPercent >= 20;

            return (
              <Link
                key={item.normalizedName}
                href={`/eft/items`}
                className="relative bg-card-menu border border-lines-hover rounded-xs p-3 flex flex-col gap-1.5 group hover:border-(--primary)/40 hover:bg-(--primary)/5"
              >
                <p className="font-blender-medium text-type-caption uppercase tracking-wider text-text-primary leading-tight line-clamp-2 group-hover:text-(--primary)">
                  {item.name}
                </p>

                <div className="flex items-baseline gap-2">
                  <p className="font-blender-medium text-xs text-text-secondary tabular-nums">
                    {formatPrice(item.avg24hPrice)}
                  </p>
                  <p className="font-blender-medium text-type-caption text-text-muted tabular-nums">
                    L {formatPrice(item.low24hPrice)} / H {formatPrice(item.high24hPrice)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span
                    className={`font-blender-medium text-type-caption tracking-[0.15em] uppercase px-1.5 py-0.5 border rounded-xs ${
                      changePos
                        ? "text-nvg-green border-nvg-green/30 bg-nvg-green/5"
                        : "text-danger border-danger/30 bg-danger/5"
                    }`}
                  >
                    {changePos ? "▲" : "▼"} {formatPercent(item.changeLast48hPercent)}
                  </span>

                  <span
                    className={`font-blender-medium text-type-caption tracking-widest uppercase px-1.5 py-0.5 border rounded-xs ${
                      rangeHigh
                        ? "text-tactical-amber border-tactical-amber/30 bg-tactical-amber/5"
                        : "text-text-muted border-lines-hover"
                    }`}
                  >
                    RNG {formatPercent(item.range24hPercent, false)}
                  </span>

                  {item.bestTraderBuy && (
                    <span
                      className={`font-blender-medium text-type-caption tracking-widest uppercase px-1.5 py-0.5 border rounded-xs ${
                        buybackPos
                          ? "text-nvg-green border-nvg-green/30 bg-nvg-green/5"
                          : "text-danger border-danger/30 bg-danger/5"
                      }`}
                    >
                      BUY {formatPercent(item.buybackRatio * 100)}
                    </span>
                  )}
                </div>

                {item.bestTraderBuy && (
                  <div className="flex items-center gap-1.5 mt-auto">
                    <img
                      src={`/images/traders/eft/${item.bestTraderBuy.vendorNormalizedName}.webp`}
                      alt={item.bestTraderBuy.vendorName}
                      width={16}
                      height={16}
                      className="w-4 h-4 object-cover grayscale opacity-60"
                    />
                    <p className="font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">
                      {item.bestTraderBuy.vendorName} · {formatPrice(item.bestTraderBuy.price)}
                    </p>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 h-px bg-(--primary) opacity-0 group-hover:opacity-40" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
