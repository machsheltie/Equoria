/**
 * The safe-report helpers behind the owner's Diagnose reports (Equoria-yqi49,
 * Equoria-brh8c): held shows and payroll failures share them.
 *
 * Never in a report: emails, passwords, tokens, cookies, IP addresses,
 * connection strings or any environment value other than the deployed commit.
 * Every free text (error messages, stacks, stored JSON) goes through
 * redactSecrets before it is written.
 */

/** Environment keys whose values are secret whatever their length. */
const secretKeyPattern =
  /SECRET|TOKEN|PASSWORD|PASSWD|KEY|SALT|COOKIE|CREDENTIAL|PRIVATE|DSN|URL|URI/i;

function escapeForRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Environment values that must never be printed (the commit is the one exception). */
function secretEnvValues() {
  return Object.entries(process.env)
    .filter(([key, value]) => {
      if (key === 'RAILWAY_GIT_COMMIT_SHA' || typeof value !== 'string') {
        return false;
      }
      const trimmed = value.trim();
      // Short values (true, 3600, production) are settings, not secrets, and
      // would blank ordinary words out of the report.
      return secretKeyPattern.test(key) ? trimmed.length >= 8 : trimmed.length >= 20;
    })
    .map(([, value]) => value.trim())
    .sort((a, b) => b.length - a.length);
}

/**
 * Remove anything secret from a piece of free text.
 *
 * @param {string} text
 * @returns {string}
 */
export function redactSecrets(text) {
  if (typeof text !== 'string' || text === '') {
    return text ?? '';
  }
  let out = text;
  for (const value of secretEnvValues()) {
    out = out.replace(new RegExp(escapeForRegExp(value), 'g'), '[setting removed]');
  }
  return (
    out
      .replace(
        /\b(?:postgres(?:ql)?|redis|rediss|mysql|mongodb(?:\+srv)?|amqps?):\/\/\S+/gi,
        '[address removed]',
      )
      .replace(
        /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi,
        (_m, scheme) => `${scheme}[credentials removed]@`,
      )
      .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[token removed]')
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [token removed]')
      .replace(
        /\b(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|set-cookie)(["']?\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)/gi,
        (_m, key, sep) => `${key}${sep}[removed]`,
      )
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email removed]')
      .replace(
        /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g,
        '[ip removed]',
      )
      .replace(/(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}/gi, '[ip removed]')
      // A shortened IPv6 address always has "::"; nothing else in a report does.
      .replace(/[0-9a-f:]*::[0-9a-f:]*/gi, '[ip removed]')
  );
}

/** Make the paths in a stack relative to the repository, with forward slashes. */
export function relativeStack(stack) {
  return stack
    .replace(/\\/g, '/')
    .replace(
      /(?:file:\/\/\/?)?(?:[A-Za-z]:)?\/[^\s()'"]*?\/(?=(?:backend|packages|frontend|node_modules)\/)/g,
      '',
    );
}

/**
 * The source files a set of stacks name, with the first line seen, Equoria's
 * own files only (not node_modules).
 *
 * @param {string[]} stacks repository-relative stacks
 * @returns {string[]}
 */
export function sourceFilesInStacks(stacks) {
  const seen = new Map();
  const pattern =
    /(?:^|[\s(])((?:backend|packages|frontend)\/[^\s():]+?\.(?:mjs|cjs|js|ts|tsx))(?::(\d+))?/g;
  for (const stack of stacks) {
    for (const match of stack.matchAll(pattern)) {
      const [, file, line] = match;
      if (!file.includes('node_modules/') && !seen.has(file)) {
        seen.set(file, line ?? null);
      }
    }
  }
  return [...seen.entries()].map(([file, line]) => (line ? `${file}:${line}` : file));
}

export const iso = date => (date ? new Date(date).toISOString() : 'none');
export const fence = text => `\`\`\`\n${text}\n\`\`\``;
