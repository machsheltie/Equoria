/**
 * E2E fixture: seedable horses with deterministic coat genotypes (Equoria-a0i6).
 *
 * Sub-issue of Equoria-wrm5 (E2E lethal-white warning). The breeding-color and
 * lethal-white E2E specs need horses whose `colorGenotype` JSONB column holds
 * known allele pairs (e.g. heterozygous frame-overo Oo × Oo). The public
 * POST /horses endpoint always generates colorGenotype from breed genetics
 * and does NOT accept a caller-supplied genotype, so this fixture writes
 * directly through Prisma.
 *
 * Design rules (from issue AC + CLAUDE.md Rule 2):
 *   - All fixture horses are named with the prefix `WrmFixture-` so they
 *     coexist with real game state and can be scoped-cleaned without ever
 *     touching user-owned horses.
 *   - No bypass headers, no x-test-* injections — pure database writes.
 *   - Cleanup is scoped: `WHERE name LIKE 'WrmFixture-%'`.
 *
 * Scenarios provided:
 *   1. Heterozygous frame-overo parents (Oo × Oo → 25% OO lethal-white).
 *   2. Homozygous E/e parents with no lethal risk.
 *   3. Legacy horses with colorGenotype: null.
 *
 * Usage (from a Playwright spec):
 *
 *   import { seedCoatGenotypeHorses, cleanupCoatGenotypeHorses }
 *     from './fixtures/coatGenotypeHorses';
 *
 *   test.beforeAll(async () => {
 *     await seedCoatGenotypeHorses({ userId, breedId, scenario: 'frame-overo' });
 *   });
 *
 *   test.afterAll(async () => {
 *     await cleanupCoatGenotypeHorses();
 *   });
 */

import { fileURLToPath } from 'url';
import path from 'path';

// Resolve the project's prismaClient.mjs from the worktree root so this
// fixture works regardless of cwd at Playwright launch time.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const prismaClientPath = path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs');

// Dynamic import so this file remains a TypeScript module without an
// ambient declaration for the .mjs default export.
async function getPrisma(): Promise<any> {
  const mod = await import(/* @vite-ignore */ prismaClientPath);
  // prismaClient.mjs exports the PrismaClient instance as its default export.
  const client = mod.default;
  if (!client) {
    throw new Error('Could not resolve prisma client from packages/database/prismaClient.mjs');
  }
  return client;
}

export const FIXTURE_NAME_PREFIX = 'WrmFixture-';

export type CoatGenotypeScenario =
  | 'frame-overo' // Oo × Oo → 25% OO lethal-white
  | 'homozygous-e' // EE × ee → 100% E/e (no lethal risk)
  | 'legacy-null'; // colorGenotype: null on both parents

export interface SeedOptions {
  userId: string;
  breedId: number;
  scenario: CoatGenotypeScenario;
}

export interface SeededPair {
  sireId: number;
  damId: number;
}

/**
 * Build the colorGenotype JSONB payload for a given scenario.
 * Returns a [sireGenotype, damGenotype] tuple.
 */
function genotypesForScenario(
  scenario: CoatGenotypeScenario
): [Record<string, string> | null, Record<string, string> | null] {
  switch (scenario) {
    case 'frame-overo': {
      // Frame-overo lethal-white: O/O homozygous is lethal in utero.
      // Two heterozygous O/n parents → 25% O/O offspring (filtered as lethal).
      //
      // CRITICAL (Equoria-wrm5): locus key MUST match `O_FrameOvero` from
      // backend/modules/horses/services/genotypeGenerationService.mjs CORE_LOCI
      // AND `LETHAL_COMBINATIONS.O_FrameOvero = Set(['O/O'])` from
      // breedingColorInheritanceService.mjs. Using any other key (e.g. the
      // legacy 'W20_Pattern' placeholder) silently passes through
      // filterLethalGenotypes() because no lethal set is registered for that
      // key — and the LethalWhiteWarning banner never fires.
      //
      // Wild-type allele is `n` (per GENERIC_DEFAULTS.O_FrameOvero = 'n/n'),
      // not `o`. After Punnett: O/O (0.25, lethal-filtered), O/n (0.5), n/n
      // (0.25), so lethalCombinationsFiltered === 1 and the warning renders.
      const heterozygous = {
        E_Extension: 'E/e',
        A_Agouti: 'A/a',
        O_FrameOvero: 'O/n',
      };
      return [heterozygous, { ...heterozygous }];
    }
    case 'homozygous-e': {
      const sire = { E_Extension: 'E/E', A_Agouti: 'A/A' };
      const dam = { E_Extension: 'e/e', A_Agouti: 'a/a' };
      return [sire, dam];
    }
    case 'legacy-null':
      return [null, null];
    default: {
      const exhaustive: never = scenario;
      throw new Error(`Unhandled scenario: ${exhaustive}`);
    }
  }
}

/**
 * Idempotently create a sire + dam pair for the given scenario.
 * If horses with the scenario-specific names already exist for this user,
 * return their IDs; otherwise create them.
 */
export async function seedCoatGenotypeHorses(opts: SeedOptions): Promise<SeededPair> {
  const { userId, breedId, scenario } = opts;
  const prisma = await getPrisma();

  const [sireGenotype, damGenotype] = genotypesForScenario(scenario);

  const sireName = `${FIXTURE_NAME_PREFIX}${scenario}-sire`;
  const damName = `${FIXTURE_NAME_PREFIX}${scenario}-dam`;

  // 5 years in the past — well above the 3-year breeding minimum.
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 5);

  const baseFields = {
    breedId,
    userId,
    dateOfBirth: dob,
    healthStatus: 'Excellent',
  };

  // horse.name is NOT unique in the schema, so a plain upsert by name is not
  // available. find-or-update-or-create per (name, userId) keeps beforeAll
  // idempotent across worker retries.
  async function findOrCreate(name: string, sex: 'Stallion' | 'Mare', genotype: any) {
    const existing = await prisma.horse.findFirst({ where: { name, userId } });
    if (existing) {
      return prisma.horse.update({
        where: { id: existing.id },
        data: { colorGenotype: genotype },
      });
    }
    return prisma.horse.create({
      data: { ...baseFields, name, sex, colorGenotype: genotype },
    });
  }

  const sire = await findOrCreate(sireName, 'Stallion', sireGenotype);
  const dam = await findOrCreate(damName, 'Mare', damGenotype);

  return { sireId: sire.id, damId: dam.id };
}

/**
 * Remove every horse whose name starts with FIXTURE_NAME_PREFIX.
 * Scoped per CLAUDE.md Rule 2 — never touches real user horses.
 */
export async function cleanupCoatGenotypeHorses(): Promise<number> {
  const prisma = await getPrisma();
  const result = await prisma.horse.deleteMany({
    where: { name: { startsWith: FIXTURE_NAME_PREFIX } },
  });
  return result.count;
}

