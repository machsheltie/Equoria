/**
 * rename-coat-colors.mjs (Equoria-7woyj)
 *
 * One-time data migration: gives every stored horse color the owner's 2026-10-29
 * name (rulings q309-q316; mapping in docs/features/coat-color-names.md).
 *
 * A horse with color genes is renamed by the name calculation itself, so a stored
 * color always equals what a new horse with the same genes is called:
 *   - a color family keeps its rolled shade, now part of the name
 *     (Bay + dark -> Mahogany Bay, shade standard);
 *   - a color the game already named keeps its shade (spelled grey);
 *   - a color that now names more of its genes (Palomino Roan was Red Roan, Silver
 *     Buckskin was Buckskin) or is a grey gets shade standard, as a new horse would.
 * A horse without color genes is renamed by name alone.
 * Only names the game produced before this change are touched, so a second run,
 * or a horse with a hand-written color, changes nothing. The phenotype key isGray
 * becomes isGrey (q311: grey everywhere). Each UPDATE is guarded on the phenotype
 * it read, so a row changed since it was read is left alone.
 *
 * Usage (DATABASE_URL in the environment wins over backend/.env):
 *   Dry run:  node backend/scripts/rename-coat-colors.mjs
 *   Apply:    node backend/scripts/rename-coat-colors.mjs --apply
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { calculatePhenotype } from '../modules/horses/services/phenotypeCalculationService.mjs';
import { familyShadeName, familyShadeNames } from '../modules/horses/services/coatColorNaming.mjs';

/** Every color name the game produced before Equoria-7woyj. */
export const previousCoatColorNames = Object.freeze(
  new Set([
    'Amber Champagne',
    'Amber Cream Champagne',
    'Amber Cream Dun Champagne',
    'Amber Dun Champagne',
    'Apricot',
    'Bay',
    'Bay Dun',
    'Bay Pearl',
    'Bay Roan',
    'Black',
    'Blanket',
    'Blue Roan',
    'Brindle',
    'Buckskin',
    'Buckskin Pearl',
    'Chestnut',
    'Classic Champagne',
    'Classic Cream Champagne',
    'Classic Cream Dun Champagne',
    'Classic Dun Champagne',
    'Cremello',
    'Dominant White',
    'Dunalino',
    'Dunskin',
    'Fewspot Leopard',
    'Fleabitten Gray',
    'Gold Champagne',
    'Gold Cream Champagne',
    'Gold Cream Dun Champagne',
    'Gold Dun Champagne',
    'Gray',
    'Grulla',
    'Heavy Frost Roan Varnish',
    'Heavy Snowflake Leopard',
    'Ivory Champagne',
    'Ivory Dun Champagne',
    'Leopard',
    'Light Frost Roan Varnish',
    'Light Snowflake Leopard',
    'Moderate Frost Roan Varnish',
    'Moderate Snowflake Leopard',
    'Mushroom Chestnut',
    'Pale Gold',
    'Palomino',
    'Pearl Black',
    'Perlino',
    'Red Dun',
    'Red Roan',
    'Rose Dark Dapple Gray',
    'Rose Gray',
    'Rose Light Dapple Gray',
    'Sable Champagne',
    'Sable Cream Champagne',
    'Sable Cream Dun Champagne',
    'Sable Dun Champagne',
    'Seal Brown',
    'Seal Brown Dun',
    'Seal Brown Dunskin',
    'Seal Brown Pearl',
    'Seal Brown Pearl Cream',
    'Seal Brown Roan',
    'Seal Perlino',
    'Silver Amber Champagne',
    'Silver Amber Cream Champagne',
    'Silver Amber Cream Dun Champagne',
    'Silver Amber Dun Champagne',
    'Silver Bay',
    'Silver Bay Dun',
    'Silver Bay Roan',
    'Silver Classic Champagne',
    'Silver Classic Cream Champagne',
    'Silver Classic Cream Dun Champagne',
    'Silver Classic Dun Champagne',
    'Silver Dapple',
    'Silver Dapple Grulla',
    'Silver Grulla',
    'Silver Ivory Champagne',
    'Silver Ivory Dun Champagne',
    'Silver Roan',
    'Silver Sable Champagne',
    'Silver Sable Cream Champagne',
    'Silver Sable Cream Dun Champagne',
    'Silver Sable Dun Champagne',
    'Silver Seal Brown',
    'Silver Seal Brown Dun',
    'Smoky Black',
    'Smoky Black Pearl',
    'Smoky Cream',
    'Smoky Grulla',
    'Smoky Seal Brown',
    'Snowcap',
    'Steel Dark Dapple Gray',
    'Steel Gray',
    'Steel Light Dapple Gray',
    'Varnish Roan',
    'White Gray',
  ]),
);

/**
 * The owner's name for an old name that is the same color with the same shades
 * (word order, spelling, "seal"), or the best name-only guess for a horse with no
 * genes (Silver Dapple -> Silver Black). Names not listed are unchanged.
 */
export const renamedByName = Object.freeze({
  'Amber Dun Champagne': 'Amber Champagne Dun',
  'Classic Dun Champagne': 'Classic Champagne Dun',
  'Gold Dun Champagne': 'Gold Champagne Dun',
  'Sable Dun Champagne': 'Sable Champagne Dun',
  Apricot: 'Chestnut Pearl',
  'Pale Gold': 'Palomino Pearl',
  'Pearl Black': 'Black Pearl',
  'Seal Brown Dun': 'Seal Dun',
  'Seal Brown Pearl': 'Seal Pearl',
  'Silver Seal Brown': 'Silver Seal',
  'Smoky Seal Brown': 'Seal Buckskin',
  'Silver Roan': 'Silver Blue Roan',
  'Silver Dapple': 'Silver Black',
  Gray: 'Dapple Grey',
  'Steel Gray': 'Steel Grey',
  'Rose Gray': 'Rose Grey',
  'White Gray': 'White Grey',
  'Fleabitten Gray': 'Fleabitten Grey',
  'Steel Dark Dapple Gray': 'Dapple Grey',
  'Steel Light Dapple Gray': 'Light Dapple Grey',
  'Rose Dark Dapple Gray': 'Rose Grey',
  'Rose Light Dapple Gray': 'Rose Grey',
});

/** Names whose stored shade is not kept: the dropped shades merely repeated the name. */
const sameColorNewShades = new Set([
  'Silver Dapple',
  ...Object.keys(renamedByName).filter(n => n.includes('Gray')),
]);

const familyFoldNames = new Set(
  Object.values(familyShadeNames).flatMap(shades => Object.values(shades).flat()),
);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function greySpelling(text) {
  return text.replace(/gray/g, 'grey').replace(/Gray/g, 'Grey');
}

/**
 * The renamed phenotype for one stored horse, or null when nothing changes.
 *
 * @param {unknown} phenotype - horses.phenotype
 * @param {unknown} colorGenotype - horses.colorGenotype
 * @returns {object|null}
 */
export function renamedPhenotype(phenotype, colorGenotype) {
  if (!isPlainObject(phenotype)) {
    return null;
  }
  const oldName = phenotype.colorName;
  const { isGray, ...rest } = phenotype;
  const next = Object.hasOwn(phenotype, 'isGray') ? { ...rest, isGrey: isGray } : { ...phenotype };
  if (typeof oldName === 'string' && previousCoatColorNames.has(oldName)) {
    const oldShade = greySpelling(
      typeof phenotype.shade === 'string' ? phenotype.shade : 'standard',
    );
    if (isPlainObject(colorGenotype) && Object.keys(colorGenotype).length > 0) {
      // The stored shade stands in for the breed's roll, so a family folds the shade it has.
      const storedShade = new Proxy({}, { get: () => ({ [oldShade]: 1 }) });
      const fresh = calculatePhenotype(colorGenotype, storedShade);
      next.colorName = fresh.colorName;
      if (Object.hasOwn(familyShadeNames, oldName)) {
        next.shade = familyFoldNames.has(fresh.colorName) ? fresh.shade : 'standard';
      } else {
        const sameColor = (renamedByName[oldName] ?? oldName) === fresh.colorName;
        next.shade = sameColor && !sameColorNewShades.has(oldName) ? oldShade : 'standard';
      }
    } else if (Object.hasOwn(familyShadeNames, oldName)) {
      Object.assign(next, familyShadeName(oldName, oldShade, 0));
    } else {
      next.colorName = renamedByName[oldName] ?? oldName;
      next.shade = sameColorNewShades.has(oldName) ? 'standard' : oldShade;
    }
  }
  return JSON.stringify(next) === JSON.stringify(phenotype) ? null : next;
}

/**
 * Rename every stored horse color (optionally only the given ids).
 *
 * @param {{ apply?: boolean, horseIds?: number[]|null, log?: (msg: string) => void }} [options]
 * @returns {Promise<{ checked: number, renamed: number, unchanged: number, skippedChanged: number, renames: Record<string, number> }>}
 */
export async function renameStoredCoatColors({
  apply = false,
  horseIds = null,
  log = console.log,
} = {}) {
  const horses = Array.isArray(horseIds)
    ? await prisma.$queryRaw`
        SELECT id, phenotype, "colorGenotype" FROM horses
        WHERE phenotype IS NOT NULL AND id = ANY(${horseIds}::int[]) ORDER BY id`
    : await prisma.$queryRaw`
        SELECT id, phenotype, "colorGenotype" FROM horses WHERE phenotype IS NOT NULL ORDER BY id`;
  const result = {
    checked: horses.length,
    renamed: 0,
    unchanged: 0,
    skippedChanged: 0,
    renames: {},
  };
  for (const horse of horses) {
    const next = renamedPhenotype(horse.phenotype, horse.colorGenotype);
    if (!next) {
      result.unchanged++;
      continue;
    }
    const key = `${horse.phenotype.colorName}/${horse.phenotype.shade} -> ${next.colorName}/${next.shade}`;
    result.renames[key] = (result.renames[key] ?? 0) + 1;
    if (!apply) {
      result.renamed++;
      continue;
    }
    const updated = await prisma.$executeRaw`
      UPDATE horses SET phenotype = ${JSON.stringify(next)}::jsonb
      WHERE id = ${horse.id} AND phenotype = ${JSON.stringify(horse.phenotype)}::jsonb`;
    if (updated === 1) {
      result.renamed++;
    } else {
      result.skippedChanged++;
    }
  }
  log(
    `${apply ? 'Renamed' : 'Would rename'} ${result.renamed} of ${result.checked} horse colors` +
      ` (${result.unchanged} unchanged, ${result.skippedChanged} changed since read).`,
  );
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes('--apply');
  renameStoredCoatColors({ apply })
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
