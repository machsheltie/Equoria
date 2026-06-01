/**
 * Equoria-d1l20 — shared inline ESLint plugin: no-forward-reference-comments sentinel.
 *
 * Detects comments that reference future work, pending issues, unmerged PRs, or
 * deferred implementation without a corresponding bd issue or explicit rationale.
 *
 * This enforces Principle 4 (Substance over appearance) from CLAUDE.md: forward-reference
 * comments that rot in the codebase produce false confidence ("we have a plan") without
 * actual documentation or tracking. A comment like "TODO: implement this feature" without
 * a bd issue ID creates silent debt — no way to track it, no visibility into scope, and
 * no enforcement that the work ever ships.
 *
 * Severity is 'warn' by default (non-blocking) because legitimate forward-reference comments
 * exist (e.g., "See Equoria-abcd for the full context" in a working implementation).
 * The rule warns on patterns that lack a bd issue reference — the developer can either:
 *   (a) add the bd issue ID (e.g., "TODO (Equoria-abcd): ..."),
 *   (b) link to unmerged PR (no longer a forward-reference, part of current work), or
 *   (c) remove the comment if it's obsolete.
 *
 * Test files may disable this rule via eslint-disable comment if needed (e.g., testing
 * fixtures or mocking patterns that use forward-references).
 *
 * This lives in a shared module (imported by backend/eslint.config.mjs and the repo-root
 * eslint.config.js) so the rule is consistently enforced across all contexts.
 */

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Forward-reference comments without bd issue IDs rot in the codebase and produce false confidence (Principle 4 — Substance over appearance). Link every forward-reference to a bd issue or remove the comment.',
    },
    schema: [],
    messages: {
      forwardReference:
        'Forward-reference comment lacks a bd issue ID. Link it (e.g., "TODO (Equoria-abcd): ...") or remove it. See Equoria-d1l20 / CLAUDE.md Principle 4.',
      futureImplementation:
        'Future-tense implementation comment ("{{ pattern }}") suggests deferred work without tracking. Add a bd issue ID (e.g., "TODO (Equoria-abcd): ...") or explain the deferral inline. See Equoria-d1l20 / CLAUDE.md Principle 4.',
    },
  },
  create(context) {
    return {
      Program() {
        // Extract all comments from the source code
        const sourceCode = context.sourceCode || context.getSourceCode?.();
        if (!sourceCode || !sourceCode.getAllComments) {
          return;
        }

        const comments = sourceCode.getAllComments?.() || [];

        comments.forEach(comment => {
          const text = comment.value.trim();

          // Skip empty or short comments
          if (text.length < 10) {
            return;
          }

          // Pattern 1: TODO/FIXME without a bd issue ID
          // Matches: "TODO: implement", "FIXME: fix this", "TODO implement"
          // Does NOT match: "TODO (Equoria-abcd):", "TODO #abcd:", "FIXME (see issue)"
          const todoMatch = text.match(/^(TODO|FIXME)[\s:]+((?!Equoria-|#\d|issue|bd)[^]*?)$/i);
          if (todoMatch && !text.match(/Equoria-[A-Za-z0-9]+/)) {
            context.report({
              loc: comment.loc,
              messageId: 'forwardReference',
            });
            return;
          }

          // Pattern 2: Future-tense implementation hints without bd issue
          // Matches: "Will implement", "Future support", "Pending implementation"
          // Does NOT match: comments that reference Equoria-id or explain the plan
          const futurePattern =
            /(Will\s+be\s+implemented|Will\s+support|Future\s+(?:feature|expansion)|Pending\s+(?:implementation|work|decision)|Coming\s+soon|TODO\s+later|FIXME\s+later|Need\s+to\s+(?:refactor|fix|implement)|Should\s+(?:refactor|implement))/i;

          const futureMatch = text.match(futurePattern);
          if (
            futureMatch &&
            !text.match(/Equoria-[A-Za-z0-9]+/) &&
            !text.match(/see\s+(?:issue|pr|pull)/i)
          ) {
            context.report({
              loc: comment.loc,
              messageId: 'futureImplementation',
              data: {
                pattern: futureMatch[1],
              },
            });
            return;
          }

          // Pattern 3: "See" references to unmerged work without bd context
          // Matches: "See PR", "See pull request", "See issue" (without a bd ref)
          // Does NOT match: "See Equoria-abcd PR", "See bd issue abcd"
          const seeUnmergedMatch = text.match(
            /see\s+(?:issue|pr|pull\s+request|pull)(?!\s+(?:Equoria-|#\d))/i,
          );
          if (seeUnmergedMatch && !text.match(/Equoria-[A-Za-z0-9]+/)) {
            context.report({
              loc: comment.loc,
              messageId: 'forwardReference',
            });
            return;
          }
        });
      },
    };
  },
};

export const equoriaForwardReferencesPlugin = {
  rules: {
    'no-forward-reference-comments': rule,
  },
};
