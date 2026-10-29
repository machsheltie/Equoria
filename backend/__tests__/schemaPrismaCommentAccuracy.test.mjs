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
 *   - (retired) mfaSecret comment had to reflect Equoria-yi13v at-rest
 *     encryption. The column itself is gone: owner ruling 2026-10-29 (q305)
 *     removed authenticator-app sign-in, and q304 retired the trainer discovery
 *     slots. The cases below pin both sets of fields absent from the schema.
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
const SCHEMA_PATH = path.resolve(HERE, '..', '..', 'packages', 'database', 'prisma', 'schema.prisma');

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

function modelBlock(schema, modelName) {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start < 0) {
    return '';
  }
  return schema.slice(start, schema.indexOf('\n}', start));
}

describe('schema.prisma comment accuracy (Equoria-rw2yo)', () => {
  it.each(['mfaSecret', 'mfaEnabled', 'mfaRecoveryCodes'])(
    'User has no %s field: authenticator-app sign-in is removed (q305)',
    fieldName => {
      const user = modelBlock(loadSchema(), 'User');
      expect(user).toMatch(/emailVerified/); // the block was found
      expect(commentAboveField(user, fieldName)).toBe('');
      expect(user).not.toMatch(new RegExp(`^\\s*${fieldName}\\s`, 'm'));
    },
  );

  it('Trainer has no discoverySlots field: trainer discovery is retired (q304)', () => {
    const trainer = modelBlock(loadSchema(), 'Trainer');
    expect(trainer).toMatch(/speciality/); // the block was found
    expect(trainer).not.toMatch(/^\s*discoverySlots\s/m);
    expect(trainer).not.toMatch(/discovery_slots/);
  });
});
