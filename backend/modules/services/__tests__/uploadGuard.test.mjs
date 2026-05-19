/**
 * uploadGuard — sentinel-positive unit tests (Equoria-9m1u)
 *
 * Proves the upload gate FIRES on real upload-attack payloads (not merely
 * "passes when nothing is wrong"). Pure logic — no mocks (CLAUDE.md
 * Testing Philosophy: no mocks ever; this utility has no DB/network deps).
 *
 * Coverage maps 1:1 to SECURITY.md §7 File Upload Security categories:
 *   - size cap (oversize rejected)
 *   - MIME allow-list (disallowed declared Content-Type rejected)
 *   - extension allow-list / ext↔MIME↔content agreement (mismatch rejected)
 *   - magic-byte content sniff (script-disguised-as-jpg rejected)
 *   - filename sanitization (path traversal stripped, null byte rejected)
 *   - valid PNG / JPEG / GIF / WebP allowed
 *   - malformed / empty buffer → fail closed
 *   - A08 integrity checksum present on accepted uploads
 */

import { describe, it, expect } from '@jest/globals';

import { assertSafeUpload, sanitizeFilename, DEFAULT_MAX_UPLOAD_BYTES } from '../../../utils/uploadGuard.mjs';

// ── Real magic-byte signatures (minimal valid headers) ────────────────
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.from([0x01, 0x00, 0x01, 0x00])]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'latin1'),
]);
// A shell/polyglot disguised as a .jpg — real attack payload.
const SHELL_SCRIPT = Buffer.from('#!/bin/sh\nrm -rf /\n', 'latin1');

function expectRejected(fn) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    expect(err.statusCode).toBe(400);
  }
  expect(threw).toBe(true);
}

// ── Size cap ──────────────────────────────────────────────────────────

describe('size cap (sentinel: gate fires on oversize)', () => {
  it('rejects a file larger than the configured cap', () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(11, 0x00)]);
    expectRejected(() =>
      assertSafeUpload({
        filename: 'big.png',
        declaredMimeType: 'image/png',
        buffer: tooBig,
        maxBytes: 10,
      }),
    );
  });

  it('default cap is 5MB', () => {
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });
});

// ── MIME allow-list ───────────────────────────────────────────────────

describe('MIME allow-list (sentinel: gate fires on disallowed/declared-mismatch MIME)', () => {
  it('rejects a disallowed declared MIME even when bytes are a valid PNG', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'x.png',
        declaredMimeType: 'application/x-msdownload',
        buffer: PNG,
      }),
    );
  });

  it('rejects when declared MIME disagrees with sniffed type (gif bytes claimed as png)', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'x.png',
        declaredMimeType: 'image/png',
        buffer: GIF,
      }),
    );
  });
});

// ── Extension ↔ content agreement ─────────────────────────────────────

describe('extension allow-list (sentinel: gate fires on ext/content mismatch)', () => {
  it('rejects PNG bytes uploaded with a .jpg extension', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'evil.jpg',
        declaredMimeType: 'image/jpeg',
        buffer: PNG,
      }),
    );
  });

  it('rejects a filename with no extension', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'noext',
        declaredMimeType: 'image/png',
        buffer: PNG,
      }),
    );
  });
});

// ── Magic-byte content sniff (the critical anti-spoof check) ───────────

describe('magic-byte sniff (sentinel: gate fires on content spoof)', () => {
  it('rejects a shell script disguised as a .jpg with image/jpeg Content-Type', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'photo.jpg',
        declaredMimeType: 'image/jpeg',
        buffer: SHELL_SCRIPT,
      }),
    );
  });

  it('rejects an HTML polyglot with a .png extension', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'pic.png',
        declaredMimeType: 'image/png',
        buffer: Buffer.from('<html><script>alert(1)</script></html>', 'latin1'),
      }),
    );
  });
});

// ── Filename sanitization ─────────────────────────────────────────────

describe('filename sanitization (sentinel: traversal/null-byte neutralized)', () => {
  it('strips path traversal and produces a safe basename', () => {
    const result = assertSafeUpload({
      filename: '../../../etc/passwd.png',
      declaredMimeType: 'image/png',
      buffer: PNG,
    });
    expect(result.safeFilename).toBe('passwd.png');
    expect(result.safeFilename).not.toContain('/');
    expect(result.safeFilename).not.toContain('..');
  });

  it('strips Windows-style traversal', () => {
    const result = assertSafeUpload({
      filename: '..\\..\\windows\\system32\\evil.png',
      declaredMimeType: 'image/png',
      buffer: PNG,
    });
    expect(result.safeFilename).toBe('evil.png');
  });

  it('rejects a null-byte truncation filename ("a.png\\0.php")', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'a.png\u0000.php',
        declaredMimeType: 'image/png',
        buffer: PNG,
      }),
    );
  });

  it('rejects a control-character filename', () => {
    expect(sanitizeFilename('img\u0007.png')).toBeNull();
    expect(sanitizeFilename('img\u007f.png')).toBeNull();
    expect(sanitizeFilename('a.png\u0000.php')).toBeNull();
  });

  it('rejects "." and ".." and empty/leading-dot names', () => {
    expect(sanitizeFilename('.')).toBeNull();
    expect(sanitizeFilename('..')).toBeNull();
    expect(sanitizeFilename('')).toBeNull();
    expect(sanitizeFilename('/')).toBeNull();
    // ".htaccess" → leading dots stripped → "htaccess" (no traversal risk)
    expect(sanitizeFilename('.htaccess')).toBe('htaccess');
  });
});

// ── Valid uploads pass ────────────────────────────────────────────────

describe('valid allow-listed images are accepted', () => {
  it.each([
    ['photo.jpg', 'image/jpeg', JPEG, 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg', JPEG, 'image/jpeg'],
    ['pic.png', 'image/png', PNG, 'image/png'],
    ['anim.gif', 'image/gif', GIF, 'image/gif'],
    ['modern.webp', 'image/webp', WEBP, 'image/webp'],
  ])('accepts %s', (filename, mime, buffer, expectedType) => {
    const result = assertSafeUpload({ filename, declaredMimeType: mime, buffer });
    expect(result.detectedType).toBe(expectedType);
    expect(result.safeFilename).toBe(filename);
    expect(result.size).toBe(buffer.length);
    // A08 integrity checksum present and is a sha256 hex digest.
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── Fail-closed on malformed / empty input ────────────────────────────

describe('fail-closed on malformed/empty input (EDGE_CASE §3)', () => {
  it('rejects an empty buffer', () => {
    expectRejected(() =>
      assertSafeUpload({ filename: 'x.png', declaredMimeType: 'image/png', buffer: Buffer.alloc(0) }),
    );
  });

  it('rejects a missing/non-Buffer buffer', () => {
    expectRejected(() =>
      assertSafeUpload({ filename: 'x.png', declaredMimeType: 'image/png', buffer: 'not-a-buffer' }),
    );
  });

  it('rejects a null/undefined/garbage input object', () => {
    expectRejected(() => assertSafeUpload(null));
    expectRejected(() => assertSafeUpload(undefined));
    expectRejected(() => assertSafeUpload('nope'));
    expectRejected(() => assertSafeUpload(42));
  });

  it('does NOT trust declared MIME when bytes are unknown garbage', () => {
    expectRejected(() =>
      assertSafeUpload({
        filename: 'trust.png',
        declaredMimeType: 'image/png',
        buffer: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
      }),
    );
  });
});
