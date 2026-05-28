/**
 * schema.prisma comment-accuracy sentinel (Equoria-rw2yo).
 *
 * The schema is "documentation that runs" — Prisma comments above a model
 * field are what a future contributor reads before they touch the column.
 * When a comment lies (says plaintext / says not-yet-encrypted / mentions
 * a planned encryption util that has since landed), the next person to
 * add code can break invariants the runtime is silently enforcing.
 *
 * This sentinel guards specific lies tied to CLOSED issues. Each assertion
 * is keyed to the schema field whose runtime contract is encoded in
 * SECURITY.md or a closed bd issue:
 *
 *   - mfaSecret comment must NOT claim plaintext / not-yet-encrypted
 *     (Equoria-yi13v 2026-05-18 — AES-256-GCM at-rest).
 *
 * Future entries (one assertion per closed-issue/schema-field pair) keep
 * the schema honest as encryption / retention / lifecycle invariants
 * accumulate.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(
  HERE,
  '..',
  '..',
  'packages',
  'database',
  'prisma',
  'schema.prisma',
);

function loadSchema() {
  return fs.readFileSync(SCHEMA_PATH, 'utf8');
}

// Pull out the doc-block immediately preceding a named field (the run of
// `///` lines right above `field<spaces>Type`). Returns the joined text or
// an empty string if the field is not found or has no doc comment.
function commentAboveField(schema, fieldName) {
  const lines = schema.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([a-zA-Z_]\w*)\s+\S/);
    if (m && m[1] === fieldName) {
      const comments = [];
      let j = i - 1;
      while (j >= 0 && /^\s*\/\/\//.test(lines[j])) {
        comments.unshift(lines[j].replace(/^\s*\/\/\/\s?/, ''));
        j--;
      }
      return comments.join(' ');
    }
  }
  return '';
}

describe('schema.prisma comment accuracy (Equoria-rw2yo)', () => {
  it('mfaSecret doc-comment reflects Equoria-yi13v at-rest encryption (not the stale plaintext claim)', () => {
    const schema = loadSchema();
    const c = commentAboveField(schema, 'mfaSecret');
    expect(c.length).toBeGreaterThan(0);

    // Stale claims that MUST NOT appear after Equoria-yi13v landed:
    expect(c).not.toMatch(/At-rest encryption is NOT yet applied/i);
    expect(c).not.toMatch(/no encryption util exists in the codebase/i);

    // Current invariants that MUST be reflected:
    expect(c).toMatch(/encrypted at rest/i);
    expect(c).toMatch(/AES-256-GCM/);
    expect(c).toMatch(/fieldEncryption|FIELD_ENCRYPTION_KEY|Equoria-yi13v/);
  });
});
