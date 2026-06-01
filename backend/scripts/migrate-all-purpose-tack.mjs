/**
 * One-time migration: rename Training Saddle → All Purpose Saddle
 * and Standard Bridle → All Purpose Bridle across Horse.tack and
 * User.settings.inventory.
 *
 * Run from backend/ directory:
 *   node scripts/migrate-all-purpose-tack.mjs
 */

import prisma from '../../packages/database/prismaClient.mjs';

const SADDLE_OLD_IDS = new Set(['training-saddle', 'basic-all-purpose-saddle']);
const BRIDLE_OLD_IDS = new Set(['standard-bridle']);

const UNEXPECTED_BONUS_ABORT_THRESHOLD = 5; // any saddleBonus/bridleBonus > this is suspicious

let horsesUpdated = 0;
let usersUpdated = 0;

async function migrateHorseTack() {
  const horses = await prisma.horse.findMany({
    select: { id: true, tack: true },
  });

  for (const horse of horses) {
    const tack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    let changed = false;
    const updated = { ...tack };

    if (SADDLE_OLD_IDS.has(tack.saddle)) {
      if (
        typeof tack.saddleBonus === 'number' &&
        tack.saddleBonus > UNEXPECTED_BONUS_ABORT_THRESHOLD
      ) {
        console.error(
          `[ABORT] Horse ${horse.id} has saddleBonus=${tack.saddleBonus} — unexpected value. Aborting migration.`,
        );
        await prisma.$disconnect();
        process.exit(1);
      }
      updated.saddle = 'all-purpose-saddle';
      updated.saddleBonus = 5;
      changed = true;
    }

    if (BRIDLE_OLD_IDS.has(tack.bridle)) {
      if (
        typeof tack.bridleBonus === 'number' &&
        tack.bridleBonus > UNEXPECTED_BONUS_ABORT_THRESHOLD
      ) {
        console.error(
          `[ABORT] Horse ${horse.id} has bridleBonus=${tack.bridleBonus} — unexpected value. Aborting migration.`,
        );
        await prisma.$disconnect();
        process.exit(1);
      }
      updated.bridle = 'all-purpose-bridle';
      updated.bridleBonus = 5;
      changed = true;
    }

    if (changed) {
      await prisma.horse.update({ where: { id: horse.id }, data: { tack: updated } });
      horsesUpdated++;
    }
  }
}

async function migrateUserInventory() {
  const users = await prisma.user.findMany({
    select: { id: true, settings: true },
  });

  for (const user of users) {
    const settings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    const inventory = Array.isArray(settings.inventory) ? settings.inventory : [];

    let changed = false;
    const updatedInventory = inventory.map(item => {
      if (SADDLE_OLD_IDS.has(item.itemId)) {
        changed = true;
        return {
          ...item,
          itemId: 'all-purpose-saddle',
          name: 'All Purpose Saddle',
          bonus: '+5 all disciplines',
        };
      }
      if (BRIDLE_OLD_IDS.has(item.itemId)) {
        changed = true;
        return {
          ...item,
          itemId: 'all-purpose-bridle',
          name: 'All Purpose Bridle',
          bonus: '+5 all disciplines',
        };
      }
      return item;
    });

    if (changed) {
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { ...settings, inventory: updatedInventory } },
      });
      usersUpdated++;
    }
  }
}

async function main() {
  console.log('[migrate-all-purpose-tack] Starting migration...');
  await migrateHorseTack();
  await migrateUserInventory();
  console.log(
    `[migrate-all-purpose-tack] Migration complete. ${horsesUpdated} Horse record(s) updated, ${usersUpdated} User inventory record(s) updated.`,
  );
  await prisma.$disconnect();
}

// Equoria-5z0if: main-module guard. main() mutates Horse + User inventory —
// must NOT run on bare import.
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(err => {
    console.error('[migrate-all-purpose-tack] Fatal error:', err.message);
    prisma.$disconnect();
    process.exit(1);
  });
}
