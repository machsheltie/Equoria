# Sprint Change Proposal — Epic 1 Auth Bug Fixes

**Project:** Equoria
**Date:** 2026-04-03
**Prepared by:** Scrum Master (Correct Course Workflow)
**Trigger:** External code review (Gemini) of Epic 1 — Authentication & User Foundation
**Scope Classification:** MINOR — Direct dev team implementation

---

## Section 1 — Issue Summary

External code review (Gemini) of the Epic 1 / Epic 22 Celestial Night auth implementation identified 9 issues
(3 critical, 3 medium, 2 low, 1 test gap). The original Epic 1 tests passed at 100% (211/211) but lacked
coverage of the 5th password requirement and redirect behaviour, masking real functional bugs introduced
during the Celestial Night auth restyling.

**Discovery:** Post-completion external review — 2026-04-03
**No architectural, PRD-core, or database impacts.**

---

## Section 2 — Impact Analysis

### Files Impacted

| File                                     | Lines          | Issue                                                   |
| ---------------------------------------- | -------------- | ------------------------------------------------------- |
| `frontend/src/pages/RegisterPage.tsx`    | 41–49, 289–294 | `passwordRequirements` missing `hasSpecialChar`         |
| `frontend/src/pages/RegisterPage.tsx`    | 82             | `navigate('/')` should be `navigate('/verify-email')`   |
| `frontend/src/pages/RegisterPage.tsx`    | 123–127        | Generic error; needs inline per-field error mapping     |
| `frontend/src/pages/LoginPage.tsx`       | 46             | `navigate('/')` ignores `location.state.from`           |
| `frontend/src/lib/validation-schemas.ts` | 384            | Strength uses `/[^a-zA-Z0-9]/`; schema uses `/@$!%*?&/` |
| `frontend/src/pages/RegisterPage.tsx`    | 93, 117–118    | Hardcoded `rgb(148,163,184)` — should use design token  |
| Auth test suite                          | Various        | No test for special char UI or redirect behaviour       |

### Epic Impact

- **Epic 1** (complete): Stories 1.1 and 1.3 have AC coverage gaps — supplemented by this proposal
- **Epic 22** (active): Carries these bugs in the Celestial Night auth restyling — fixes applied here
- **All other epics:** Unaffected

---

## Section 3 — Recommended Approach

**Option 1: Direct Adjustment — APPROVED**

All issues are self-contained to 3 files with no architectural ripple. Direct targeted fixes are the
fastest and safest path.

- **Effort:** Low (1–2 dev sessions)
- **Risk:** Low
- **Timeline Impact:** None

---

## Section 4 — Detailed Change Proposals

### Change 1 — CRITICAL: Add Special Character to Password Checklist UI

**Story:** 1.1 — User Registration (AC-3)
**File:** `frontend/src/pages/RegisterPage.tsx`

**OLD (lines 41–49):**

```tsx
const passwordRequirements = useMemo(() => {
  const p = formData.password;
  return {
    minLength: p.length >= 8,
    hasLowercase: /[a-z]/.test(p),
    hasUppercase: /[A-Z]/.test(p),
    hasNumber: /[0-9]/.test(p),
  };
}, [formData.password]);
```

**OLD (lines 289–294) — 4 items rendered:**

```tsx
<RequirementCheck met={passwordRequirements.minLength} label="8+ characters" />
<RequirementCheck met={passwordRequirements.hasLowercase} label="Lowercase" />
<RequirementCheck met={passwordRequirements.hasUppercase} label="Uppercase" />
<RequirementCheck met={passwordRequirements.hasNumber} label="Number" />
```

**NEW:**

```tsx
const passwordRequirements = useMemo(() => {
  const p = formData.password;
  return {
    minLength: p.length >= 8,
    hasLowercase: /[a-z]/.test(p),
    hasUppercase: /[A-Z]/.test(p),
    hasNumber: /[0-9]/.test(p),
    hasSpecialChar: /[@$!%*?&]/.test(p),  // must match passwordSchema exactly
  };
}, [formData.password]);

// 5 items rendered — adjust grid as needed
<RequirementCheck met={passwordRequirements.minLength} label="8+ characters" />
<RequirementCheck met={passwordRequirements.hasLowercase} label="Lowercase" />
<RequirementCheck met={passwordRequirements.hasUppercase} label="Uppercase" />
<RequirementCheck met={passwordRequirements.hasNumber} label="Number" />
<RequirementCheck met={passwordRequirements.hasSpecialChar} label="Special character (@$!%*?&)" />
```

**Rationale:** `passwordSchema` enforces this requirement at submission; the UI must show it so users
know. Regex must match `passwordSchema` exactly (`/@$!%*?&/`) — not a broader pattern.

---

### Change 2 — CRITICAL: Fix Registration Redirect to /verify-email

**Story:** 1.1 — User Registration (AC-4)
**File:** `frontend/src/pages/RegisterPage.tsx`

**OLD (line 82):**

```tsx
{
  onSuccess: () => navigate('/');
}
```

**NEW:**

```tsx
{
  onSuccess: () => navigate('/verify-email');
}
```

**Rationale:** AC-4 requires redirect to `/verify-email` on successful registration. Current redirect
to root bypasses email verification flow entirely.

---

### Change 3 — CRITICAL: Fix Login to Honour `from` Redirect State

**Story:** 1.3 — Session Management / Story 8.1
**File:** `frontend/src/pages/LoginPage.tsx`

**OLD (line 46):**

```tsx
login(result.data, { onSuccess: () => navigate('/') });
```

**NEW:**

```tsx
// Add useLocation import at the top of the component
const location = useLocation();

// In handleSubmit:
login(result.data, {
  onSuccess: () => {
    const from = (location.state as { from?: string })?.from ?? '/';
    navigate(from, { replace: true });
  },
});
```

**Rationale:** `useSessionGuard` stores `from: location.pathname` in redirect state when bouncing
unauthenticated users to login. `LoginPage` must read and honour this to restore the user's original
destination. `replace: true` prevents the login page appearing in browser history.

---

### Change 4 — MEDIUM: Align Special Char Regex in calculatePasswordStrength

**File:** `frontend/src/lib/validation-schemas.ts`

**OLD (line 384):**

```ts
if (/[^a-zA-Z0-9]/.test(password)) score++; // accepts # and all non-alphanumerics
```

**NEW:**

```ts
if (/[@$!%*?&]/.test(password)) score++; // matches passwordSchema exactly
```

**Rationale:** A password like `Password1#` currently scores "Strong" but fails submission validation
because `#` is not in `passwordSchema`'s allowed set `/@$!%*?&/`. Strength indicator and schema must agree.

---

### Change 5 — MEDIUM: Inline Per-Field Server Error Mapping (AC-5)

**Story:** 1.1 — User Registration (AC-5)
**File:** `frontend/src/pages/RegisterPage.tsx`

**OLD (lines 74–83):**

```tsx
register(
  { email: result.data.email, username: result.data.username, ... },
  { onSuccess: () => navigate('/verify-email') }
);
```

**NEW:**

```tsx
register(
  { email: result.data.email, username: result.data.username, ... },
  {
    onSuccess: () => navigate('/verify-email'),
    onError: (err) => {
      const message = (err.message ?? '').toLowerCase();
      if (message.includes('email') && message.includes('taken')) {
        setValidationErrors({ email: 'This email address is already registered.' });
      } else if (message.includes('username')) {
        setValidationErrors({ username: 'This username is already taken.' });
      }
      // Generic server errors surface via the top-level `error` state
    },
  }
);
```

**Rationale:** Inline errors under the relevant field are clearer UX than a generic top banner.
Implements the `onError` mapping pattern documented in the story dev notes.

---

### Change 6 — LOW: Replace Hardcoded RGB with Design Token

**File:** `frontend/src/pages/RegisterPage.tsx`

**OLD (line 93 + label spans throughout RequirementCheck):**

```tsx
<span className={met ? 'text-[rgb(37,99,235)]' : 'text-[rgb(148,163,184)]'}>{label}</span>
```

**NEW:**

```tsx
<span style={{ color: met ? 'var(--gold-500)' : 'var(--text-muted)' }}>{label}</span>
```

**Rationale:** Consistent design token usage so theme changes propagate automatically.
`rgb(148,163,184)` is the muted text value — it has a token.

---

### Change 7 — TEST GAP: Add Auth Test Coverage

**Files:** Auth test suite (Registration and Login test files)

Add tests that verify:

- Password checklist renders exactly 5 requirement rows
- Special character `RequirementCheck` is present and responds to `@$!%*?&` input
- A password with `#` does NOT satisfy the special char requirement check
- A "Strong" rated password must also pass `passwordSchema` validation
- Successful registration redirects to `/verify-email` (not `/`)
- Login after guard redirect restores the user to their original `from` destination

---

## Section 5 — Implementation Handoff

**Scope:** MINOR — Dev team direct implementation, no PO/SM backlog reorganisation required.

### Fix Priority

| Priority | Change                                  | File                                         |
| -------- | --------------------------------------- | -------------------------------------------- |
| P0       | Special char UI + regex alignment       | `RegisterPage.tsx` + `validation-schemas.ts` |
| P0       | Registration redirect → `/verify-email` | `RegisterPage.tsx`                           |
| P0       | Login `from` state redirect             | `LoginPage.tsx`                              |
| P1       | Inline server error mapping             | `RegisterPage.tsx`                           |
| P1       | Test gap coverage                       | Auth test suite                              |
| P2       | Design token cleanup                    | `RegisterPage.tsx`                           |

### Handoff

**Route to:** Dev Agent (Amelia — `bmad-dev-story`)
**Next action:** Run `/bmad-dev-story` in a fresh context, reference this proposal, implement P0 fixes first,
run tests, then P1, then P2.

### Success Criteria

- [ ] All 5 password requirements render in the UI checklist
- [ ] Registration `onSuccess` navigates to `/verify-email`
- [ ] Login `onSuccess` navigates to `location.state.from ?? '/'`
- [ ] `calculatePasswordStrength` and `passwordSchema` use identical special char regex
- [ ] Inline field errors appear for "email taken" and "username taken" server responses
- [ ] Auth test suite explicitly covers special char requirement and redirect behaviour
- [ ] No hardcoded `rgb(148,163,184)` in auth pages

---

## MVP Impact

None. These are correctness fixes, not feature additions. Epic scope unchanged.

---

_Generated by Correct Course Workflow — Equoria Sprint Change Management_
_Approved by: Heirr — 2026-04-03_
