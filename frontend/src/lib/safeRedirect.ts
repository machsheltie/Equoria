/**
 * safeRedirect — CWE-601 Open Redirect Prevention (Equoria-rxkna)
 *
 * Validates that a post-login redirect target is a safe same-origin
 * relative path before navigation. React Router's navigate() accepts any
 * string from location.state, so an attacker who can seed history state
 * before the victim logs in can redirect to an external URL after login.
 *
 * Acceptance rules (isSafeRedirectPath):
 *   ACCEPT  - starts with exactly one "/" and is not protocol-relative or backslash-bypass
 *   REJECT  - protocol-relative URLs: "//" or "/\" or "/%2f" etc.
 *   REJECT  - absolute URLs with any scheme: "https:", "http:", "javascript:", "data:", etc.
 *   REJECT  - percent-encoded variants that decode to the above
 *   REJECT  - bare hostnames without a leading slash
 *   REJECT  - empty, whitespace-only, null, or undefined values
 */

/**
 * Known dangerous URI schemes — checked after lower-casing and percent-decoding.
 * This is an explicit deny-list; the primary gate is the allowlist (must start with "/").
 */
const DANGEROUS_SCHEMES = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
  'chrome:',
  'chrome-extension:',
];

/**
 * Returns true only if `path` is a safe, same-origin relative path suitable
 * for use as a post-login redirect target.
 *
 * Safe means:
 *   1. Non-empty after trimming
 *   2. Starts with exactly one "/" (not "//", "/\", or any percent-encoded variant)
 *   3. Does not contain a URI scheme that could cause the browser to navigate off-origin
 *
 * @param path - The candidate redirect path from location.state.from
 */
export function isSafeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string') return false;

  const trimmed = path.trim();
  if (trimmed.length === 0) return false;

  // Percent-decode once so encoded attacks like %2f%2fevil.com are caught.
  // Use a try/catch: malformed percent-sequences (e.g. "%gg") would throw —
  // treat decode failures as unsafe (fail closed).
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return false;
  }

  // ── Primary gate: must start with exactly "/" ──────────────────────────────
  // This single check rejects:
  //   - absolute URLs ("https://", "http://", "//")
  //   - bare hostnames ("evil.com")
  //   - scheme-only attacks ("javascript:alert(1)")
  //   - anything that doesn't begin with a path separator
  if (!decoded.startsWith('/')) return false;

  // ── Secondary gate: rejects protocol-relative and backslash bypass ─────────
  // "//" → browser treats as protocol-relative → off-origin
  // "/\" or "/\\" → some browsers normalize to "//" (CVE pattern)
  // "/%2f" → percent-encoded second slash in original trimmed string
  //
  // Check both the decoded form and the raw trimmed form because some parsers
  // may only decode once and then re-interpret.
  const secondChar = decoded[1];
  if (secondChar === '/' || secondChar === '\\') return false;

  // Also check the raw trimmed string for encoded second-char bypasses:
  // "/%2f", "/%5c", etc.
  const rawSecondChar = trimmed[1];
  if (rawSecondChar === '/' || rawSecondChar === '\\') return false;

  // "/%2f" encoded in raw — guards the double-encode case where the input is
  // "/%%32f/evil.com": the first decodeURIComponent pass produces "/%2f/evil.com",
  // which starts with "/" but contains a still-encoded second slash. A second
  // decode pass by a downstream consumer would then produce "//evil.com". The
  // secondary-char checks above catch the single-encoded form; this slice catches
  // the raw "%2f"/"%5c" token sitting at position [1..3] before any decode.
  if (trimmed.length >= 4) {
    const rawSecond3 = trimmed.slice(1, 4).toLowerCase();
    if (rawSecond3 === '%2f' || rawSecond3 === '%5c') return false;
  }

  // ── Tertiary gate: explicit scheme deny-list (anchored to start) ────────────
  // Applied to lower-cased decoded value. The primary gate already blocks
  // "javascript:..." (no leading "/"), so this is a defence-in-depth backstop
  // for any future normalisation edge case. IMPORTANT: check startsWith, NOT
  // includes — an unanchored includes() would falsely reject legitimate paths
  // whose query/hash/path segments contain a scheme-like substring, e.g.
  // "/help?topic=data:uri-explainer" or "/article/about-javascript:basics".
  // Since the real security gate is the leading-"/" check above, anchoring
  // the scheme check to the start is both correct and has zero false positives.
  const lower = decoded.toLowerCase();
  if (DANGEROUS_SCHEMES.some(s => lower.startsWith(s))) return false;

  return true;
}

/**
 * Returns `from` if it passes isSafeRedirectPath, otherwise returns `fallback`.
 *
 * Usage in LoginPage:
 *   const destination = safeRedirectTarget(
 *     (location.state as { from?: string })?.from,
 *     '/'
 *   );
 *   navigate(destination, { replace: true });
 *
 * @param from     - The candidate path from location.state.from (may be undefined/null)
 * @param fallback - Safe path to use when `from` fails validation
 */
export function safeRedirectTarget(
  from: string | undefined | null,
  fallback: string
): string {
  return isSafeRedirectPath(from) ? from : fallback;
}
