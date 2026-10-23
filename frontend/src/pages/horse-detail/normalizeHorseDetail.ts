/**
 * normalizeHorseDetail — GET /horses/:id payload -> the detail page's Horse
 * (Equoria-q4uem.12).
 *
 * The page used to re-read most of this payload through `as unknown as` casts
 * (twenty of them), which told the compiler a field existed without checking
 * the wire. `HorseSummary` already declares every field the page needs, so the
 * only reads that stay guarded are the JSONB columns (`phenotype`), whose
 * runtime shape the type cannot promise. Those go through type guards.
 *
 * Pure: builds a NEW object so the React Query cache entry is never mutated.
 */

import type { HorseSummary } from '@/lib/api/types';
import type {
  Horse,
  HorseAdvancedMarkings,
  HorseLegMarkings,
  HorseMarkings,
  HorseModifiers,
  HorseStats,
} from './HorseDetailPageTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function legMarkingsFrom(value: unknown): HorseLegMarkings | undefined {
  if (!isRecord(value)) return undefined;
  return {
    frontLeft: stringOrUndefined(value.frontLeft),
    frontRight: stringOrUndefined(value.frontRight),
    hindLeft: stringOrUndefined(value.hindLeft),
    hindRight: stringOrUndefined(value.hindRight),
  };
}

function advancedMarkingsFrom(value: unknown): HorseAdvancedMarkings | undefined {
  if (!isRecord(value)) return undefined;
  return {
    bloodyShoulderPresent: booleanOrUndefined(value.bloodyShoulderPresent),
    snowflakePresent: booleanOrUndefined(value.snowflakePresent),
    frostPresent: booleanOrUndefined(value.frostPresent),
  };
}

function modifiersFrom(value: unknown): HorseModifiers | undefined {
  if (!isRecord(value)) return undefined;
  return {
    isSooty: booleanOrUndefined(value.isSooty),
    isFlaxen: booleanOrUndefined(value.isFlaxen),
    hasPangare: booleanOrUndefined(value.hasPangare),
    isRabicano: booleanOrUndefined(value.isRabicano),
  };
}

/**
 * Epic 31E-3 / Equoria-ga5g — markings live on the phenotype JSONB. Pluck the
 * marking fields into a flat shape; null when none is present.
 */
function markingsFrom(phenotype: Record<string, unknown> | null): HorseMarkings | null {
  if (!phenotype) return null;
  const faceMarking = stringOrUndefined(phenotype.faceMarking);
  const legMarkings = legMarkingsFrom(phenotype.legMarkings);
  const advancedMarkings = advancedMarkingsFrom(phenotype.advancedMarkings);
  const modifiers = modifiersFrom(phenotype.modifiers);
  if (
    faceMarking === undefined &&
    legMarkings === undefined &&
    advancedMarkings === undefined &&
    modifiers === undefined
  ) {
    return null;
  }
  return { faceMarking, legMarkings, advancedMarkings, modifiers };
}

export function normalizeHorseDetail(raw: HorseSummary): Horse {
  // The API returns a Prisma relation object { id, name, ... } for breed, but the
  // page and its tabs expect the plain breed name.
  const breed = typeof raw.breed === 'string' ? raw.breed : (raw.breed?.name ?? '');

  // The Prisma model stores `sex` (e.g. "MARE"); the page's Horse uses `gender`.
  const gender = raw.gender || raw.sex || '';

  // A Prisma raw query can return the twelve stats flat instead of nested.
  const stats: HorseStats = raw.stats ?? {
    precision: raw.precision ?? 0,
    strength: raw.strength ?? 0,
    speed: raw.speed ?? 0,
    agility: raw.agility ?? 0,
    endurance: raw.endurance ?? 0,
    intelligence: raw.intelligence ?? 0,
    stamina: raw.stamina ?? 0,
    balance: raw.balance ?? 0,
    boldness: raw.boldness ?? 0,
    flexibility: raw.flexibility ?? 0,
    obedience: raw.obedience ?? 0,
    focus: raw.focus ?? 0,
  };

  // JSONB type guard per .claude/rules/CONTRIBUTING.md §1 — Prisma returns
  // JsonValue, which can be null, a primitive, an array or an object. The type
  // says object|null; the wire is not bound by it.
  const phenotypeValue: unknown = raw.phenotype;
  const phenotypeRecord = isRecord(phenotypeValue) ? phenotypeValue : null;

  return {
    id: raw.id,
    name: raw.name,
    breed,
    breedId: raw.breedId,
    age: raw.age,
    gender,
    // Equoria-gncv — null for legacy horses with no temperament.
    temperament: raw.temperament ?? null,
    dateOfBirth: raw.dateOfBirth,
    healthStatus: raw.healthStatus,
    imageUrl: raw.imageUrl,
    stats,
    disciplineScores: raw.disciplineScores ?? {},
    traits: raw.traits,
    description: raw.description,
    forSale: raw.forSale,
    salePrice: raw.salePrice,
    userId: raw.userId,
    parentIds: raw.parentIds,
    tack: raw.tack,
    // Equoria-lsi5 + Equoria-iwy3: expose BOTH colour fields so the render layer
    // applies phenotype.colorName ?? finalDisplayColor ?? 'not recorded'. The
    // legacy finalDisplayColor column is NULL for every canonical-DB horse.
    finalDisplayColor: raw.finalDisplayColor ?? undefined,
    phenotype: phenotypeRecord
      ? { ...phenotypeRecord, colorName: stringOrUndefined(phenotypeRecord.colorName) }
      : null,
    markings: markingsFrom(phenotypeRecord),
    // In-foal state — feed-system redesign 2026-04-29 (B6, Equoria-ta4s).
    inFoalSinceDate: raw.inFoalSinceDate ?? null,
    pregnancySireId: raw.pregnancySireId ?? null,
    pregnancyFeedingsByTier: raw.pregnancyFeedingsByTier ?? {},
    lastFedDate: raw.lastFedDate ?? null,
    lastVettedDate: raw.lastVettedDate ?? null,
    equippedFeedType: raw.equippedFeedType ?? null,
    feedHealth: raw.feedHealth,
    // Equoria-u0jop: the server's displayed health (worse of feed and vet) is
    // what every gate checks and what the health badge and labels show.
    vetHealth: raw.vetHealth,
    displayedHealth: raw.displayedHealth,
    // Equoria-8xfo (31F-FE-2) — conformation title fields. currentTitle is null
    // for never-shown horses; titlePoints starts at 0; breedingValueBoost is a
    // 0..N multiplier (0.10 == +10%).
    currentTitle: raw.currentTitle ?? null,
    titlePoints: raw.titlePoints ?? 0,
    breedingValueBoost: raw.breedingValueBoost ?? 0,
  };
}
