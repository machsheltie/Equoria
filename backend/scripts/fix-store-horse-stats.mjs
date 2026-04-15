/**
 * One-time fix: store horses created before the createHorse fix had stamina, balance,
 * boldness, flexibility, obedience, and focus silently dropped (saved as 0).
 *
 * This script finds horses where ALL SIX of those stats are 0 (the bug signature),
 * looks up the breed's starter_stats from the DB, and sets each stat to the breed mean.
 *
 * Run once: node backend/scripts/fix-store-horse-stats.mjs
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

const STAT_KEYS_TO_FIX = ['stamina', 'balance', 'boldness', 'flexibility', 'obedience', 'focus'];

async function main() {
  // Find horses where all 6 affected stats are 0 — strong signal of the bug
  const buggedHorses = await prisma.horse.findMany({
    where: {
      stamina: 0,
      balance: 0,
      boldness: 0,
      flexibility: 0,
      obedience: 0,
      focus: 0,
    },
    include: { breed: true },
  });

  if (buggedHorses.length === 0) {
    console.log('No horses with the missing-stat bug found. Nothing to fix.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${buggedHorses.length} horse(s) with missing stats — fixing...`);

  for (const horse of buggedHorses) {
    const profile = horse.breed?.breedGeneticProfile;
    const starterStats = profile?.starter_stats ?? null;

    const updates = {};
    for (const stat of STAT_KEYS_TO_FIX) {
      if (starterStats?.[stat]) {
        const { mean, std_dev } = starterStats[stat];
        // Apply same Box-Muller variance as the store, capped 1–20
        const z = (Math.random() + Math.random() - 1) * 1.41;
        updates[stat] = Math.max(1, Math.min(20, Math.round(mean + std_dev * z)));
      } else {
        // No breed profile — assign a neutral starter value
        updates[stat] = 12 + Math.floor(Math.random() * 5);
      }
    }

    // Enforce 200 total after fix
    const currentOtherTotal =
      (horse.speed ?? 0) +
      (horse.agility ?? 0) +
      (horse.precision ?? 0) +
      (horse.intelligence ?? 0) +
      (horse.strength ?? 0) +
      (horse.endurance ?? 0);
    const fixedTotal = Object.values(updates).reduce((s, v) => s + v, 0);
    const grandTotal = currentOtherTotal + fixedTotal;

    let finalUpdates = { ...updates };
    if (grandTotal > 200) {
      const budget = 200 - currentOtherTotal;
      const factor = budget / fixedTotal;
      finalUpdates = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, Math.max(1, Math.round(v * factor))]),
      );
    }

    await prisma.horse.update({
      where: { id: horse.id },
      data: finalUpdates,
    });

    const statLine = Object.entries(finalUpdates)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    console.log(
      `  ✓ ${horse.name} (ID ${horse.id}, ${horse.breed?.name ?? 'unknown breed'}): ${statLine}`,
    );
  }

  console.log('\nDone. All affected horses have been updated.');
  await prisma.$disconnect();
}

main().catch(err => {
  logger.error('fix-store-horse-stats failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
