/**
 * Tests for no-forward-reference-comments ESLint rule (Equoria-d1l20)
 * Verifies the rule detects forward-reference comments without bd issue tracking
 */

import { RuleTester } from 'eslint';
import { equoriaForwardReferencesPlugin } from './no-forward-reference-comments.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('no-forward-reference-comments', equoriaForwardReferencesPlugin.rules['no-forward-reference-comments'], {
  valid: [
    // Comments without forward references
    'const x = 1; // simple comment',
    'const x = 1; // increment the counter',
    'const x = 1; // TODO (Equoria-abcd): refactor this',
    'const x = 1; // TODO Equoria-abc123: implement feature',
    'const x = 1; // See Equoria-xyz for the implementation',
    'const x = 1; // FIXME (bd issue abcd): fix this later',
  ],
  invalid: [
    {
      code: 'const x = 1; // TODO: implement this feature',
      errors: [{ messageId: 'forwardReference' }],
    },
    {
      code: 'const x = 1; // FIXME: fix the bug',
      errors: [{ messageId: 'forwardReference' }],
    },
    {
      code: 'const x = 1; // Will be implemented later',
      errors: [{ messageId: 'futureImplementation' }],
    },
    {
      code: 'const x = 1; // TODO later: add validation',
      errors: [{ messageId: 'futureImplementation' }],
    },
    {
      code: 'const x = 1; // See PR for more details',
      errors: [{ messageId: 'forwardReference' }],
    },
    {
      code: 'const x = 1; // Future support for this',
      errors: [{ messageId: 'futureImplementation' }],
    },
    {
      code: 'const x = 1; // Pending implementation',
      errors: [{ messageId: 'futureImplementation' }],
    },
  ],
});

console.log('✓ no-forward-reference-comments tests passed');
