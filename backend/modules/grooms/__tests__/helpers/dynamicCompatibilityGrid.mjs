/**
 * The dynamic compatibility characterization grid (Equoria-q4uem.7 S6, real DB).
 *
 * buildCompatibilityFixtures(prisma, token, colour) creates owned fixtures: an
 * owner with five grooms (calm, an expert calm, energetic, methodical,
 * balanced) and horses of chosen bond; a
 * second owner whose only groom has an unknown personality type; a third owner
 * with a horse and no grooms. Interaction histories sit inside and outside the
 * 14-day history window, at most 10 per pair inside it (which 10 of more is
 * unspecified today: Equoria-ld219), and give trends 0 to 7 data points.
 * Births are Eastern game-calendar dates (the column is @db.Date).
 *
 * runCompatibilityGrid(api, fx) calls every analysis for every groom/horse pair
 * (missing ids included) under every context, and recommendations for every
 * horse, returning { caseKey -> normalized output }. Contexts multiply 3 to 5
 * environmental factors into one product, so product order reaches the
 * unrounded scores.
 *
 * api = async { compatibility(g, h, ctx), factors(g, h), prediction(g, h, ctx),
 *               recommendations(h, ctx), trends(g, h) }
 */

import { createHash } from 'node:crypto';
import { gameCalendarDate } from '../../../../utils/gameTime.mjs';
import {
  loadCompatibilityInputs,
  rankGrooms,
} from '../../services/dynamicCompatibilityScoring.mjs';

/**
 * Call helpers for tests (Equoria-q4uem.7 S6): load one input set, then project.
 * analyzePair(groomId, horseId, projection, ...rest) loads the horse with that
 * groom; rankFor(horseId, context) loads the horse with its owner's grooms.
 * Both are async, so a projection's error is a rejected promise.
 */
export const analyzePair = async (groomId, horseId, project, ...rest) =>
  project(await loadCompatibilityInputs(horseId, { groomIds: [groomId] }), groomId, ...rest);
export const rankFor = async (horseId, context) =>
  rankGrooms(await loadCompatibilityInputs(horseId, { ownerGrooms: true }), context);

const DAY = 24 * 60 * 60 * 1000;

export const CONTEXTS = [
  [
    'morning-quiet',
    {
      taskType: 'trustBuilding',
      timeOfDay: 'morning',
      environmentalFactors: ['quiet', 'familiar', 'structured'],
      urgency: 'high',
    },
  ],
  [
    'evening-noisy',
    {
      taskType: 'desensitization',
      timeOfDay: 'evening',
      environmentalFactors: ['noisy', 'unfamiliar', 'chaotic', 'stimulating'],
    },
  ],
  ['afternoon-plain', { taskType: 'spongeBath', timeOfDay: 'afternoon' }],
  [
    'clamped-high',
    {
      taskType: 'showgroundExposure',
      environmentalFactors: ['quiet', 'quiet', 'familiar', 'familiar', 'structured'],
    },
  ],
  ['bad-task', { taskType: 'juggling', timeOfDay: 'morning' }],
  // The other four task types, with unknown and non-string factors and times:
  // only a string names a factor or a time of day (the original switches used ===).
  [
    'hoof-junk-factors',
    {
      taskType: 'hoofHandling',
      timeOfDay: 'night',
      environmentalFactors: ['quiet', 'windy', ['quiet'], 5, {}, 'chaotic'],
    },
  ],
  [
    'coat-array-time',
    { taskType: 'coatCheck', timeOfDay: ['morning'], environmentalFactors: ['familiar'] },
  ],
  ['tying-number-time', { taskType: 'tyingPractice', timeOfDay: 1 }],
  [
    'early-touch',
    {
      taskType: 'earlyTouch',
      timeOfDay: 'evening',
      environmentalFactors: ['structured', 'unfamiliar', 'noisy'],
    },
  ],
];
const PREDICTION_CONTEXTS = [
  'morning-quiet',
  'evening-noisy',
  'hoof-junk-factors',
  'coat-array-time',
];

// [key, influence, experience, level, owner]. `level` is the fixture's old 1-10 level,
// kept only to derive its skill word and session rate: grooms no longer store a level,
// and the compatibility level term is the old level 1 for every groom (owner rulings
// 2026-10-28, q229 and q244; the golden digests were re-recorded then, Equoria-2xxvd).
const GROOMS = [
  ['calm', 'calm', 30, 2, 'A'],
  ['calm-expert', 'calm', 220, 9, 'A'],
  ['energetic', 'energetic', 80, 4, 'A'],
  ['methodical', 'methodical', 150, 6, 'A'],
  ['balanced', 'balanced', 0, 1, 'A'],
  ['unknown-type', 'chaotic', 60, 3, 'B'],
  // Low experience + methodical, with the complex low-bond c-horse: two risk texts at once.
  ['methodical-novice', 'methodical', 20, 1, 'B'],
];

// [key, bondScore, owner]
// Owner ruling 2026-10-29 (q300, Equoria-efs4j): the epigeneticFlags store is
// dropped. These horses carried flags (the keys still name them so every case
// key is unchanged); now every horse is flagless like 'flagless' and every real
// horse. The golden digests of the cases that named a flagged horse were
// re-recorded from the PRE-removal code on these flagless fixtures, so the
// characterization proves the new code scores a flagless horse exactly as the
// old code did; every 'flagless' and 'missing' case kept its original digest.
const HORSES = [
  ['flagless', 10, 'A'],
  ['nervous', 12, 'A'],
  ['confident', 30, 'A'],
  ['reactive', 5, 'A'],
  ['mixed', 26, 'A'],
  ['b-horse', 20, 'B'],
  ['c-horse', 12, 'C'],
  // Once all-negative flags and no interactions (the temperament analysis said
  // 'nervous'); now a flagless low-bond horse with no interactions.
  ['anxious', 8, 'A'],
];

// Interaction histories per [groom, horse]: [daysAgo, fields]
const HISTORIES = [
  [
    'calm',
    'nervous',
    [
      [1, { quality: 'excellent', bondingChange: 3, duration: 40 }],
      [3, { quality: 'good', bondingChange: 2, duration: 30 }],
      [6, { quality: 'fair', bondingChange: 0, duration: 20 }],
      [10, { quality: 'good', bondingChange: 1, duration: 25 }],
      [20, { quality: 'poor', bondingChange: -2, duration: 10 }],
      [35, { quality: 'fair', bondingChange: 1, duration: 15 }],
      [50, { quality: 'poor', bondingChange: -1, duration: 12 }],
    ],
  ],
  [
    'energetic',
    'confident',
    [
      [2, { quality: 'good', bondingChange: 2, duration: 35 }],
      [4, { quality: 'excellent', bondingChange: 3, duration: 50 }],
      [16, { quality: 'fair', bondingChange: 1, duration: 22 }],
    ],
  ],
  [
    'methodical',
    'reactive',
    [
      [1, { quality: 'poor', bondingChange: -2, duration: 8 }],
      [5, { quality: 'poor', bondingChange: -1, duration: 9 }],
      [9, { quality: 'fair', bondingChange: 0, duration: 14 }],
      [13, { quality: 'good', bondingChange: 1, duration: 28 }],
    ],
  ],
  [
    'calm-expert',
    'mixed',
    [
      [3, { quality: 'excellent', bondingChange: 2, duration: 45 }],
      [30, { quality: 'good', bondingChange: 1, duration: 33 }],
    ],
  ],
];

export async function buildCompatibilityFixtures(prisma, token, colour) {
  const now = Date.now();
  const labels = new Map([[token, '<T>']]);
  const owners = {};
  for (const owner of ['A', 'B', 'C']) {
    owners[owner] = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `dyncompat-${owner}-${token}@test.com`,
        username: `dyncompat${owner}${token}`,
        password: 'irrelevant-hash',
        firstName: 'Dyn',
        lastName: `Compat${owner}`,
        money: 0,
      },
    });
  }
  const grooms = {};
  for (const [key, influence, experience, level, owner] of GROOMS) {
    grooms[key] = await prisma.groom.create({
      data: {
        name: `Compat Groom ${key} ${token}`,
        speciality: 'foalCare',
        personality: influence,
        epigeneticInfluenceType: influence,
        experience,
        skillLevel: level > 5 ? 'expert' : 'novice',
        sessionRate: 10 + level,
        userId: owners[owner].id,
      },
    });
    labels.set(`groom:${grooms[key].id}`, key);
  }
  const horses = {};
  for (const [key, bondScore, owner] of HORSES) {
    horses[key] = await prisma.horse.create({
      data: {
        ...colour(),
        name: `TestFixture-DynCompat-${key}-${token}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(now), -40),
        age: 0,
        userId: owners[owner].id,
        bondScore,
      },
    });
    labels.set(`horse:${horses[key].id}`, key);
  }
  for (const [g, h, entries] of HISTORIES) {
    for (const [n, [daysAgo, fields]] of entries.entries()) {
      // Inserted oldest-first per pair is not required; ids follow this order.
      const createdAt = new Date(now - daysAgo * DAY - (n + 1) * 60 * 1000);
      await prisma.groomInteraction.create({
        data: {
          interactionType: 'dailyCare',
          taskType: 'trustBuilding',
          ...fields,
          foalId: horses[h].id,
          groomId: grooms[g].id,
          createdAt,
          timestamp: createdAt,
        },
      });
    }
  }
  return { owners, grooms, horses, labels };
}

export async function cleanupCompatibilityFixtures(prisma, fx) {
  const horseIds = Object.values(fx.horses).map(h => h.id);
  const groomIds = Object.values(fx.grooms).map(g => g.id);
  await prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } });
  await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
  await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(fx.owners).map(o => o.id) } } });
}

const MISSING_GROOM_ID = 2000000002;
const MISSING_HORSE_ID = 2000000003;

// The only place the services' text names a row id: their "Groom not found:
// <id>" / "Horse not found: <id>" errors.
const idInText = /\b((?:Groom|Horse) not found: )(\d+)\b/g;

/**
 * Replace the fixture token and the ids a text names with stable labels.
 *
 * Equoria-94qvf: ids are relabeled ONLY where the text names one (idInText).
 * The old rule replaced every whole number equal to ANY fixture id anywhere in
 * the text. On a fresh lane database (small ids) a groom or horse whose id was
 * 72 turned "medium experience level with 72% trait strength" into "... with
 * <calm>% ..." and every factors case of the groom with that strength missed
 * its golden digest (2026-10-22: 'factors|energetic|*' in one lane,
 * 'factors|methodical-novice|*' in another; the same code passed alone because
 * the ids were different). The replacement for a named id is unchanged: the
 * groom label first, then the horse label (the old map order), and the two
 * missing ids keep their own labels.
 */
export function labelText(text, labels) {
  let out = text;
  for (const [key, label] of labels) {
    if (!key.startsWith('groom:') && !key.startsWith('horse:')) {
      out = out.split(key).join(label);
    }
  }
  return out.replace(idInText, (match, prefix, digits) => {
    const id = Number(digits);
    if (id === MISSING_GROOM_ID) {
      return `${prefix}<missing-groom>`;
    }
    if (id === MISSING_HORSE_ID) {
      return `${prefix}<missing-horse>`;
    }
    const label = labels.get(`groom:${id}`) ?? labels.get(`horse:${id}`);
    return label ? `${prefix}<${label}>` : match;
  });
}

function normalize(value, labels, key = '') {
  // Prisma returns Dates from another realm under the Jest VM: test the tag.
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return '<now>';
  }
  if (Array.isArray(value)) {
    return value.map(v => normalize(v, labels));
  }
  if (value && typeof value === 'object') {
    // Decimal (sessionRate) and other value objects print as their JSON text.
    if (typeof value.toJSON === 'function') {
      return normalize(value.toJSON(), labels, key);
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v, labels, k)]));
  }
  if (typeof value === 'number' && /^(groomId|horseId)$/.test(key)) {
    const kind = key === 'groomId' ? 'groom' : 'horse';
    if (value === MISSING_GROOM_ID || value === MISSING_HORSE_ID) {
      return `<missing-${kind}>`;
    }
    return labels.get(`${kind}:${value}`) ?? value;
  }
  if (typeof value === 'string') {
    return labelText(value, labels);
  }
  return value;
}

async function settle(fn) {
  try {
    return { ok: await fn() };
  } catch (error) {
    return { error: `${error.constructor.name}: ${error.message}` };
  }
}

export async function runCompatibilityGrid(api, fx) {
  const out = {};
  const grooms = [
    ...Object.entries(fx.grooms).map(([k, g]) => [k, g.id]),
    ['missing', MISSING_GROOM_ID],
  ];
  const horses = [
    ...Object.entries(fx.horses).map(([k, h]) => [k, h.id]),
    ['missing', MISSING_HORSE_ID],
  ];
  const contexts = Object.fromEntries(CONTEXTS);
  const record = async (key, fn) => {
    out[key] = normalize(await settle(fn), fx.labels);
  };
  for (const [gk, gid] of grooms) {
    for (const [hk, hid] of horses) {
      const pair = `${gk}|${hk}`;
      for (const [ck, ctx] of CONTEXTS) {
        await record(`compatibility|${pair}|${ck}`, () => api.compatibility(gid, hid, ctx));
      }
      for (const ck of PREDICTION_CONTEXTS) {
        await record(`prediction|${pair}|${ck}`, () => api.prediction(gid, hid, contexts[ck]));
      }
      await record(`factors|${pair}`, () => api.factors(gid, hid));
      await record(`trends|${pair}`, () => api.trends(gid, hid));
    }
  }
  for (const [hk, hid] of horses) {
    for (const [ck, ctx] of CONTEXTS) {
      await record(`recommendations|${hk}|${ck}`, () => api.recommendations(hid, ctx));
    }
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
