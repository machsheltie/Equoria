/**
 * Feed catalog (economy / feedShop).
 *
 * Equoria-q4uem.4 (WS4 S4, controller ruling 1b): moved verbatim out of
 * controllers/feedShopController.mjs so the economy barrel can export the catalog
 * without exporting an HTTP controller file. Consumers: horses feed controller and
 * feed service (via the barrel), the feed-shop controller itself.
 *
 * News (Equoria-wbt8l): an item added after launch carries
 * `addedOn: 'YYYY-MM-DD'` (its Eastern game date); the nightly News pass
 * announces it under New Items that day. Launch items carry none.
 */

// 5-tier feed catalog (feed-system redesign 2026-04-29).
// All packs sold in 100-unit increments only. Per spec §5.5.
export const FEED_CATALOG = [
  {
    id: 'basic',
    name: 'Basic Feed',
    description: 'Standard hay-and-grain mix. Prevents the no-feed penalty. No bonus.',
    packPrice: 100,
    perUnit: 1.0,
    statRollPct: 0,
    pregnancyBonusPct: 0,
  },
  {
    id: 'performance',
    name: 'Performance Feed',
    description:
      'Active-rider blend with electrolytes. 10% chance per feeding to boost a random stat by 1.',
    packPrice: 125,
    perUnit: 1.25,
    statRollPct: 10,
    pregnancyBonusPct: 5,
  },
  {
    id: 'performancePlus',
    name: 'Performance Plus Feed',
    description: 'Enriched protein blend. 15% chance per feeding to boost a random stat by 1.',
    packPrice: 150,
    perUnit: 1.5,
    statRollPct: 15,
    pregnancyBonusPct: 10,
  },
  {
    id: 'highPerformance',
    name: 'High Performance Feed',
    description: 'Competition-grade nutrition. 20% chance per feeding to boost a random stat by 1.',
    packPrice: 175,
    perUnit: 1.75,
    statRollPct: 20,
    pregnancyBonusPct: 15,
  },
  {
    id: 'elite',
    name: 'Elite Feed',
    description: 'Top-tier specialised blend. 25% chance per feeding to boost a random stat by 1.',
    packPrice: 200,
    perUnit: 2.0,
    statRollPct: 25,
    pregnancyBonusPct: 20,
  },
];
