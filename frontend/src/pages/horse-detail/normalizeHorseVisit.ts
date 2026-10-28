/**
 * normalizeHorseVisit — GET /horses/:id/visit -> the horse page's Horse, so a
 * visitor's page renders through the very same sections as the owner's
 * (owner ruling q205; coordinator directive 2026-10-28: "formatted like the
 * original horse page"). Only what the visit carries is filled; nothing is
 * invented. The genotype and hidden trait names are never in the visit.
 */

import type { HorseVisit } from '@/lib/api/studs';
import type { HealthBand } from '@/lib/healthWords';
import type { Horse, HorseLegMarkings, HorseStats } from './HorseDetailPageTypes';

const statNames: (keyof HorseStats)[] = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

export function normalizeHorseVisit(visit: HorseVisit): Horse {
  const stats = Object.fromEntries(
    statNames.map((name) => [name, visit.stats?.[name] ?? 0])
  ) as unknown as HorseStats;
  const hasMarkings = Boolean(visit.faceMarking || visit.legMarkings);
  return {
    id: visit.id,
    name: visit.name,
    breed: visit.breed ?? '',
    breedId: visit.breedId ?? undefined,
    age: visit.age ?? 0,
    ageYears: visit.age ?? undefined,
    gender: visit.sex,
    temperament: visit.temperament ?? null,
    dateOfBirth: visit.dateOfBirth ?? '',
    healthStatus: visit.displayedHealth ?? '',
    displayedHealth: (visit.displayedHealth as HealthBand | null) ?? undefined,
    feedHealth: visit.feedHealth,
    bondScore: visit.bondScore ?? undefined,
    imageUrl: visit.imageUrl ?? undefined,
    stats,
    disciplineScores: visit.disciplineScores ?? {},
    forSale: visit.forSale,
    salePrice: visit.salePrice ?? undefined,
    parentIds: { sireId: visit.sire?.id, damId: visit.dam?.id },
    phenotype: { colorName: visit.colorName ?? undefined, shade: visit.shade ?? undefined },
    markings: hasMarkings
      ? {
          faceMarking: visit.faceMarking ?? undefined,
          legMarkings: (visit.legMarkings ?? undefined) as HorseLegMarkings | undefined,
        }
      : null,
    currentTitle: visit.currentTitle ?? null,
    titlePoints: visit.titlePoints ?? 0,
    breedingValueBoost: visit.breedingValueBoost ?? 0,
  };
}
