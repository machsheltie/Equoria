/**
 * The Marketplace all-horses search query (Equoria-q4uem.9.1).
 *
 * Owner ruling 2026-10-27 (q104): the search covers all horses. The player ticks
 * "for sale", "at stud" or both. It is two searches merged: a horse qualifies when
 * it matches the for-sale side OR the at-stud side, and each price range narrows
 * only its own side. The shared filters (name, breed, gender, color, age) narrow
 * both. A horse that is both for sale and at stud appears once.
 *
 * Everything is validated here, before Prisma: a refusal throws BadQuery and the
 * controller answers with a 400 and the standard body.
 */
import { studStatuses } from '../../../constants/schema.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { minBreedingAgeYears, maxBreedingAgeYears } from '../../horses/index.mjs';
import { horseSexFilterValues } from '../../../../packages/database/horseSexCanonical.mjs';
import { BadQuery, boundedInt, ownValue, single } from './listingQueryParams.mjs';

const maxText = 100;
// Bounds that keep the query values valid for Prisma (int4) and for birthDateForAge.
const int4Limit = 2147483647;
const maxAgeLimit = 1000;
const studModes = Object.freeze({ public: studStatuses.public, private: studStatuses.private });

const idAsc = { key: 'id', dir: 'asc', type: 'int' };
const saleCol = dir => ({ key: 'salePrice', dir, type: 'int', nullable: true });
// A null studFee is a legacy 0, so it sorts with the cheapest.
const feeCol = dir => ({
  key: 'studFee',
  dir,
  type: 'int',
  nullable: true,
  nulls: dir === 'asc' ? 'first' : 'last',
});
// Horses for sale come before studs that are not for sale when both sides are ticked.
const saleFirst = { key: 'forSale', dir: 'desc', type: 'bool', nullable: true, nulls: 'last' };

/** The order for a sort name given which sides are ticked. */
function sortFor(name, { forSale, atStud }) {
  const price = dir => {
    if (forSale && atStud) {
      return [saleFirst, saleCol(dir), feeCol(dir), idAsc];
    }
    return [forSale ? saleCol(dir) : feeCol(dir), idAsc];
  };
  const table = {
    newest: () => [{ key: 'createdAt', dir: 'desc', type: 'date', nullable: true }, idAsc],
    youngest: () => [{ key: 'age', dir: 'asc', type: 'int', nullable: true }, idAsc],
    priceAsc: () => price('asc'),
    priceDesc: () => price('desc'),
  };
  return ownValue(table, name, 'sort')();
}

function flag(query, key) {
  const value = single(query, key);
  if (value === undefined || value === '') {
    return false;
  }
  if (value !== 'true' && value !== 'false') {
    throw new BadQuery(`${key} must be true or false`);
  }
  return value === 'true';
}

function text(query, key) {
  const value = single(query, key)?.trim();
  if (value && value.length > maxText) {
    throw new BadQuery(`${key} is too long`);
  }
  return value || undefined;
}

/** Validate the whole query up front. */
export function parseHorseSearch(query) {
  const forSale = flag(query, 'forSale');
  const atStud = flag(query, 'atStud');
  if (!forSale && !atStud) {
    throw new BadQuery('Choose horses for sale, horses at stud, or both');
  }
  const studMode = single(query, 'studMode');
  const sex = text(query, 'sex');
  let sexValues;
  if (sex) {
    try {
      sexValues = horseSexFilterValues(sex);
    } catch {
      throw new BadQuery('That sex is not one the market offers');
    }
  }
  return {
    forSale,
    atStud,
    studStatuses: studMode
      ? [ownValue(studModes, studMode, 'stud mode')]
      : Object.values(studModes),
    name: text(query, 'name'),
    breedId: boundedInt(query, 'breedId', int4Limit),
    color: text(query, 'color'),
    sexValues,
    minAge: boundedInt(query, 'minAge', maxAgeLimit),
    maxAge: boundedInt(query, 'maxAge', maxAgeLimit),
    minPrice: boundedInt(query, 'minPrice', int4Limit),
    maxPrice: boundedInt(query, 'maxPrice', int4Limit),
    minStudFee: boundedInt(query, 'minStudFee', int4Limit),
    maxStudFee: boundedInt(query, 'maxStudFee', int4Limit),
    page: boundedInt(query, 'page', int4Limit),
    limit: boundedInt(query, 'limit', int4Limit),
    cursor: single(query, 'cursor'),
    sort: sortFor(single(query, 'sort') ?? 'newest', { forSale, atStud }),
  };
}

const range = (min, max) => ({
  ...(min !== undefined ? { gte: min } : {}),
  ...(max !== undefined ? { lte: max } : {}),
});

/** The Prisma `where` for a parsed search, as seen by `viewerId`. */
export function horseSearchWhere(p, viewerId) {
  // Other players' horses only; an ownerless (erased) horse is never listed.
  const and = [{ userId: { not: null } }, { userId: { not: viewerId } }];
  if (p.name) {
    and.push({ name: { contains: p.name, mode: 'insensitive' } });
  }
  if (p.breedId !== undefined) {
    and.push({ breedId: p.breedId });
  }
  if (p.color) {
    and.push({ phenotype: { path: ['colorName'], string_contains: p.color, mode: 'insensitive' } });
  }
  if (p.sexValues) {
    and.push({ OR: p.sexValues.map(value => ({ sex: { equals: value, mode: 'insensitive' } })) });
  }
  // Game-year age convention (birthDateForAge): at least minAge old means born on or
  // before that date; at most maxAge means born after the maxAge + 1 date.
  if (p.minAge !== undefined) {
    and.push({ dateOfBirth: { lte: birthDateForAge(p.minAge) } });
  }
  if (p.maxAge !== undefined) {
    and.push({ dateOfBirth: { gt: birthDateForAge(p.maxAge + 1) } });
  }

  const sides = [];
  if (p.forSale) {
    const price = range(p.minPrice, p.maxPrice);
    sides.push({ forSale: true, ...(Object.keys(price).length ? { salePrice: price } : {}) });
  }
  if (p.atStud) {
    const stud = {
      studStatus: { in: p.studStatuses },
      sex: 'Stallion',
      // Stallions are at stud from 3 to 20 (breeding ages): a younger or retired stallion
      // is never offered, even if listed before the guard existed.
      AND: [
        { dateOfBirth: { lte: birthDateForAge(minBreedingAgeYears) } },
        { dateOfBirth: { gt: birthDateForAge(maxBreedingAgeYears + 1) } },
      ],
    };
    const fee = range(p.minStudFee, p.maxStudFee);
    if (Object.keys(fee).length) {
      // A null studFee is a legacy 0.
      const zeroInRange = (fee.gte ?? 0) <= 0 && (fee.lte ?? 0) >= 0;
      stud.AND.push(zeroInRange ? { OR: [{ studFee: fee }, { studFee: null }] } : { studFee: fee });
    }
    sides.push(stud);
  }
  and.push({ OR: sides });
  return { AND: and };
}
