// Tests for temperament definitions API endpoint (Story 31D-5).
// Validates GET /temperament-definitions response structure, groom personality
// derivation, and field completeness. Owner ruling 2026-10-21: Playful renamed Driven, Willing added (12 temperaments).
// No Prisma mock needed — getTemperamentDefinitions does no DB queries.

import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTemperamentDefinitions } from '../controllers/horseController.mjs';

// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): the
// previous logger mock was for noise suppression — no logger
// assertions in this file. Real logger runs at LOG_LEVEL=error.

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe('getTemperamentDefinitions', () => {
  beforeEach(() => {});

  // === Task 3.1: Returns 200 with success: true and all 12 definitions ===
  // Old contract: 11 definitions. Owner ruling 2026-10-21: Playful renamed Driven, Willing added (12 temperaments).

  it('returns 200 with success: true and all 12 definitions', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    expect(res.statusCode).toBe(200);
    const payload = res.body;
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Temperament definitions retrieved successfully');
    expect(payload.data.definitions).toHaveLength(12);
  });

  // === Task 3.2: data.count equals 12 (old contract: 11) ===

  it('returns data.count equal to 12', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const payload = res.body;
    expect(payload.data.count).toBe(12);
  });

  // === Task 3.3: Each definition has all required fields ===

  it('each definition has all required fields', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    for (const def of definitions) {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('prevalenceNote');
      expect(def).toHaveProperty('bestGroomPersonalities');
      expect(Array.isArray(def.bestGroomPersonalities)).toBe(true);
    }
  });

  // === Owner ruling 2026-10-21: no training or ridden/conformation modifiers ===
  // Old contract (Tasks 3.4-3.7): each definition carried trainingModifiers
  // { xpModifier, scoreModifier } and competitionModifiers { riddenModifier,
  // conformationModifier } (e.g. Spirited 0.1/0.05, Lazy -0.2/-0.15, Bold
  // 0.05/0.02, Nervous -0.05/-0.05). The owner ruled a temperament has no
  // training modifier and no ridden/conformation modifier, so neither is served.

  it('carries no training or ridden/conformation modifiers', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    for (const def of res.body.data.definitions) {
      expect(def).not.toHaveProperty('trainingModifiers');
      expect(def).not.toHaveProperty('competitionModifiers');
    }
  });

  it('describes Driven and Willing and names their best grooms', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    const driven = definitions.find(d => d.name === 'Driven');
    const willing = definitions.find(d => d.name === 'Willing');
    expect(driven.description).toMatch(/^Determined and hard-working\./);
    expect(driven.bestGroomPersonalities).toEqual(['energetic']);
    expect(willing.description).toMatch(/^Cooperative and eager to please\./);
    expect(willing.bestGroomPersonalities).toEqual(['gentle', 'patient']);
    expect(definitions.find(d => d.name === 'Playful')).toBeUndefined();
  });

  // === Task 3.8: Spirited best groom personalities ===

  it('returns bestGroomPersonalities ["energetic"] for Spirited', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    const spirited = definitions.find(d => d.name === 'Spirited');
    expect(spirited.bestGroomPersonalities).toEqual(['energetic']);
  });

  // === Task 3.9: Nervous best groom personalities (strict excluded — negative synergy) ===

  it('returns bestGroomPersonalities ["patient", "gentle"] for Nervous (strict excluded)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    const nervous = definitions.find(d => d.name === 'Nervous');
    expect(nervous.bestGroomPersonalities).toEqual(['patient', 'gentle']);
    expect(nervous.bestGroomPersonalities).not.toContain('strict');
  });

  // === Task 3.10: Calm best groom personalities (universal _any → all 4) ===

  it('returns all 4 personalities for Calm (universal _any synergy)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    const calm = definitions.find(d => d.name === 'Calm');
    expect(calm.bestGroomPersonalities).toEqual(['gentle', 'energetic', 'patient', 'strict']);
  });

  // === Task 3.11: Steady best groom personalities (universal _any → all 4) ===

  it('returns all 4 personalities for Steady (universal _any synergy)', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    const steady = definitions.find(d => d.name === 'Steady');
    expect(steady.bestGroomPersonalities).toEqual(['gentle', 'energetic', 'patient', 'strict']);
  });

  // === Task 3.12: Definitions order matches TEMPERAMENT_TYPES array order ===

  it('definitions are returned in TEMPERAMENT_TYPES canonical order', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    const expectedOrder = [
      'Spirited',
      'Nervous',
      'Calm',
      'Bold',
      'Steady',
      'Willing',
      'Independent',
      'Reactive',
      'Stubborn',
      'Driven',
      'Lazy',
      'Aggressive',
    ];
    const actualOrder = definitions.map(d => d.name);
    expect(actualOrder).toEqual(expectedOrder);
  });

  // === F7: negative synergy values are excluded from bestGroomPersonalities ===

  it('excludes negative-synergy personalities and keeps only positive entries', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    // All definitions must have bestGroomPersonalities as an array (including empty)
    for (const def of definitions) {
      expect(Array.isArray(def.bestGroomPersonalities)).toBe(true);
    }
    // Nervous strict is -0.15 — must be excluded
    const nervous = definitions.find(d => d.name === 'Nervous');
    expect(nervous.bestGroomPersonalities).not.toContain('strict');
    // Stubborn only has strict: 0.15 — confirm single positive entry returned
    const stubborn = definitions.find(d => d.name === 'Stubborn');
    expect(stubborn.bestGroomPersonalities).toEqual(['strict']);
  });

  // === F8: description and prevalenceNote are non-empty strings ===

  it('all definitions have non-empty description and prevalenceNote strings', async () => {
    const req = {};
    const res = createMockRes();

    await getTemperamentDefinitions(req, res);

    const { definitions } = res.body.data;
    for (const def of definitions) {
      expect(typeof def.description).toBe('string');
      expect(def.description.length).toBeGreaterThan(0);
      expect(typeof def.prevalenceNote).toBe('string');
      expect(def.prevalenceNote.length).toBeGreaterThan(0);
    }
  });

  // === F6: 500 error path — missing modifier throws and returns error response ===

  it('returns 500 when internal error is thrown during definition assembly', async () => {
    // We test the catch branch by passing a res that throws on the first json call,
    // forcing the catch handler to invoke res.status(500).json(...)
    const req = {};
    let callCount = 0;
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated serialization failure');
        }
        this.body = data;
        return this;
      },
    };

    await getTemperamentDefinitions(req, res);

    // catch branch calls res.status(500)
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Internal server error while retrieving temperament definitions');
  });
});
