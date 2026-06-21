import { formatCompactNumber } from '@/lib/formatters';
import type { VendorOffer } from './ItemModules';

interface ItemPriceBlockProps {
  buyFor?: VendorOffer[];
  sellFor?: VendorOffer[];
}

const isFlea = (v: { normalizedName?: string; name: string }) =>
  v.normalizedName === 'flea-market' || v.name === 'Flea Market';

function PriceCell({
  label,
  price,
  vendor,
  highlight,
}: {
  label: string;
  price: number | null;
  vendor?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded border border-lines-hover bg-(--color-card-menu) p-3">
      <span className="font-blender-medium text-type-caption uppercase tracking-widest text-(--text-muted)">
        {label}
      </span>
      {price && price > 0 ? (
        <div className="flex flex-col gap-0.5">
          <span
            className={`font-blender-medium text-base leading-none ${
              highlight ? 'text-(--primary)' : 'text-text-primary'
            }`}
          >
            {formatCompactNumber(price)} ₽
          </span>
          {vendor && (
            <span className="font-blender-book text-type-caption text-(--text-muted)">
              {vendor}
            </span>
          )}
        </div>
      ) : (
        <span className="font-blender-book text-sm text-(--text-muted)">—</span>
      )}
    </div>
  );
}

export function ItemPriceBlock({ buyFor = [], sellFor = [] }: ItemPriceBlockProps) {
  const traderBuys = buyFor.filter((b) => !isFlea(b.vendor));
  const fleaBuy = buyFor.find((b) => isFlea(b.vendor));

  const traderSells = sellFor.filter((s) => !isFlea(s.vendor));
  const fleaSell = sellFor.find((s) => isFlea(s.vendor));

  const bestTraderBuy = traderBuys.length > 0
    ? traderBuys.reduce((min, curr) =>
        (curr.priceRUB ?? curr.price) < (min.priceRUB ?? min.price) ? curr : min
      )
    : null;

  const bestTraderSell = traderSells.length > 0
    ? traderSells.reduce((max, curr) =>
        (curr.priceRUB ?? curr.price) > (max.priceRUB ?? max.price) ? curr : max
      )
    : null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <PriceCell
        label="Купить у торговца"
        price={bestTraderBuy ? (bestTraderBuy.priceRUB ?? bestTraderBuy.price) : null}
        vendor={bestTraderBuy?.vendor.name}
      />
      <PriceCell
        label="Купить на барахолке"
        price={fleaBuy ? (fleaBuy.priceRUB ?? fleaBuy.price) : null}
        vendor="Барахолка"
      />
      <PriceCell
        label="Продать торговцу"
        price={bestTraderSell ? (bestTraderSell.priceRUB ?? bestTraderSell.price) : null}
        vendor={bestTraderSell?.vendor.name}
        highlight
      />
      <PriceCell
        label="Продать на барахолке"
        price={fleaSell ? (fleaSell.priceRUB ?? fleaSell.price) : null}
        vendor="Барахолка"
      />
    </div>
  );
}
