/**
 * assign-classic-palomino-portraits.mjs (Equoria-mxu1y)
 *
 * One-time data fix, owner ruling q320 (2026-10-30): the owner added two Classic
 * Palomino American Saddlebred portraits. A new Classic Palomino Saddlebred rolls
 * one when it is created (data/coatImages.mjs); this gives every EXISTING Classic
 * Palomino Saddlebred that has no picture yet one of the two, rolled once.
 *
 * Scope: breed American Saddlebred, phenotype colorName 'Classic Palomino', and
 * imageUrl empty or the column default (hasNoChosenPicture). A horse that already
 * has a picture is never touched. Each UPDATE is guarded on the imageUrl it read,
 * so a row changed since it was read is left alone, and a second run changes
 * nothing.
 *
 * Usage (DATABASE_URL in the environment wins over backend/.env):
 *   Dry run:  node backend/scripts/assign-classic-palomino-portraits.mjs
 *   Apply:    node backend/scripts/assign-classic-palomino-portraits.mjs --apply
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  defaultHorseImageUrl,
  hasNoChosenPicture,
  rollCoatImageUrl,
} from '../modules/horses/services/coatImageService.mjs';

const breedName = 'American Saddlebred';
const colorName = 'Classic Palomino';

/**
 * Give each Classic Palomino Saddlebred with no picture one portrait.
 *
 * @param {{ apply?: boolean, horseIds?: number[]|null, rng?: () => number, log?: (msg: string) => void }} [options]
 * @returns {Promise<{ checked: number, assigned: number, kept: number, skippedChanged: number }>}
 */
export async function assignClassicPalominoPortraits({
  apply = false,
  horseIds = null,
  rng = Math.random,
  log = console.log,
} = {}) {
  const scoped = Array.isArray(horseIds);
  const horses = await prisma.$queryRaw`
    SELECT h.id, h."imageUrl", h.phenotype FROM horses h
    JOIN breeds b ON b.id = h."breedId"
    WHERE b.name = ${breedName}
      AND h.phenotype->>'colorName' = ${colorName}
      AND (${!scoped} OR h.id = ANY(${scoped ? horseIds : []}::int[]))
    ORDER BY h.id`;
  const result = { checked: horses.length, assigned: 0, kept: 0, skippedChanged: 0 };
  for (const horse of horses) {
    const url = hasNoChosenPicture(horse.imageUrl)
      ? rollCoatImageUrl(breedName, horse.phenotype, rng)
      : null;
    if (!url) {
      result.kept++;
      continue;
    }
    if (!apply) {
      result.assigned++;
      continue;
    }
    const updated =
      horse.imageUrl === null
        ? await prisma.$executeRaw`
            UPDATE horses SET "imageUrl" = ${url} WHERE id = ${horse.id} AND "imageUrl" IS NULL`
        : await prisma.$executeRaw`
            UPDATE horses SET "imageUrl" = ${url} WHERE id = ${horse.id} AND "imageUrl" = ${horse.imageUrl}`;
    if (updated === 1) {
      result.assigned++;
    } else {
      result.skippedChanged++;
    }
  }
  log(
    `${apply ? 'Gave' : 'Would give'} ${result.assigned} of ${result.checked} ${colorName} ` +
      `${breedName}s a portrait (${result.kept} already have one, ` +
      `${result.skippedChanged} changed since read; no picture = ${defaultHorseImageUrl} or empty).`,
  );
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assignClassicPalominoPortraits({ apply: process.argv.includes('--apply') })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
