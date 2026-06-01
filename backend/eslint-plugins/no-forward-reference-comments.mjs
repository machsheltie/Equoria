/**
 * Equoria-d1l20 — shared inline ESLint plugin: no-forward-reference-comments sentinel.
 *
 * Detects comments that reference future work, pending issues, unmerged PRs, or
 * deferred implementation without a corresponding bd issue or explicit rationale.
 *
 * This enforces Principle 4 (Substance over appearance) from CLAUDE.md: forward-reference
 * comments that rot in the codebase produce false confidence ("we have a plan") without
 * actual documentation or tracking. A deferred-work marker without a bd issue ID creates
 * silent debt — no way to track it, no visibility into scope, and no enforcement that the
 * work ever ships.
 *
 * Severity is 'warn' by default (non-blocking) because legitimate forward-reference comments
 * exist (e.g., "See Equoria-abcd for the full context" in a working implementation).
 * The rule warns on patterns that lack a bd issue reference — the developer can either:
 *   (a) add the bd issue ID (e.g. a deferred-work marker followed by "(Equoria-abcd):"),
 *   (b) link to unmerged PR (no longer a forward-reference, part of current work), or
 *   (c) remove the comment if it's obsolete.
 *
 * Test files may disable this rule via eslint-disable comment if needed (e.g., testing
 * fixtures or mocking patterns that use forward-references).
 *
 * This lives in a shared module (imported by backend/eslint.config.mjs and the repo-root
 * eslint.config.js) so the rule is consistently enforced across all contexts.
 *
 * IMPORTANT (Equoria-tnpa0): the explanatory comments below deliberately AVOID spelling
 * out the literal trigger phrases the rule scans for. This file is the rule's own
 * definition; under the backend config (which registers this rule for backend files) a
 * doc comment containing a literal trigger phrase would self-match and emit a noise
 * warning against this very file. The trigger phrases therefore live ONLY inside the
 * regex literals (which are code, not comments — the rule does not scan code), never in
 * prose. A blanket file-level `eslint-disable` is intentionally NOT used: the root
 * eslint config does not register this rule for backend files, so a disable directive
 * here would error as "rule not found" under the root lint pass.
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
        'Forward-reference comment lacks a bd issue ID. Link it (e.g. "(Equoria-abcd): ...") or remove it. See Equoria-d1l20 / CLAUDE.md Principle 4.',
      futureImplementation:
        'Future-tense implementation comment ("{{ pattern }}") suggests deferred work without tracking. Add a bd issue ID (e.g. "(Equoria-abcd): ...") or explain the deferral inline. See Equoria-d1l20 / CLAUDE.md Principle 4.',
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

          // Pattern 1: a bare deferred-work marker (the two-letter task tags) with no
          // bd issue ID. A parenthesised bd issue ("(Equoria-abcd):"), a "#1234" ref,
          // or the words "issue"/"bd" immediately after the tag are treated as tracked
          // work and excluded. The "(?!\s+later\b)" guard yields precedence to Pattern 2
          // so deferred-with-"later" phrasing is categorized as futureImplementation
          // rather than a bare forward-reference.
          const todoMatch = text.match(
            /^(TODO|FIXME)(?!\s+later\b)[\s:]+((?!Equoria-|#\d|issue|bd)[^]*?)$/i,
          );
          // A comment that explicitly references a bd issue (the words "bd issue", or an
          // Equoria-xxxx id anywhere) is tracked work, not an untracked forward-reference
          // — exclude it (mirrors the parenthesised-issue carve-out documented above).
          const referencesBdIssue = /\b(?:bd\s+issue|Equoria-[A-Za-z0-9]+)/i.test(text);
          if (todoMatch && !referencesBdIssue) {
            context.report({
              loc: comment.loc,
              messageId: 'forwardReference',
            });
            return;
          }

          // Pattern 2: future-tense implementation hints with no bd issue. Excludes any
          // comment that references an Equoria-xxxx id or points at a tracked issue/PR.
          const futurePattern =
            /(Will\s+be\s+implemented|Will\s+support|Future\s+(?:feature|expansion|support)|Pending\s+(?:implementation|work|decision)|Coming\s+soon|TODO\s+later|FIXME\s+later|Need\s+to\s+(?:refactor|fix|implement)|Should\s+(?:refactor|implement))/i;

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

          // Pattern 3: a "see"-style pointer at unmerged work (an issue/PR) with no bd
          // context. Excludes pointers that already carry an Equoria-xxxx id or "#1234".
          const seeUnmergedMatch = text.match(
            /see\s+(?:issue|pr|pull\s+request|pull)(?!\s+(?:Equoria-|#\d))/i,
          );
          if (seeUnmergedMatch && !text.match(/Equoria-[A-Za-z0-9]+/)) {
            context.report({
              loc: comment.loc,
              messageId: 'forwardReference',
            });
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
