export const DEPLOYABLE_ENVS = new Set(['production', 'beta']);

const GENERIC_PLACEHOLDER_PATTERNS = [
  'your-super-secret',
  'change-this',
  'replace_with',
  'example',
];
const DEPLOYABLE_TEST_SECRET_PATTERNS = [
  'test-jwt-secret-key-for-testing-only',
  'test-jwt-refresh-secret-for-testing-only',
  'test-session-secret-for-testing-only',
];

// SECURITY.md documents JWT_SECRET / SESSION_SECRET as "minimum 32 characters".
// A short-but-non-placeholder secret (e.g. a hand-typed value) is brute-forceable
// and must not be allowed in a deployable (production/beta) environment.
const MIN_DEPLOYABLE_SECRET_LENGTH = 32;

export function isDeployableEnvironment(nodeEnv = process.env.NODE_ENV) {
  return DEPLOYABLE_ENVS.has(nodeEnv);
}

export function getSecretValidationError(secretName, secretValue, nodeEnv = process.env.NODE_ENV) {
  if (!secretValue) {
    return null;
  }

  const normalizedSecret = secretValue.toLowerCase();
  const hasGenericPlaceholder = GENERIC_PLACEHOLDER_PATTERNS.some(pattern =>
    normalizedSecret.includes(pattern),
  );

  if (hasGenericPlaceholder) {
    return `${secretName} appears to be a placeholder value. Please generate a real secret.`;
  }

  if (isDeployableEnvironment(nodeEnv)) {
    const usesTestOnlySecret = DEPLOYABLE_TEST_SECRET_PATTERNS.some(pattern =>
      normalizedSecret.includes(pattern),
    );

    if (usesTestOnlySecret) {
      return `${secretName} uses a committed test-only secret and is not allowed in deployable environments (${nodeEnv}).`;
    }

    if (secretValue.length < MIN_DEPLOYABLE_SECRET_LENGTH) {
      return `${secretName} is too short (${secretValue.length} chars) — deployable environments (${nodeEnv}) require a minimum of ${MIN_DEPLOYABLE_SECRET_LENGTH} characters.`;
    }
  }

  return null;
}
