export const TRADER_SLUG: Record<string, string> = { 'btr-driver': 'btrdriver' };
export const traderImg = (n: string) => `/images/traders/eft/${TRADER_SLUG[n] ?? n}.webp`;
export const traderCssVar = (n: string) => `--trader-${TRADER_SLUG[n] ?? n}`;
