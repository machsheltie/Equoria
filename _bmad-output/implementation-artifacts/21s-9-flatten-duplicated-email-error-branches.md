# Story 21S-9: Flatten Duplicated Email-Error Branches in RegisterPage

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P1
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change H / Finding P1-10
**Owner:** FrontendSpecialistAgent

## Problem

The 2026-04-03 proposal (Change 5) specified a flat `if/else if` mapping for server error messages:

```ts
if (message.includes('email') && message.includes('taken')) {
  setValidationErrors({ email: '...' });
} else if (message.includes('username')) {
  setValidationErrors({ username: '...' });
}
```

The implementation at `frontend/src/pages/RegisterPage.tsx:85-99` ended up nesting `'already exists' || 'already in use'` inside a duplicated `email` check. It works, but the branches are redundant and maintenance-risky:

```ts
if (message.includes('already exists') || message.includes('already in use')) {
  if (message.includes('email')) {
    setValidationErrors({ email: '...' });
  } else {
    setValidationErrors({ username: '...' });
  }
} else if (message.includes('email')) {   // second email check
  setValidationErrors({ email: '...' });
} else if (message.includes('username')) {
  setValidationErrors({ username: '...' });
}
```

## Acceptance Criteria

- [ ] Replace the `onError` handler in `RegisterPage.tsx` with a single-level `if/else if` that covers both `already exists` / `already in use` / `taken` phrasings under one email branch and one username branch.
- [ ] Existing auth test suite still passes.
- [ ] Add a small test for the `'already in use'` wording if it is not currently covered.

## Verification

- [ ] `npm --prefix frontend run test:run -- RegisterPage` passes.
- [ ] Manual: trigger duplicate email registration, confirm inline error.
- [ ] Manual: trigger duplicate username registration, confirm inline error.

## Out of Scope

- Redesigning the error message strings.
