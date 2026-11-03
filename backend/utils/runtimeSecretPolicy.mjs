export const deployableEnvs = new Set(['production', 'beta']);

const genericPlaceholderPatterns = ['your-super-secret', 'change-this', 'replace_with', 'example'];
const deployableTestSecretPatterns = [
  'test-jwt-secret-key-for-testing-only',
  'test-jwt-refresh-secret-for-testing-only',
  'test-session-secret-for-testing-only',
];

// SECURITY.md documents JWT_SECRET / SESSION_SECRET as "minimum 32 characters".
// A short-but-non-placeholder secret (e.g. a hand-typed value) is brute-forceable
// and must not be allowed in a deployable (production/beta) environment.
const minDeployableSecretLength = 32;

export function isDeployableEnvironment(nodeEnv = process.env.NODE_ENV) {
  return deployableEnvs.has(nodeEnv);
}

/**
 * True when a value is one of the committed test-only secrets. The single list
 * both this policy and playwright.config.ts (which keeps backend/.env.test's
 * test secrets away from the NODE_ENV=beta backend it starts) rely on.
 */
export function isCommittedTestSecret(value) {
  if (!value) {
    return false;
  }
  const normalized = String(value).toLowerCase();
  return deployableTestSecretPatterns.some(pattern => normalized.includes(pattern));
}

export function getSecretValidationError(secretName, secretValue, nodeEnv = process.env.NODE_ENV) {
  if (!secretValue) {
    return null;
  }

  const normalizedSecret = secretValue.toLowerCase();
  const hasGenericPlaceholder = genericPlaceholderPatterns.some(pattern =>
    normalizedSecret.includes(pattern),
  );

  if (hasGenericPlaceholder) {
    return `${secretName} appears to be a placeholder value. Please generate a real secret.`;
  }

  if (isDeployableEnvironment(nodeEnv)) {
    if (isCommittedTestSecret(secretValue)) {
      return `${secretName} uses a committed test-only secret and is not allowed in deployable environments (${nodeEnv}).`;
    }

    if (secretValue.length < minDeployableSecretLength) {
      return `${secretName} is too short (${secretValue.length} chars) — deployable environments (${nodeEnv}) require a minimum of ${minDeployableSecretLength} characters.`;
    }
  }

  return null;
}
