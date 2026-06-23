import type { TarkovContextData } from "@/actions/tarkov-context";
import { TraderCountdown } from "./TraderCountdown";

interface ActiveContextBarProps {
  data: TarkovContextData;
}

export function ActiveContextBar({ data }: ActiveContextBarProps) {
  const { serverOnline, serverLabel, fleaItems, nearestTrader } = data;

  return (
    <div className="sticky top-0 z-40 w-full border-b border-lines-hover bg-base/95 backdrop-blur-sm">
      <div className="flex h-9 items-stretch divide-x divide-lines-hover max-w-480 mx-auto px-4 md:px-8">

        {/* LEFT — Server status */}
        <div className="flex items-center gap-2 pr-4 shrink-0 w-40 md:w-48">
          <span
            className={`shrink-0 w-1.5 h-1.5 ${serverOnline ? "bg-nvg-green" : "bg-danger"}`}
            aria-hidden
          />
          <span className="font-blender-medium text-type-caption tracking-[0.25em] uppercase text-text-secondary truncate">
            {serverLabel}
          </span>
          <span
            className={`font-blender-medium text-type-caption tracking-[0.2em] uppercase shrink-0 ${
              serverOnline ? "text-nvg-green" : "text-danger"
            }`}
          >
            {serverOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* CENTER — Flea market ticker */}
        <div className="flex-1 flex items-center px-4 overflow-hidden">
          {fleaItems.length > 0 ? (
            <div
              className="flex gap-8 whitespace-nowrap animate-[ticker-scroll_30s_linear_infinite]"
              style={{
                /* Double the list so the scroll loops seamlessly */
                width: "max-content",
              }}
            >
              {[...fleaItems, ...fleaItems].map((item, i) => {
                const isPositive = item.changeLast48hPercent >= 0;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 font-blender-medium text-type-caption tracking-[0.2em] uppercase"
                  >
                    <span className="text-text-secondary truncate max-w-32">{item.name}</span>
                    <span className={isPositive ? "text-nvg-green" : "text-danger"}>
                      {isPositive ? "+" : ""}
                      {item.changeLast48hPercent.toFixed(1)}%
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="font-blender-medium text-type-caption tracking-[0.2em] uppercase text-text-muted">
              ЗАГРУЗКА РЫНКА...
            </span>
          )}
        </div>

        {/* RIGHT — Trader reset timer */}
        <div className="flex items-center pl-4 shrink-0 w-40 md:w-48">
          {nearestTrader ? (
            <TraderCountdown
              traderName={nearestTrader.name}
              resetTime={nearestTrader.resetTime}
            />
          ) : (
            <span className="font-blender-medium text-type-caption tracking-[0.2em] uppercase text-text-muted">
              ТАЙМЕРЫ N/A
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
