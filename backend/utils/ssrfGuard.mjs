/**
 * ssrfGuard — Server-Side Request Forgery (SSRF) validation gate.
 *
 * Equoria-4dva: A reusable, fail-closed SSRF guard that ANY future feature
 * accepting a user-supplied URL (webhook, avatar-by-URL, OAuth redirect,
 * link preview, server-side import, etc.) MUST call BEFORE issuing any
 * outbound request to that URL. This is a hard prerequisite GATE — it is
 * intentionally built ahead of any consumer (Equoria-zuva / SECURITY.md
 * A10 records SSRF as N/A *today* precisely because no user-URL surface
 * exists; this utility makes the first such feature safe by construction).
 *
 * SECURITY.md A10 (OWASP A10:2021 — SSRF) documents the exact behavior
 * implemented here. Do not contradict that section; update it together
 * with this file.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CONTRACT — how to use this gate
 * ──────────────────────────────────────────────────────────────────────
 *
 *   import { assertSafeOutboundUrl } from '../utils/ssrfGuard.mjs';
 *
 *   // In any handler that will fetch a user-supplied URL:
 *   const safeUrl = await assertSafeOutboundUrl(req.body.webhookUrl);
 *   // throws AppError(400) if the URL is unsafe — fail CLOSED.
 *   await fetch(safeUrl); // only reached for vetted public http(s) URLs
 *
 * `assertSafeOutboundUrl` performs DNS resolution and re-validates every
 * resolved A/AAAA address, which defeats DNS-rebinding (the hostname could
 * resolve to a public IP at validation time and a private IP later — by
 * checking the resolved addresses *now* and requiring the caller to pin /
 * re-check at fetch time, the rebind window is closed at the validation
 * boundary). For callers that cannot afford a DNS round-trip there is a
 * synchronous syntactic-only check `validateOutboundUrl` — but it does NOT
 * defeat rebinding (a hostname is not an IP) and MUST be paired with a
 * fetch layer that pins the resolved IP. Prefer the async form.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FAIL-CLOSED INVARIANT (EDGE_CASE_FIX_DISCIPLINE.md §3)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Every code path that does not affirmatively prove the URL is a public
 * http(s) endpoint REJECTS. Parse errors, DNS failures, empty resolution,
 * unexpected exceptions — all reject with a generic AppError. There is no
 * silent catch, no allow-through-on-error, no "best effort" path.
 */

import dns from 'dns';
import net from 'net';

import AppError from '../errors/AppError.mjs';
import logger from './logger.mjs';

const resolve4 = dns.promises.resolve4;
const resolve6 = dns.promises.resolve6;

/** Only these URL schemes may ever reach an outbound fetch. */
const ALLOWED_PROTOCOLS = Object.freeze(['http:', 'https:']);

/**
 * Hostnames that are never legitimate outbound targets even before DNS.
 * (DNS resolution covers the IP forms; this is defense-in-depth for the
 * literal names and the cloud metadata service.)
 */
const BLOCKED_HOSTNAMES = Object.freeze(
  new Set([
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    // GCP / generic metadata DNS alias
    'metadata',
    'metadata.google.internal',
  ]),
);

/**
 * The cloud instance metadata IPv4 address (AWS/GCP/Azure/OpenStack).
 * 169.254.169.254 is link-local so the link-local /16 check below also
 * covers it, but it is called out explicitly so the intent is auditable.
 */
const CLOUD_METADATA_IPV4 = '169.254.169.254';

/**
 * Parse an IPv4 dotted-quad into its 32-bit unsigned integer, or null if
 * it is not a syntactically valid IPv4 literal.
 */
function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/**
 * True if the given IPv4 string is in any private / loopback / link-local
 * / reserved / non-routable range. Fail-closed: anything that is not a
 * parseable public unicast IPv4 is treated as unsafe.
 */
function isBlockedIpv4(ip) {
  const v = ipv4ToInt(ip);
  if (v === null) {
    // Not a clean IPv4 literal — refuse rather than guess.
    return true;
  }

  const inRange = (cidrBase, prefix) => {
    const baseInt = ipv4ToInt(cidrBase);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (v & mask) === (baseInt & mask);
  };

  return (
    inRange('0.0.0.0', 8) || // "this" network / unspecified
    inRange('10.0.0.0', 8) || // RFC1918 private
    inRange('100.64.0.0', 10) || // RFC6598 carrier-grade NAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (incl. 169.254.169.254 metadata)
    inRange('172.16.0.0', 12) || // RFC1918 private
    inRange('192.0.0.0', 24) || // IETF protocol assignments
    inRange('192.0.2.0', 24) || // TEST-NET-1 documentation
    inRange('192.168.0.0', 16) || // RFC1918 private
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2 documentation
    inRange('203.0.113.0', 24) || // TEST-NET-3 documentation
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved / broadcast (covers 255.255.255.255)
  );
}

/**
 * Normalize and test an IPv6 address. Covers loopback (::1),
 * unspecified (::), unique-local (fc00::/7), link-local (fe80::/10),
 * and IPv4-mapped/compat addresses (which are re-checked as IPv4).
 * Fail-closed for anything not a clean global-unicast IPv6.
 */
function isBlockedIpv6(ip) {
  const raw = ip.toLowerCase().split('%')[0]; // strip zone id

  if (raw === '::1' || raw === '::') {
    return true; // loopback / unspecified
  }

  // IPv4-mapped / IPv4-compatible in DOTTED form (::ffff:127.0.0.1,
  // ::127.0.0.1): re-validate the embedded IPv4 with the v4 rules.
  const mappedDotted = raw.match(/^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedDotted) {
    return isBlockedIpv4(mappedDotted[1]);
  }

  // IPv4-mapped in HEX form. Node's URL parser normalizes
  // `[::ffff:127.0.0.1]` → `[::ffff:7f00:1]`, so the dotted regex above
  // does NOT catch it. Decode the two trailing hextets back to dotted
  // IPv4 and range-check. (Sentinel-caught: Equoria-4dva test.)
  const mappedHex = raw.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
      const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isBlockedIpv4(dotted);
    }
    return true; // unparseable mapped form — refuse
  }

  // First hextet for prefix-based ranges.
  const firstHextet = raw.split(':')[0] || '0';
  const hv = parseInt(firstHextet, 16);
  if (Number.isNaN(hv)) {
    return true; // unparseable — refuse
  }

  // fc00::/7  — unique local addresses (fc.. and fd..)
  if ((hv & 0xfe00) === 0xfc00) {
    return true;
  }
  // fe80::/10 — link-local
  if ((hv & 0xffc0) === 0xfe80) {
    return true;
  }
  // ff00::/8  — multicast
  if ((hv & 0xff00) === 0xff00) {
    return true;
  }

  return false;
}

/**
 * True if `address` (an IP literal of family `family`) is a blocked
 * (private / loopback / link-local / metadata / reserved) address.
 */
function isBlockedIpLiteral(address, family) {
  if (typeof address !== 'string' || address.length === 0) {
    return true; // fail closed
  }
  if (address === CLOUD_METADATA_IPV4) {
    return true; // explicit, auditable
  }
  if (family === 4 || net.isIPv4(address)) {
    return isBlockedIpv4(address);
  }
  if (family === 6 || net.isIPv6(address)) {
    return isBlockedIpv6(address);
  }
  return true; // unknown family — refuse
}

/**
 * Synchronous, syntactic-only validation. Validates protocol, hostname
 * shape, and — if the host is already an IP literal — the IP range. Does
 * NOT perform DNS resolution, so it does NOT defeat DNS rebinding for
 * hostname targets. Use only when a DNS round-trip is impossible and the
 * fetch layer pins the resolved IP; otherwise prefer
 * `assertSafeOutboundUrl`.
 *
 * @param {unknown} rawUrl
 * @returns {{ ok: true, url: URL } | { ok: false, reason: string }}
 */
export function validateOutboundUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return { ok: false, reason: 'URL must be a non-empty string' };
  }

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return { ok: false, reason: `Disallowed protocol: ${url.protocol}` };
  }

  // Credentials in the URL (user:pass@) are an SSRF/credential-leak smell.
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'Embedded credentials are not allowed' };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname.length === 0) {
    return { ok: false, reason: 'Missing hostname' };
  }
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: `Blocked hostname: ${hostname}` };
  }

  // If the host is already an IP literal, range-check it now.
  if (net.isIP(hostname) !== 0) {
    const family = net.isIPv4(hostname) ? 4 : 6;
    if (isBlockedIpLiteral(hostname, family)) {
      return { ok: false, reason: `Blocked IP literal: ${hostname}` };
    }
  }

  return { ok: true, url };
}

/**
 * Resolve a hostname to all A and AAAA addresses. Fail-closed: any
 * resolver error or empty result is an exception, never an empty-allow.
 */
async function resolveAllAddresses(hostname) {
  const results = [];
  const settled = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  for (const r of settled) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      results.push(...r.value);
    }
  }
  if (results.length === 0) {
    throw new AppError('Outbound URL host could not be resolved', 400);
  }
  return results;
}

/**
 * THE GATE. Validate a user-supplied URL for outbound-request safety,
 * including DNS resolution + per-address re-validation to defeat DNS
 * rebinding. Returns the vetted href on success. Throws a generic
 * AppError(400) on ANY failure — fail CLOSED. There is no path that
 * resolves to "allowed" without affirmatively proving every resolved
 * address is a public unicast IP.
 *
 * @param {unknown} rawUrl  the user-supplied URL
 * @returns {Promise<string>} the validated absolute URL href
 * @throws {AppError} 400 on any unsafe/unverifiable input
 */
export async function assertSafeOutboundUrl(rawUrl) {
  const syntactic = validateOutboundUrl(rawUrl);
  if (!syntactic.ok) {
    logger.warn(`[ssrfGuard] rejected URL (syntactic): ${syntactic.reason}`);
    throw new AppError('Outbound URL rejected by SSRF policy', 400);
  }

  const { url } = syntactic;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // If the host is already an IP literal it was range-checked in
  // validateOutboundUrl; no DNS needed.
  if (net.isIP(hostname) !== 0) {
    return url.href;
  }

  let addresses;
  try {
    addresses = await resolveAllAddresses(hostname);
  } catch (err) {
    // Fail CLOSED. Re-throw AppError as-is; wrap anything else generically
    // (never swallow, never allow-through). EDGE_CASE_FIX_DISCIPLINE §3.
    if (AppError.isAppError(err)) {
      logger.warn(`[ssrfGuard] rejected URL (dns): ${err.message}`);
      throw err;
    }
    logger.warn('[ssrfGuard] rejected URL (resolver error, fail-closed)');
    throw new AppError('Outbound URL could not be safely resolved', 400);
  }

  for (const addr of addresses) {
    const family = net.isIPv4(addr) ? 4 : net.isIPv6(addr) ? 6 : 0;
    if (family === 0 || isBlockedIpLiteral(addr, family)) {
      logger.warn(`[ssrfGuard] rejected URL: host ${hostname} resolves to blocked address`);
      throw new AppError('Outbound URL resolves to a non-public address', 400);
    }
  }

  return url.href;
}

export default assertSafeOutboundUrl;
