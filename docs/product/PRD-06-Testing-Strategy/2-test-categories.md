# 2. Test Categories

> **Updated 2026-06-10:** the former unit-test pattern showed a `prismaMock` example. Prisma mocking is forbidden under the real-DB doctrine (§1.1); unit-style tests also run against the real database. Stale per-file test counts were removed — file inventories drift; the file tree (`backend/modules/<domain>/__tests__/`) is the source of truth.

### 2.1 Unit-Style Tests

**Purpose:** Function- and class-level testing — models, utils, game mechanics, services.

**Location/naming:** `backend/modules/<domain>/__tests__/<unit>.test.mjs` (still real-DB; "no mocks ever" per CLAUDE.md).

**Testing Pattern:**

```javascript
// ✅ GOOD - real DB, scoped fixture, scoped cleanup
import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';

const created = [];
test('createHorse creates a horse with correct genetics', async () => {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-genetics-${randHex()}`,
      sex: 'Mare',
      dateOfBirth: new Date(),
      userId: user.id,
    },
    created
  );
  expect(horse.genetics).toEqual(expectedGenetics); // REAL calculation, REAL row
});
afterAll(() => cleanupTestHorses(prisma, created)); // deletes ONLY this suite's ids

// ❌ BAD - mocking our own database or logic
import { prismaMock } from '../__mocks__/prisma'; // forbidden (check-no-db-mocks.mjs)
jest.mock('../geneticsCalculator'); // forbidden
```

### 2.2 Integration Tests

**Purpose:** Multi-component interactions and HTTP-chain workflows via supertest against the real Express app + real DB.

**Location/naming:** `backend/modules/<domain>/__tests__/<x>.integration.test.mjs` for single-domain flows; `backend/__tests__/integration/` for cross-module flows; `backend/__tests__/middleware/` for middleware sentinels.

**Integration Pattern:**

```javascript
describe('Horse Breeding Integration', () => {
  it('should create offspring with correct genetics', async () => {
    // Real database, scoped fixtures
    const sire = await createTestHorse(prisma, { name: `TestFixture-Sire-${randHex()}`, ... }, created);
    const dam = await createTestHorse(prisma, { name: `TestFixture-Dam-${randHex()}`, ... }, created);

    const offspring = await breedHorses(sire.id, dam.id);

    // Verify REAL genetics calculation
    expect(offspring.genetics).toMatchGeneticsRules(sire, dam);
  });
});
```

### 2.3 End-to-End Tests (Playwright)

**Purpose:** Critical user journeys — real credentials, real backend, real DB. No bypass headers, no `test.skip` on beta-critical paths (Constitution §2/§3).

**E2E Pattern (Playwright):**

```typescript
test('complete horse purchase flow', async ({ page }) => {
  // Login
  await page.fill('[data-testid="email"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-button"]');

  // Navigate to marketplace
  await page.click('text=Marketplace');

  // Select horse
  await page.click('[data-testid="horse-card"]:first-child');

  // Purchase
  await page.click('text=Buy Horse');
  await page.click('text=Confirm Purchase');

  // Verify success
  await expect(page.locator('text=Purchase successful')).toBeVisible();
});
```

---
