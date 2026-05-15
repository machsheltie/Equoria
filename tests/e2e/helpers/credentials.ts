/**
 * E2E test-credential accessors (Story 21-8 AC1, Equoria-4m96).
 *
 * Credentials are written to process.env by tests/e2e/global-setup.ts before
 * worker forks. This module reads them back without any filesystem I/O,
 * replacing the legacy tests/e2e/test-credentials.json read/write pattern.
 */

export type TestCredentials = {
  email: string;
  password: string;
  username: string;
  testHorseId?: number;
};

/**
 * Read E2E credentials from process.env. Throws if the global setup did not
 * run (i.e. the env keys are not present), which is the same failure semantic
 * the old fs-based reader had.
 */
export function readTestCredentials(): TestCredentials {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const username = process.env.E2E_TEST_USERNAME;

  if (!email || !password || !username) {
    throw new Error(
      'E2E_TEST_EMAIL / E2E_TEST_PASSWORD / E2E_TEST_USERNAME missing in process.env. ' +
        'Did tests/e2e/global-setup.ts run successfully?'
    );
  }

  const horseIdRaw = process.env.E2E_TEST_HORSE_ID;
  const testHorseId = horseIdRaw ? Number(horseIdRaw) : undefined;

  return { email, password, username, testHorseId };
}
