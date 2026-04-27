export const DEPLOYABLE_ENVS = new Set(['production', 'beta', 'beta-readiness']);

const GENERIC_PLACEHOLDER_PATTERNS = ['your-super-secret', 'change-this', 'replace_with', 'example'];
const DEPLOYABLE_TEST_SECRET_PATTERNS = [
  'test-jwt-secret-key-for-testing-only',
  'test-jwt-refresh-secret-for-testing-only',
  'test-session-secret-for-testing-only',
];

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
  }

  return null;
}
