// Tests for temperament definitions API endpoint (Story 31D-5).
// Validates GET /temperament-definitions response structure, modifier values,
// groom personality derivation, and field completeness.
// No Prisma mock needed — getTemperamentDefinitions does no DB queries.

import { jest } from '@jest/globals';

// Mock logger to suppress output in tests
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

// Import after mocking
const { getTemperamentDefinitions } = await import('../modules/horses/controllers/horseController.mjs');

// Helper: create mock response
function createMockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('getTemperamentDefinitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // === Task 3.1: Returns 200 with success: true and all 11 definitions ===

  it('returns 200 with success: true and all 11 definitions', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Temperament definitions retrieved successfully');
    expect(payload.data.definitions).toHaveLength(11);
  });

  // === Task 3.2: data.count equals 11 ===

  it('returns data.count equal to 11', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data.count).toBe(11);
  });

  // === Task 3.3: Each definition has all required fields ===

  it('each definition has all required fields', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    for (const def of definitions) {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('prevalenceNote');
      expect(def).toHaveProperty('trainingModifiers');
      expect(def.trainingModifiers).toHaveProperty('xpModifier');
      expect(def.trainingModifiers).toHaveProperty('scoreModifier');
      expect(def).toHaveProperty('competitionModifiers');
      expect(def.competitionModifiers).toHaveProperty('riddenModifier');
      expect(def.competitionModifiers).toHaveProperty('conformationModifier');
      expect(def).toHaveProperty('bestGroomPersonalities');
      expect(Array.isArray(def.bestGroomPersonalities)).toBe(true);
    }
  });

  // === Task 3.4: Spirited training modifiers ===

  it('returns correct training modifiers for Spirited (xpModifier: 0.1, scoreModifier: 0.05)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const spirited = definitions.find(d => d.name === 'Spirited');
    expect(spirited).toBeDefined();
    expect(spirited.trainingModifiers.xpModifier).toBe(0.1);
    expect(spirited.trainingModifiers.scoreModifier).toBe(0.05);
  });

  // === Task 3.5: Lazy training modifiers ===

  it('returns correct training modifiers for Lazy (xpModifier: -0.2, scoreModifier: -0.15)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const lazy = definitions.find(d => d.name === 'Lazy');
    expect(lazy).toBeDefined();
    expect(lazy.trainingModifiers.xpModifier).toBe(-0.2);
    expect(lazy.trainingModifiers.scoreModifier).toBe(-0.15);
  });

  // === Task 3.6: Bold competition modifiers ===

  it('returns correct competition modifiers for Bold (riddenModifier: 0.05, conformationModifier: 0.02)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const bold = definitions.find(d => d.name === 'Bold');
    expect(bold).toBeDefined();
    expect(bold.competitionModifiers.riddenModifier).toBe(0.05);
    expect(bold.competitionModifiers.conformationModifier).toBe(0.02);
  });

  // === Task 3.7: Nervous competition modifiers ===

  it('returns correct competition modifiers for Nervous (riddenModifier: -0.05, conformationModifier: -0.05)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const nervous = definitions.find(d => d.name === 'Nervous');
    expect(nervous).toBeDefined();
    expect(nervous.competitionModifiers.riddenModifier).toBe(-0.05);
    expect(nervous.competitionModifiers.conformationModifier).toBe(-0.05);
  });

  // === Task 3.8: Spirited best groom personalities ===

  it('returns bestGroomPersonalities ["energetic"] for Spirited', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const spirited = definitions.find(d => d.name === 'Spirited');
    expect(spirited.bestGroomPersonalities).toEqual(['energetic']);
  });

  // === Task 3.9: Nervous best groom personalities (strict excluded — negative synergy) ===

  it('returns bestGroomPersonalities ["patient", "gentle"] for Nervous (strict excluded)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const nervous = definitions.find(d => d.name === 'Nervous');
    expect(nervous.bestGroomPersonalities).toEqual(['patient', 'gentle']);
    expect(nervous.bestGroomPersonalities).not.toContain('strict');
  });

  // === Task 3.10: Calm best groom personalities (universal _any → all 4) ===

  it('returns all 4 personalities for Calm (universal _any synergy)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const calm = definitions.find(d => d.name === 'Calm');
    expect(calm.bestGroomPersonalities).toEqual(['gentle', 'energetic', 'patient', 'strict']);
  });

  // === Task 3.11: Steady best groom personalities (universal _any → all 4) ===

  it('returns all 4 personalities for Steady (universal _any synergy)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const steady = definitions.find(d => d.name === 'Steady');
    expect(steady.bestGroomPersonalities).toEqual(['gentle', 'energetic', 'patient', 'strict']);
  });

  // === Task 3.12: Definitions order matches TEMPERAMENT_TYPES array order ===

  it('definitions are returned in TEMPERAMENT_TYPES canonical order', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.json.mock.calls[0][0].data;
    const expectedOrder = [
      'Spirited',
      'Nervous',
      'Calm',
      'Bold',
      'Steady',
      'Independent',
      'Reactive',
      'Stubborn',
      'Playful',
      'Lazy',
      'Aggressive',
    ];
    const actualOrder = definitions.map(d => d.name);
    expect(actualOrder).toEqual(expectedOrder);
  });

  // === Error handling: verify function is exported and callable ===

  it('getTemperamentDefinitions is an exported async function', () => {
    expect(typeof getTemperamentDefinitions).toBe('function');
    expect(getTemperamentDefinitions.constructor.name).toBe('AsyncFunction');
  });
});
