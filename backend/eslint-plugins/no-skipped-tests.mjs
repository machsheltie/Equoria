/**
 * Equoria-cl5y0 — shared inline ESLint plugin: no-skipped-tests sentinel.
 *
 * Forbids test.skip, it.skip, describe.skip, test.todo, it.todo in test files.
 * Skipped tests hide broken code and produce false confidence. If a test is
 * flaky or slow, fix the underlying issue instead of skipping it.
 *
 * This enforces Principle 2 (Beta is falsifiable) from CLAUDE.md: a beta gate
 * must fail when something is broken. Skipped tests produce a green signal
 * without exercising the real failure mode — defeating the gate.
 *
 * Severity is 'error' (fail-closed) to prevent accidental skipped tests from
 * being committed. The only legitimate use case for skip is temporary
 * debugging (which must be reverted before commit).
 *
 * This lives in a shared module (imported by BOTH backend/eslint.config.mjs
 * and the repo-root eslint.config.js) so the rule is consistently enforced
 * across all test contexts.
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Skipped tests hide broken code and produce false confidence (Principle 2 — Beta is falsifiable). Fix the underlying issue instead of skipping it.',
    },
    schema: [],
    messages: {
      skipped:
        "Skipped tests defeat the purpose of testing. If a test is flaky, fix the underlying issue. If it's slow, optimize it. If it's brittle, make it more resilient. Never ship skipped tests (Equoria-cl5y0 / CLAUDE.md Principle 2).",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        // Match test.skip, it.skip, describe.skip, test.todo, it.todo
        // callee structure: MemberExpression with property name = skip/todo
        // and object = Identifier with name = test/it/describe
        if (callee.type !== 'MemberExpression') {
          return;
        }

        const propertyName = callee.property?.name;
        const objectName = callee.object?.name;

        // Check for skip or todo on test(), it(), describe()
        if (
          (propertyName === 'skip' || propertyName === 'todo') &&
          (objectName === 'test' || objectName === 'it' || objectName === 'describe')
        ) {
          context.report({
            node,
            messageId: 'skipped',
          });
        }
      },
    };
  },
};

export const equoriaSkippedTestsPlugin = {
  rules: {
    'no-skipped-tests': rule,
  },
};
