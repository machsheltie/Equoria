# 2. Test Categories

### 2.1 Unit Tests (75% of tests)

**Purpose:** Individual component testing in isolation

**Coverage:** 350+ tests
- Models: CRUD operations, validation
- Controllers: Business logic
- Utils: Game mechanics, calculations
- Services: Background jobs

**Key Test Files:**
| File | Tests | Coverage |
|------|-------|----------|
| horseModel.test.js | 32 | CRUD, validation |
| userModel.test.js | 27 | Account management |
| trainingController.test.js | 38 | Training business logic |
| resultModel.test.js | 23 | Competition results |
| foalModel.test.js | 15+ | Breeding, foal management |

**Testing Pattern:**
```javascript
// ✅ GOOD - Mock only external dependencies
import { prismaMock } from '../__mocks__/prisma';

test('createHorse creates a horse with correct genetics', async () => {
  prismaMock.horse.create.mockResolvedValue(mockHorse);

  const result = await createHorse(horseData);

  // Test REAL business logic (genetics calculation)
  expect(result.genetics).toEqual(expectedGenetics);
});

// ❌ BAD - Over-mocking hides real bugs
jest.mock('../geneticsCalculator'); // Don't do this!
```

### 2.2 Integration Tests (20% of tests)

**Purpose:** Multi-component interactions and end-to-end workflows

**Coverage:** 100+ tests
- API endpoint testing with real database
- Multi-step process validation
- Data consistency verification
- Performance testing for critical operations

**Key Test Files:**
| File | Purpose |
|------|---------|
| training.test.js | Complete training workflows |
| cronJobsIntegration.test.js | Background job processing |
| traitDiscoveryIntegration.test.js | Trait revelation system |
| foalEnrichmentIntegration.test.js | Foal development workflows |
| competitionController.test.js | Competition system |

**Integration Pattern:**
```javascript
describe('Horse Breeding Integration', () => {
  it('should create offspring with correct genetics', async () => {
    // Use REAL database (test environment)
    const sire = await createTestHorse({ name: 'Sire' });
    const dam = await createTestHorse({ name: 'Dam' });

    const offspring = await breedHorses(sire.id, dam.id);

    // Verify REAL genetics calculation
    expect(offspring.genetics).toMatchGeneticsRules(sire, dam);
  });
});
```

### 2.3 End-to-End Tests (5% of tests)

**Purpose:** Critical user journeys

**Coverage:** 18+ tests
- Authentication flows
- Complete game workflows
- Cross-system interactions

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
