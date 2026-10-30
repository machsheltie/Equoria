/**
 * rename-saddlebred-palomino-shades.mjs (Equoria-mxu1y)
 *
 * One-time data fix, owner ruling q321 (2026-10-30): the American Saddlebred's
 * Palomino shades are Light, Golden, Classic, Dark and Chocolate. The old shades
 * map pale -> Light and copper -> Dark (golden and chocolate keep their names).
 *
 * For every existing Saddlebred whose stored color is still an unfolded Palomino
 * (colorName 'Palomino', any shade) or a Palomino name with a leftover shade word
 * (e.g. shade 'pale'), the phenotype becomes the owner's name with shade
 * 'standard', exactly what a new horse with that shade is called
 * (Palomino/pale -> Light Palomino, Palomino/copper -> Dark Palomino, a plain
 * Palomino -> Classic Palomino).
 *
 * Portraits: a horse with no picture (empty or the column default) gets one of its
 * color's portraits. A renamed horse whose picture is a Saddlebred Palomino
 * portrait of another color gets one of its new color's portraits. Any other
 * picture is kept.
 *
 * Each UPDATE is guarded on the phenotype and imageUrl it read, so a row changed
 * since it was read is left alone, and a second run changes nothing.
 *
 * Usage (DATABASE_URL in the environment wins over backend/.env):
 *   Dry run:  node backend/scripts/rename-saddlebred-palomino-shades.mjs
 *   Apply:    node backend/scripts/rename-saddlebred-palomino-shades.mjs --apply
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { familyShadeName, familyShadeNames } from '../modules/horses/services/coatColorNaming.mjs';
import {
  coatImageVariants,
  hasNoChosenPicture,
  rollCoatImageUrl,
} from '../modules/horses/services/coatImageService.mjs';
import { coatImages } from '../modules/horses/data/coatImages.mjs';

const breedName = 'American Saddlebred';

/** The old Saddlebred shade words and the q321 shade each one became. */
export const previousPalominoShades = Object.freeze({ pale: 'light', copper: 'dark' });

const palominoNames = new Set(['Palomino', ...Object.values(familyShadeNames.Palomino)]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The renamed phenotype for one stored Saddlebred, or null when its color is not
 * an unfolded Palomino or a Palomino name with a leftover shade.
 *
 * @param {unknown} phenotype - horses.phenotype
 * @returns {object|null}
 */
export function renamedPalominoPhenotype(phenotype) {
  if (!isPlainObject(phenotype) || !palominoNames.has(phenotype.colorName)) {
    return null;
  }
  const storedShade = typeof phenotype.shade === 'string' ? phenotype.shade : 'standard';
  const shade = previousPalominoShades[storedShade] ?? storedShade;
  const known = Object.hasOwn(familyShadeNames.Palomino, shade);
  if (phenotype.colorName !== 'Palomino' && (shade === 'standard' || !known)) {
    return null; // already the owner's name (or a shade word this fix does not own)
  }
  const named = known
    ? familyShadeName('Palomino', shade, 0)
    : { colorName: familyShadeNames.Palomino.standard, shade: 'standard' };
  const next = { ...phenotype, colorName: named.colorName, shade: 'standard' };
  return JSON.stringify(next) === JSON.stringify(phenotype) ? null : next;
}

const portraitFolder = `${coatImages[breedName].folder}/`;

/** True when the URL is one of the game's Saddlebred Palomino portraits. */
function isPalominoPortrait(imageUrl) {
  return (
    typeof imageUrl === 'string' &&
    imageUrl.startsWith(portraitFolder) &&
    imageUrl.slice(portraitFolder.length).includes('palomino')
  );
}

/**
 * The picture a Saddlebred should now have, or null to keep the stored one.
 *
 * @param {string|null} imageUrl - stored horses.imageUrl
 * @param {object} phenotype - the (renamed) phenotype
 * @param {boolean} renamed - whether this fix changed the color
 * @param {() => number} rng
 * @returns {string|null}
 */
export function nextPortrait(imageUrl, phenotype, renamed, rng) {
  const variants = coatImageVariants(breedName, phenotype);
  if (variants.length === 0 || variants.includes(imageUrl)) {
    return null;
  }
  if (hasNoChosenPicture(imageUrl) || (renamed && isPalominoPortrait(imageUrl))) {
    return rollCoatImageUrl(breedName, phenotype, rng);
  }
  return null;
}

/**
 * Rename every Saddlebred's old Palomino shade and give it the right portrait.
 *
 * @param {{ apply?: boolean, horseIds?: number[]|null, rng?: () => number, log?: (msg: string) => void }} [options]
 * @returns {Promise<{ checked: number, renamed: number, portraits: number, unchanged: number, skippedChanged: number, renames: Record<string, number> }>}
 */
export async function renameSaddlebredPalominoShades({
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
      AND h.phenotype->>'colorName' = ANY(${[...palominoNames]}::text[])
      AND (${!scoped} OR h.id = ANY(${scoped ? horseIds : []}::int[]))
    ORDER BY h.id`;
  const result = {
    checked: horses.length,
    renamed: 0,
    portraits: 0,
    unchanged: 0,
    skippedChanged: 0,
    renames: {},
  };
  for (const horse of horses) {
    const renamedPhenotype = renamedPalominoPhenotype(horse.phenotype);
    const phenotype = renamedPhenotype ?? horse.phenotype;
    const imageUrl = nextPortrait(horse.imageUrl, phenotype, renamedPhenotype !== null, rng);
    if (!renamedPhenotype && !imageUrl) {
      result.unchanged++;
      continue;
    }
    if (renamedPhenotype) {
      const key = `${horse.phenotype.colorName}/${horse.phenotype.shade} -> ${phenotype.colorName}`;
      result.renames[key] = (result.renames[key] ?? 0) + 1;
    }
    let updated = 1;
    if (apply) {
      const nextUrl = imageUrl ?? horse.imageUrl;
      const readPhenotype = JSON.stringify(horse.phenotype);
      updated =
        horse.imageUrl === null
          ? await prisma.$executeRaw`
              UPDATE horses SET phenotype = ${JSON.stringify(phenotype)}::jsonb, "imageUrl" = ${nextUrl}
              WHERE id = ${horse.id} AND phenotype = ${readPhenotype}::jsonb AND "imageUrl" IS NULL`
          : await prisma.$executeRaw`
              UPDATE horses SET phenotype = ${JSON.stringify(phenotype)}::jsonb, "imageUrl" = ${nextUrl}
              WHERE id = ${horse.id} AND phenotype = ${readPhenotype}::jsonb
                AND "imageUrl" = ${horse.imageUrl}`;
    }
    if (updated !== 1) {
      result.skippedChanged++;
      continue;
    }
    if (renamedPhenotype) {
      result.renamed++;
    }
    if (imageUrl) {
      result.portraits++;
    }
  }
  log(
    `${apply ? 'Renamed' : 'Would rename'} ${result.renamed} and ${apply ? 'gave' : 'would give'} ` +
      `${result.portraits} a portrait, of ${result.checked} Palomino ${breedName}s ` +
      `(${result.unchanged} unchanged, ${result.skippedChanged} changed since read).`,
  );
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  renameSaddlebredPalominoShades({ apply: process.argv.includes('--apply') })
    .then(result => {
      for (const [rename, count] of Object.entries(result.renames).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${count}  ${rename}`);
      }
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
