/**
 * The environmental engine characterization grid (Equoria-q4uem.7 S3).
 *
 * Pure: runGrid(api) calls the engine projections over a fixed grid of
 * dates, locations, horses and weather overrides and returns
 * { caseKey -> output }. The golden digests in environmentalEngine.golden.json
 * were recorded from the pre-S3 engine (HEAD 439e793d6) through the same grid,
 * so a changed number, order or text anywhere in the grid fails the
 * characterization test.
 *
 * Time-zone safety: the engine's day-of-year stepping uses LOCAL
 * time, so every instant is at 06:00, 12:00 or 18:00 UTC (the same calendar
 * day in UTC and in US time zones) and no date range crosses a DST change.
 * That keeps the digests equal on an Eastern-time laptop and on UTC CI.
 *
 * api = { weather(d, l), seasonal(d), comfort(h), triggers(d, l, h, w),
 *         impact(d, l, h, w), history(s, e, l) }
 */

import { createHash } from 'node:crypto';

const at = (day, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00.000Z`);

// Day-of-year edges in 2025: 79/80 spring start, 90, 171/172 summer, 265/266
// autumn, 354/355 winter; plus mid-season days and the year wrap.
export const DATES = [
  ['mid-winter', at('2025-01-15')],
  ['mid-spring', at('2025-04-15')],
  ['mid-summer', at('2025-07-15')],
  ['mid-autumn', at('2025-10-15')],
  ['doy79', at('2025-03-20')],
  ['doy80', at('2025-03-21')],
  ['doy90', at('2025-03-31')],
  ['doy171', at('2025-06-20')],
  ['doy172', at('2025-06-21')],
  ['doy265', at('2025-09-22')],
  ['doy266', at('2025-09-23')],
  ['doy354', at('2025-12-20')],
  ['doy355', at('2025-12-21')],
  ['wrap-jan3', at('2025-01-03')],
  ['wrap-dec25', at('2025-12-25')],
  ['mid-summer-0600', at('2025-07-15', 6)],
  ['mid-summer-1800', at('2025-07-15', 18)],
];

const REGIONS = ['tropical', 'temperate', 'arctic', 'desert', 'coastal', 'unknown'];
const ELEVATIONS = [0, 1500];
export const LOCATIONS = REGIONS.flatMap(region =>
  ELEVATIONS.map(elevation => [
    `${region}@${elevation}`,
    {
      latitude: region === 'arctic' ? 70 : region === 'tropical' ? 5 : 40,
      longitude: -74,
      region,
      elevation,
    },
  ]),
);

const TRAIT_SETS = [
  [],
  ['heat_tolerant'],
  ['cold_tolerant', 'hardy'],
  ['nervous', 'sensitive'],
  ['desert_adapted', 'heat_sensitive'],
  ['calm', 'resilient', 'adaptable'],
  // Sets that put 3, 4 and 5 factors into one product (triggers, impact).
  ['calm', 'nervous', 'hardy', 'sensitive', 'resilient'],
  ['nervous', 'hardy', 'sensitive', 'resilient'],
  ['calm', 'hardy', 'resilient'],
  ['calm', 'nervous', 'cold_tolerant', 'hardy'],
  ['nervous', 'heat_tolerant', 'hardy', 'adaptable', 'sensitive'],
  ['adaptable', 'sensitive', 'cold_tolerant'],
];
const AGE_HEALTH = [
  [3, 50],
  [10, 70],
  [18, 90],
];
export const HORSES = TRAIT_SETS.flatMap(traits =>
  AGE_HEALTH.map(([age, health]) => [
    `${traits.join('+') || 'none'}|a${age}|h${health}`,
    { id: 1, traits, age, health },
  ]),
);

const OVERRIDES = [
  ['none', null],
  [
    'stormy',
    {
      temperature: 18,
      humidity: 90,
      precipitation: 0.9,
      windSpeed: 30,
      pressure: 1000,
      conditions: 'stormy',
      timestamp: 'override',
      location: 'override',
    },
  ],
  [
    'rainy',
    {
      temperature: 12,
      humidity: 80,
      precipitation: 0.6,
      windSpeed: 12,
      pressure: 1008,
      conditions: 'rainy',
      timestamp: 'override',
      location: 'override',
    },
  ],
  [
    'hot-humid',
    {
      temperature: 36,
      humidity: 88,
      precipitation: 0.2,
      windSpeed: 4,
      pressure: 1010,
      conditions: 'sunny',
      timestamp: 'override',
      location: 'override',
    },
  ],
  [
    'frozen',
    {
      temperature: -8,
      humidity: 40,
      precipitation: 0.1,
      windSpeed: 26,
      pressure: 1020,
      conditions: 'cloudy',
      timestamp: 'override',
      location: 'override',
    },
  ],
  [
    'cold-storm',
    {
      temperature: -6,
      humidity: 40,
      precipitation: 0.9,
      windSpeed: 26,
      pressure: 1020,
      conditions: 'stormy',
      timestamp: 'override',
      location: 'override',
    },
  ],
];

const HORSE_DATES = ['mid-winter', 'mid-summer', 'doy80', 'doy355', 'mid-summer-1800'];
const HORSE_LOCATIONS = ['temperate@0', 'desert@1500', 'arctic@0', 'tropical@0', 'unknown@1500'];

export function runGrid(api) {
  const out = {};
  const date = Object.fromEntries(DATES);
  const loc = Object.fromEntries(LOCATIONS);

  for (const [dk, d] of DATES) {
    out[`seasonal|${dk}`] = api.seasonal(d);
    for (const [lk, l] of LOCATIONS) {
      out[`weather|${dk}|${lk}`] = api.weather(d, l);
    }
  }
  for (const [hk, h] of HORSES) {
    out[`comfort|${hk}`] = api.comfort(h);
  }
  for (const dk of HORSE_DATES) {
    for (const lk of HORSE_LOCATIONS) {
      for (const [hk, h] of HORSES) {
        for (const [ok, w] of OVERRIDES) {
          const key = `${dk}|${lk}|${hk}|${ok}`;
          out[`triggers|${key}`] = api.triggers(date[dk], loc[lk], h, w);
          out[`impact|${key}`] = api.impact(date[dk], loc[lk], h, w);
        }
      }
    }
  }
  // History windows stay inside one DST regime (see header). Forecast cases were
  // removed with the forecast (owner ruling 2026-10-07, Equoria-huuaf).
  for (const [rk, s, e] of [
    ['jan', at('2025-01-05'), at('2025-01-12')],
    ['jul', at('2025-07-01'), at('2025-07-03')],
    ['dec', at('2025-12-18'), at('2025-12-24', 18)],
  ]) {
    for (const lk of ['temperate@0', 'arctic@1500']) {
      out[`history|${rk}|${lk}`] = api.history(s, e, loc[lk]);
    }
  }
  return out;
}

/** Canonical JSON: object keys sorted at every level; numbers as JSON prints them. */
export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The group a case belongs to: kind + date + location for horse cases, kind + date for weather. */
export function groupOf(caseKey) {
  const parts = caseKey.split('|');
  if (['triggers', 'impact'].includes(parts[0])) {
    return parts.slice(0, 3).join('|');
  }
  if (['seasonal', 'comfort'].includes(parts[0])) {
    return parts[0];
  }
  return parts.slice(0, 2).join('|');
}

/** { group -> sha256 of the canonical JSON of its cases, in grid order } */
export function groupDigests(outputs) {
  const groups = {};
  for (const [key, value] of Object.entries(outputs)) {
    const g = groupOf(key);
    groups[g] = groups[g] ?? [];
    groups[g].push(`${JSON.stringify(key)}:${canonicalJson(value)}`);
  }
  return Object.fromEntries(
    Object.entries(groups).map(([g, items]) => [
      g,
      createHash('sha256')
        .update(items.join(String.fromCharCode(10)))
        .digest('hex'),
    ]),
  );
}

/**
 * Trait-factor product cases: every subset of each factor table's traits under
 * each condition context. The engine's outputs are rounded before they leave
 * it, so the order in which a product is multiplied is invisible in the grid
 * above (a search of 929,280 inputs found no output that changes when the
 * tables are reversed); these cases pin the unrounded products themselves.
 */
const subsets = items => items.reduce((acc, item) => acc.concat(acc.map(s => [...s, item])), [[]]);

export const TRAIT_PRODUCT_CASES = [
  ...subsets(['calm', 'nervous', 'heat_tolerant', 'cold_tolerant', 'hardy']).flatMap(traits =>
    [
      [],
      ['storm'],
      ['extremeHeat'],
      ['extremeCold', 'storm'],
      ['extremeHeat', 'strong_wind', 'storm'],
      ['wet_conditions'],
    ].map(triggers => ({ table: 'trigger', traits, triggers })),
  ),
  ...subsets(['adaptable', 'sensitive', 'heat_tolerant', 'cold_tolerant']).flatMap(traits =>
    [35, 30, 20, 10, -5].map(temperature => ({
      table: 'impact',
      traits,
      weather: { temperature },
    })),
  ),
].map(c => ({
  ...c,
  key: [
    c.table,
    c.traits.join('+') || 'none',
    (c.triggers ?? []).join('+'),
    c.weather?.temperature ?? '',
  ].join('|'),
}));
