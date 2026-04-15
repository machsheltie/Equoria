/**
 * Targeted fix for horses purchased from the store that have stats outside the 1–20 range.
 * Finds horses owned by real users (not E2E test horses) that have any stat > 20,
 * confirms they're store-bought (age 3, no parents), and resets all 12 stats from
 * their breed's starter_stats using a raw DB query to bypass the outdated Prisma client.
 *
 * Run once: node backend/scripts/fix-purchased-horse-stats.mjs
 */

import prisma from '../db/index.mjs';

const STAT_KEYS = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'strength',
  'endurance',
];

function sampleStat({ mean, std_dev }) {
  const z = (Math.random() + Math.random() - 1) * 1.41;
  return Math.max(1, Math.min(20, Math.round(mean + std_dev * z)));
}

function generateFromProfile(starterStats) {
  const raw = Object.fromEntries(
    STAT_KEYS.map(k => {
      const p = starterStats[k];
      return [k, p ? sampleStat(p) : 12 + Math.floor(Math.random() * 5)];
    }),
  );
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  if (total > 200) {
    const factor = 200 / total;
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Math.max(1, Math.round(v * factor))]),
    );
  }
  return raw;
}

async function main() {
  // Find store-bought horses: age 3, no parents, any original stat > 20, not E2E test horses
  const horses = await prisma.$queryRawUnsafe(`
    SELECT h.id, h.name, h."breedId", h.speed, h.agility, h.precision, h.intelligence, h.strength, h.endurance,
           b.name as breed_name
    FROM horses h
    JOIN breeds b ON b.id = h."breedId"
    WHERE h.age = 3
      AND h."sireId" IS NULL
      AND h."damId" IS NULL
      AND h.name NOT LIKE 'E2E%'
      AND (h.speed > 20 OR h.agility > 20 OR h.precision > 20
           OR h.intelligence > 20 OR h.strength > 20 OR h.endurance > 20)
    ORDER BY h.id DESC
  `);

  if (horses.length === 0) {
    console.log('No over-statted store horses found. Nothing to fix.');
    await prisma.$disconnect();
    return;
  }

  console.log(
    `Found ${horses.length} store horse(s) with inflated stats — resetting to breed profile...\n`,
  );

  for (const horse of horses) {
    // Fetch breedGeneticProfile via raw query
    const [profileRow] = await prisma.$queryRawUnsafe(
      'SELECT "breedGeneticProfile" FROM breeds WHERE id = $1',
      horse.breedId,
    );
    const starterStats = profileRow?.breedGeneticProfile?.starter_stats ?? null;

    let newStats;
    if (starterStats) {
      newStats = generateFromProfile(starterStats);
    } else {
      // No breed profile: generate safe neutral stats
      newStats = Object.fromEntries(STAT_KEYS.map(k => [k, 12 + Math.floor(Math.random() * 5)]));
    }

    await prisma.horse.update({ where: { id: horse.id }, data: newStats });

    const total = Object.values(newStats).reduce((s, v) => s + v, 0);
    const statLine = STAT_KEYS.map(k => `${k.slice(0, 3).toUpperCase()}=${newStats[k]}`).join(' ');
    const profileSrc = starterStats ? horse.breed_name : 'neutral fallback';
    console.log(
      `  ✓ ${horse.name} (ID ${horse.id}, ${horse.breed_name}) — total ${total} [${profileSrc}]`,
    );
    console.log(`    ${statLine}`);
  }

  console.log('\nDone.');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Script failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
