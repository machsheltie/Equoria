/**
 * installBreedProfileCache.mjs — gives a test file the DB breed profile cache.
 *
 * PrismaCleanupEnvironment.setup() reads breeds.breedGeneticProfile once per Jest
 * process and puts the rows (as JSON) on the test file's global. Each Jest config's
 * setup file calls this to install them as the file's breed cache, the way
 * server.mjs awaits preloadBreedProfiles(prisma) at boot (Equoria-ctop1). Equoria
 * has no second copy of the breed data to fall back on (Equoria-fbnw8), so a suite
 * without these rows must not run: missing rows throw.
 *
 * Imports nothing at load time. The cache module is imported inside the function
 * because it must be evaluated in the test file's own module registry, and
 * backend/tests/setup.mjs must not import packages/database/prismaClient.mjs (see
 * the note there).
 */

// Key set by PrismaCleanupEnvironment.setup() (breedProfileRowsGlobal there).
// Not imported: the environment module is host-side and must not be evaluated
// inside the test file's sandbox.
const rowsGlobalKey = '__equoriaBreedProfileRowsJson';

export async function installBreedProfileCache() {
  const rowsJson = globalThis[rowsGlobalKey];
  if (typeof rowsJson !== 'string') {
    throw new Error(
      'Breed profile rows are missing: backend tests must run in tests/config/PrismaCleanupEnvironment.mjs, ' +
        'which reads them from the database once per Jest process.',
    );
  }
  const { installBreedProfileRows } =
    await import('../../modules/horses/data/breedProfileCache.mjs');
  installBreedProfileRows(JSON.parse(rowsJson));
}
