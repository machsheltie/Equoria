/**
 * The environmental trigger analysis characterization grid (Equoria-q4uem.7 S4).
 *
 * buildTriggerFixtures(prisma, token) creates owned fixtures in the real test
 * DB: one owner, two grooms (one 'calm' influence), and foals of chosen ages
 * and bond with chosen interaction histories. runTriggerGrid(api, fx)
 * calls every analysis for every foal (and for a horse that does not exist) and
 * returns { caseKey -> normalized output }; normalization replaces ids, the
 * fixture clock and interaction timestamps with stable labels, so the outputs
 * are comparable across runs. The golden digests were recorded from the pre-S4
 * per-function API (439e793d6..b69fd4af4 line) through this same grid.
 *
 * The outputs here are mostly UNROUNDED (thresholds, exposure),
 * so the order of every multiplication and sum reaches the digests: the grid
 * varies age and bond together so the threshold
 * products all vary.
 *
 * api = async { detect(id), thresholds(id), exposure(id), report(id) }
 */

import { createHash } from 'node:crypto';
import { gameCalendarDate } from '../../../../utils/gameTime.mjs';
import { testHorseData } from '../../../../__tests__/helpers/createTestHorse.mjs';

const DAY = 24 * 60 * 60 * 1000;

// Interaction histories: [daysAgo, groom (0 calm | 1 other), fields]
const HISTORIES = {
  none: [],
  harsh: [
    [2, 1, { bondingChange: -2, quality: 'poor', duration: 10, taskType: 'bathing' }],
    [5, 0, { bondingChange: -1, quality: 'poor', duration: 12, taskType: 'bathing' }],
    [9, 1, { bondingChange: 0, quality: 'fair', duration: 20, taskType: 'feeding' }],
    [14, 1, { bondingChange: -2, quality: 'poor', duration: 14, taskType: 'feeding' }],
  ],
  confident: [
    [
      1,
      0,
      {
        bondingChange: 3,
        quality: 'excellent',
        duration: 45,
        taskType: 'trustBuilding',
        interactionType: 'enrichment',
      },
    ],
    [
      3,
      0,
      {
        bondingChange: 2,
        quality: 'excellent',
        duration: 40,
        taskType: 'desensitization',
        interactionType: 'enrichment',
      },
    ],
    [
      6,
      0,
      {
        bondingChange: 2,
        quality: 'good',
        duration: 35,
        taskType: 'showgroundExposure',
      },
    ],
    [11, 1, { bondingChange: 1, quality: 'good', duration: 31, taskType: 'grooming' }],
    [
      18,
      0,
      {
        bondingChange: 3,
        quality: 'excellent',
        duration: 60,
        taskType: 'desensitization',
        interactionType: 'enrichment',
      },
    ],
    [24, 1, { bondingChange: 0, quality: 'fair', duration: 25, taskType: 'feeding' }],
  ],
  mixed: [
    [
      1,
      1,
      {
        bondingChange: 3,
        quality: 'excellent',
        duration: 50,
        taskType: 'desensitization',
      },
    ],
    [
      4,
      0,
      {
        bondingChange: -2,
        quality: 'poor',
        duration: 8,
        taskType: 'showgroundExposure',
      },
    ],
    [
      8,
      1,
      {
        bondingChange: 1,
        quality: 'good',
        duration: 30,
        taskType: 'grooming',
        interactionType: 'enrichment',
      },
    ],
    [
      13,
      0,
      {
        bondingChange: 2,
        quality: 'good',
        duration: 16,
        taskType: 'trustBuilding',
      },
    ],
    [20, 1, { bondingChange: -1, quality: 'poor', duration: 14, taskType: 'bathing' }],
    [27, 0, { bondingChange: 0, quality: 'fair', duration: 33, taskType: 'feeding' }],
    [
      29,
      1,
      {
        bondingChange: 2,
        quality: 'excellent',
        duration: 22,
        taskType: 'desensitization',
      },
    ],
    [31, 0, { bondingChange: -3, quality: 'poor', duration: 9, taskType: 'bathing' }],
    [
      45,
      1,
      {
        bondingChange: 3,
        quality: 'excellent',
        duration: 70,
        taskType: 'trustBuilding',
      },
    ],
    [60, 0, { bondingChange: 1, quality: 'good', duration: 26, taskType: 'grooming' }],
    [75, 1, { bondingChange: 0, quality: 'fair', duration: 18, taskType: 'feeding' }],
  ],
  sparse: [[3, 1, { bondingChange: -2, quality: 'fair', duration: 9, taskType: 'grooming' }]],
  // Three interactions share one createdAt (`tie`): their order is decided by
  // id (insertion order), which the snapshot reads explicitly.
  tied: [
    [
      2,
      0,
      {
        bondingChange: -1,
        quality: 'poor',
        duration: 12,
        taskType: 'bathing',
        tie: true,
      },
    ],
    [
      2,
      1,
      {
        bondingChange: 3,
        quality: 'excellent',
        duration: 40,
        taskType: 'desensitization',
        tie: true,
      },
    ],
    [
      2,
      0,
      {
        bondingChange: 1,
        quality: 'good',
        duration: 31,
        taskType: 'grooming',
        interactionType: 'enrichment',
        tie: true,
      },
    ],
    [
      5,
      1,
      {
        bondingChange: 2,
        quality: 'excellent',
        duration: 22,
        taskType: 'showgroundExposure',
      },
    ],
    [9, 0, { bondingChange: -2, quality: 'poor', duration: 9, taskType: 'bathing' }],
    [
      12,
      1,
      {
        bondingChange: 3,
        quality: 'excellent',
        duration: 65,
        taskType: 'trustBuilding',
      },
    ],
  ],
};

// [key, ageDays, bondScore, history]
const FOALS = [
  ['newborn-calm', 2, 0, 'none'],
  ['newborn-harsh', 2, 5, 'harsh'],
  ['fear1', 9, 15, 'harsh'],
  ['fear1-bonded', 10, 40, 'confident'],
  ['curious', 20, 25, 'mixed'],
  ['social', 45, 0, 'mixed'],
  ['social-bonded', 50, 50, 'confident'],
  ['independent', 75, 30, 'sparse'],
  ['independent-late', 100, 10, 'harsh'],
  ['residual', 125, 20, 'mixed'],
  ['minimal', 160, 45, 'confident'],
  ['mature', 400, 35, 'mixed'],
  ['tied', 30, 20, 'tied'],
];

export async function buildTriggerFixtures(prisma, token, colour) {
  const now = Date.now();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `envtrig-${token}@test.com`,
      username: `envtrig${token}`,
      password: 'irrelevant-hash',
      firstName: 'Env',
      lastName: 'Trigger',
      money: 0,
    },
  });
  const grooms = [];
  for (const [i, influence] of ['calm', 'energetic'].entries()) {
    grooms.push(
      await prisma.groom.create({
        data: {
          name: `EnvTrig Groom ${i} ${token}`,
          speciality: 'foalCare',
          personality: influence === 'calm' ? 'calm' : 'energetic',
          epigeneticInfluenceType: influence,
          skillLevel: i === 0 ? 'expert' : 'novice',
          userId: user.id,
        },
      }),
    );
  }
  const labels = new Map();
  const horses = [];
  for (const [key, ageDays, bondScore, history] of FOALS) {
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...colour(),
        name: `TestFixture-EnvTrig-${key}-${token}`,
        sex: 'Filly',
        // A @db.Date column: store the Eastern game-calendar date ageDays back,
        // which is how getHorseAgeDays counts age, at any run time.
        dateOfBirth: gameCalendarDate(new Date(now), -ageDays),
        age: 0,
        userId: user.id,
        bondScore,
      }),
    });
    horses.push([key, horse.id]);
    labels.set(`horse:${horse.id}`, key);
    for (const [n, [daysAgo, g, fields]] of HISTORIES[history].entries()) {
      const createdAt = new Date(now - daysAgo * DAY - (fields.tie ? 1 : n + 1) * 60 * 1000);
      await prisma.groomInteraction.create({
        data: {
          interactionType: fields.interactionType ?? 'dailyCare',
          duration: fields.duration,
          bondingChange: fields.bondingChange,
          quality: fields.quality,
          taskType: fields.taskType,
          foalId: horse.id,
          groomId: grooms[g].id,
          createdAt,
          timestamp: createdAt,
        },
      });
      labels.set(`date:${createdAt.getTime()}`, `${history}#${n}`);
    }
  }
  grooms.forEach((groom, i) => labels.set(`groom:${groom.id}`, `groom${i}`));
  return { user, grooms, horses, labels };
}

export async function cleanupTriggerFixtures(prisma, fx) {
  const ids = fx.horses.map(([, id]) => id);
  await prisma.groomInteraction.deleteMany({ where: { foalId: { in: ids } } });
  await prisma.horse.deleteMany({ where: { id: { in: ids } } });
  await prisma.groom.deleteMany({ where: { id: { in: fx.grooms.map(g => g.id) } } });
  await prisma.user.deleteMany({ where: { id: fx.user.id } });
}

const MISSING_HORSE_ID = 2000000001;

function normalize(value, labels, key = '') {
  // Prisma returns Dates from another realm under the Jest VM: test the tag, not instanceof.
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return labels.get(`date:${value.getTime()}`) ?? '<now>';
  }
  if (Array.isArray(value)) {
    return value.map(v => normalize(v, labels));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v, labels, k)]));
  }
  if (typeof value === 'number' && (key === 'horseId' || key === 'foalId')) {
    return labels.get(`horse:${value}`) ?? (value === MISSING_HORSE_ID ? '<missing>' : value);
  }
  if (typeof value === 'number' && key === 'groomId') {
    return labels.get(`groom:${value}`) ?? value;
  }
  return value;
}

async function settle(fn) {
  try {
    return { ok: await fn() };
  } catch (error) {
    return {
      error: `${error.constructor.name}: ${String(error.message).replace(/\d{6,}/g, '<id>')}`,
    };
  }
}

export async function runTriggerGrid(api, fx) {
  const out = {};
  const subjects = [...fx.horses, ['missing', MISSING_HORSE_ID]];
  for (const [key, id] of subjects) {
    const record = async (kind, fn) => {
      out[`${kind}|${key}`] = normalize(await settle(fn), fx.labels);
    };
    await record('detect', () => api.detect(id));
    await record('thresholds', () => api.thresholds(id));
    await record('exposure', () => api.exposure(id));
    await record('report', () => api.report(id));
  }
  return out;
}

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

export function caseDigests(outputs) {
  return Object.fromEntries(
    Object.entries(outputs).map(([k, v]) => [
      k,
      createHash('sha256').update(canonicalJson(v)).digest('hex'),
    ]),
  );
}
