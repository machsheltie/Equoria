/**
 * ssrfGuard — sentinel-positive unit tests (Equoria-4dva)
 *
 * Proves the SSRF gate FIRES on real SSRF payloads (not merely "passes
 * when nothing is wrong"). Pure logic; the only mocked external dependency
 * is `dns` (network resolution) — DNS behavior is the rebinding attack
 * vector and must be controllable to assert resolved-IP re-validation.
 *
 * Coverage maps 1:1 to SECURITY.md A10 blocked categories:
 *   - non-http(s) schemes (file:, gopher:, ftp:, data:)
 *   - loopback (127.0.0.0/8, ::1)
 *   - RFC1918 private (10/8, 172.16/12, 192.168/16)
 *   - link-local (169.254/16) incl. cloud metadata 169.254.169.254
 *   - IPv6 ULA (fc00::/7) and link-local (fe80::/10)
 *   - localhost / metadata hostnames
 *   - DNS-rebind shape: public-looking host that RESOLVES to a private IP
 *   - malformed URL → fail closed
 *   - ordinary public https → allowed
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dns so resolve4/resolve6 are deterministic (rebinding is a DNS attack).
const mockResolve4 = jest.fn();
const mockResolve6 = jest.fn();

jest.unstable_mockModule('dns', () => ({
  default: {
    promises: { resolve4: mockResolve4, resolve6: mockResolve6 },
  },
  promises: { resolve4: mockResolve4, resolve6: mockResolve6 },
}));

const { validateOutboundUrl, assertSafeOutboundUrl } = await import('../utils/ssrfGuard.mjs');

beforeEach(() => {
  mockResolve4.mockReset();
  mockResolve6.mockReset();
  // Default: no records (forces explicit per-test resolution).
  mockResolve4.mockResolvedValue([]);
  mockResolve6.mockResolvedValue([]);
});

// ── Synchronous syntactic gate ────────────────────────────────────────

describe('validateOutboundUrl — disallowed schemes (sentinel: gate fires)', () => {
  it.each([
    ['file:///etc/passwd'],
    ['gopher://127.0.0.1:11211/_stats'],
    ['ftp://internal.example.com/secret'],
    ['data:text/html,<script>alert(1)</script>'],
    ['javascript:alert(1)'],
  ])('rejects non-http(s) scheme: %s', url => {
    const r = validateOutboundUrl(url);
    expect(r.ok).toBe(false);
  });

  it('rejects embedded credentials', () => {
    expect(validateOutboundUrl('https://user:pass@example.com/').ok).toBe(false);
  });

  it('rejects malformed URL (fail closed)', () => {
    expect(validateOutboundUrl('http://[not a url').ok).toBe(false);
    expect(validateOutboundUrl('not-a-url').ok).toBe(false);
    expect(validateOutboundUrl('').ok).toBe(false);
    expect(validateOutboundUrl(null).ok).toBe(false);
    expect(validateOutboundUrl(undefined).ok).toBe(false);
    expect(validateOutboundUrl(12345).ok).toBe(false);
  });

  it('allows an ordinary public https URL syntactically', () => {
    const r = validateOutboundUrl('https://api.stripe.com/v1/charges');
    expect(r.ok).toBe(true);
  });
});

describe('validateOutboundUrl — IP-literal hosts (sentinel: gate fires)', () => {
  it.each([
    ['http://127.0.0.1/admin', 'loopback v4'],
    ['http://127.5.5.5/', 'loopback v4 range'],
    ['http://10.0.0.5/', 'RFC1918 10/8'],
    ['http://172.16.0.1/', 'RFC1918 172.16/12'],
    ['http://172.31.255.255/', 'RFC1918 172.16/12 upper'],
    ['http://192.168.1.1/', 'RFC1918 192.168/16'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['http://169.254.1.1/', 'link-local 169.254/16'],
    ['http://0.0.0.0/', 'unspecified'],
    ['http://255.255.255.255/', 'broadcast/reserved'],
    ['http://100.64.0.1/', 'CGNAT 100.64/10'],
    ['http://[::1]/', 'IPv6 loopback'],
    ['http://[fc00::1]/', 'IPv6 ULA fc00::/7'],
    ['http://[fd12:3456::1]/', 'IPv6 ULA fd..'],
    ['http://[fe80::1]/', 'IPv6 link-local'],
    ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped loopback (dotted input)'],
    ['http://[::ffff:7f00:1]/', 'IPv4-mapped loopback (hex normalized)'],
    ['http://[::ffff:a00:1]/', 'IPv4-mapped 10.0.0.1 (hex normalized)'],
  ])('rejects %s (%s)', url => {
    expect(validateOutboundUrl(url).ok).toBe(false);
  });

  it('allows a public IPv4 literal', () => {
    expect(validateOutboundUrl('https://8.8.8.8/').ok).toBe(true);
  });

  it('allows a public IPv6 literal', () => {
    expect(validateOutboundUrl('https://[2606:4700:4700::1111]/').ok).toBe(true);
  });
});

describe('validateOutboundUrl — blocked hostnames (sentinel: gate fires)', () => {
  it.each([
    ['http://localhost/'],
    ['http://localhost:8080/admin'],
    ['http://metadata.google.internal/'],
    ['http://metadata/'],
  ])('rejects %s', url => {
    expect(validateOutboundUrl(url).ok).toBe(false);
  });
});

// ── Async gate with DNS resolution (rebinding defense) ────────────────

describe('assertSafeOutboundUrl — DNS resolution + rebinding defense', () => {
  it('REJECTS a public-looking host that resolves to a private IP (rebind)', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.5']); // attacker-controlled DNS
    await expect(assertSafeOutboundUrl('https://evil.example.com/')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('REJECTS when host resolves to the cloud metadata IP', async () => {
    mockResolve4.mockResolvedValue(['169.254.169.254']);
    await expect(assertSafeOutboundUrl('https://rebind.attacker.com/')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('REJECTS when ANY resolved address is private (mixed A records)', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34', '127.0.0.1']);
    await expect(assertSafeOutboundUrl('https://mixed.example.com/')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('REJECTS when host resolves to an IPv6 ULA', async () => {
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue(['fc00::1']);
    await expect(assertSafeOutboundUrl('https://v6rebind.example.com/')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('FAILS CLOSED when DNS resolution returns no records', async () => {
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue([]);
    await expect(assertSafeOutboundUrl('https://nxdomain.example.com/')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('FAILS CLOSED when the resolver throws (no allow-through, no silent catch)', async () => {
    mockResolve4.mockRejectedValue(new Error('ESERVFAIL'));
    mockResolve6.mockRejectedValue(new Error('ESERVFAIL'));
    await expect(assertSafeOutboundUrl('https://broken-dns.example.com/')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('FAILS CLOSED on a disallowed scheme before any DNS lookup', async () => {
    await expect(assertSafeOutboundUrl('file:///etc/passwd')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockResolve4).not.toHaveBeenCalled();
  });

  it('ALLOWS a host that resolves only to public addresses', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockResolve6.mockResolvedValue([]);
    await expect(assertSafeOutboundUrl('https://example.com/path?q=1')).resolves.toBe('https://example.com/path?q=1');
  });

  it('ALLOWS a public IP literal without performing DNS', async () => {
    await expect(assertSafeOutboundUrl('https://8.8.8.8/resolve')).resolves.toContain('8.8.8.8');
    expect(mockResolve4).not.toHaveBeenCalled();
  });

  it('REJECTS a private IP literal without performing DNS', async () => {
    await expect(assertSafeOutboundUrl('http://192.168.0.1/')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockResolve4).not.toHaveBeenCalled();
  });
});
