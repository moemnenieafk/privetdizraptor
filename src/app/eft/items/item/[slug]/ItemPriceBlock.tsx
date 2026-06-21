import { formatCompactNumber } from '@/lib/formatters';
import { VendorImage } from './ItemImage';
import type { VendorOffer } from './ItemModules';

interface ItemPriceBlockProps {
  buyFor?: VendorOffer[];
  sellFor?: VendorOffer[];
}

const isFlea = (v: { normalizedName?: string; name: string }) =>
  v.normalizedName === 'flea-market' || v.name === 'Flea Market';

function VendorPortrait({ normalizedName, name, flea }: { normalizedName?: string; name?: string; flea?: boolean }) {
  if (flea) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs border border-yellow-500/20 bg-yellow-500/10 shadow-inner">
        <span className="icon-eft-currency-ruble h-4 w-4 bg-yellow-500/70 mask-contain mask-center mask-no-repeat" />
      </div>
    );
  }
  if (!normalizedName) return null;
  return (
    <VendorImage
      normalizedName={normalizedName}
      name={name ?? ''}
      className="h-8 w-8 shrink-0 rounded-xs border border-lines-hover/50 object-cover"
    />
  );
}

function PriceCell({
  label,
  price,
  vendorName,
  vendorNormalizedName,
  flea,
  highlight,
}: {
  label: string;
  price: number | null;
  vendorName?: string;
  vendorNormalizedName?: string;
  flea?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-lines-hover bg-card-menu p-3">
      <span className="font-blender-medium text-type-caption uppercase tracking-widest text-(--text-muted)">
        {label}
      </span>
      {price && price > 0 ? (
        <div className="flex items-center gap-2">
          <VendorPortrait normalizedName={vendorNormalizedName} name={vendorName} flea={flea} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={`font-blender-medium text-base leading-none ${
                highlight ? 'text-(--primary)' : 'text-text-primary'
              }`}
            >
              {formatCompactNumber(price)} ₽
            </span>
            {vendorName && (
              <span className="truncate font-blender-book text-type-caption text-(--text-muted)">
                {vendorName}
              </span>
            )}
          </div>
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
        vendorName={bestTraderBuy?.vendor.name}
        vendorNormalizedName={bestTraderBuy?.vendor.normalizedName}
      />
      <PriceCell
        label="Купить на барахолке"
        price={fleaBuy ? (fleaBuy.priceRUB ?? fleaBuy.price) : null}
        vendorName="Барахолка"
        flea
      />
      <PriceCell
        label="Продать торговцу"
        price={bestTraderSell ? (bestTraderSell.priceRUB ?? bestTraderSell.price) : null}
        vendorName={bestTraderSell?.vendor.name}
        vendorNormalizedName={bestTraderSell?.vendor.normalizedName}
        highlight
      />
      <PriceCell
        label="Продать на барахолке"
        price={fleaSell ? (fleaSell.priceRUB ?? fleaSell.price) : null}
        vendorName="Барахолка"
        flea
      />
    </div>
  );
}
