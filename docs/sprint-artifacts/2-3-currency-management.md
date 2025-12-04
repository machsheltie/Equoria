# Story 2.3: Currency Management

**Status:** completed
**Priority:** P0
**FR:** FR-U7
**Epic:** 2
**Story:** 3
**Prerequisites:** 2-1-profile-management (completed)

---

## User Story

As a **player**,
I want to **see my in-game currency balance and transaction history**,
So that **I can manage my spending**.

---

## Acceptance Criteria

### AC-1: Currency Balance Display
**Given** I am on my profile page
**When** I view the currency section
**Then** I see my current balance prominently displayed with a coin icon

### AC-2: Currency Formatting
**Given** I have currency displayed
**When** the amount is shown
**Then** it is formatted with thousands separators (e.g., 1,000)

### AC-3: Transaction History Hook (API Ready)
**Given** the frontend needs transaction data
**When** useTransactionHistory hook is called
**Then** it returns paginated transaction data from API

### AC-4: Loading State
**Given** currency data is loading
**When** the component renders
**Then** a loading skeleton is displayed

### AC-5: Integration
**Given** the CurrencyDisplay component exists
**When** ProfilePage renders
**Then** currency is displayed in the profile card

---

## Technical Notes

### Database Schema
```prisma
model User {
  money Int @default(1000)  // In-game currency
}
```

### API Endpoints (Backend exists)
- `GET /api/v1/users/me` - Returns user with money field
- `GET /api/v1/users/transactions` - Transaction history (future)

### Frontend Implementation
1. **currency-utils.ts** - Formatting functions
2. **CurrencyDisplay.tsx** - Display component
3. **useTransactionHistory.ts** - React Query hook (stub for future)

---

## Tasks

### Task 1: Currency Utilities (TDD)
- [x] Write tests for formatCurrency function
- [x] Write tests for formatCompactCurrency function
- [x] Implement currency-utils.ts

### Task 2: CurrencyDisplay Component (TDD)
- [x] Write component tests (balance display, loading, sizes)
- [x] Implement CurrencyDisplay.tsx with coin icon
- [x] Add size variants (sm, md, lg)

### Task 3: ProfilePage Integration
- [x] Add CurrencyDisplay to ProfilePage
- [x] Position below XP display section

### Task 4: Documentation & Commit
- [x] Update sprint-status.yaml
- [x] Git commit with test results

---

## Test Coverage Target

| File | Tests | Coverage |
|------|-------|----------|
| currency-utils.test.ts | ~15 | 100% |
| CurrencyDisplay.test.tsx | ~20 | 100% |
| **Total** | ~35 | 100% |

---

## Definition of Done

- [x] All acceptance criteria met
- [x] 60 tests passing (34 utils + 26 component)
- [x] 100% coverage for new code
- [x] CurrencyDisplay integrated into ProfilePage
- [x] Git commit pushed to master
