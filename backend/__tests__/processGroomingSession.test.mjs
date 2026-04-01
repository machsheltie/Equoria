/**
 * Tests for processGroomingSession() in groomBondingSystem.mjs.
 * Validates DB persistence: GroomInteraction creation and horse.update
 * after the tech-debt resolution that removed the TODO placeholders.
 *
 * Covers:
 * - Happy path: groom assigned → creates GroomInteraction + updates horse
 * - No groom: skips GroomInteraction, still updates horse
 * - Ineligible task: returns success:false, no DB writes
 * - Horse not found: throws error, no DB writes
 * - Groom not found (DB returns null): no synergy, still processes
 * - Synergy applied: Nervous+patient → bondChange rounds to 3 (from 2.5)
 * - taskLog accumulated across sessions
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Prisma mock — must be declared before jest.unstable_mockModule
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  groom: {
    findUnique: jest.fn(),
  },
  groomInteraction: {
    create: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mocks must come before any await import()
jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

const { processGroomingSession } = await import('../utils/groomBondingSystem.mjs');
const { GROOM_CONFIG } = await import('../config/groomConfig.mjs');

// Default horse fixture — age 21 days = 3 years (eligible for brushing)
const ADULT_HORSE_AGE = GROOM_CONFIG.GENERAL_GROOMING_MIN_AGE * 7; // 3 * 7 = 21

function makeHorse(overrides = {}) {
  return {
    id: 1,
    name: 'Starfall',
    age: ADULT_HORSE_AGE,
    bondScore: 20,
    daysGroomedInARow: 0,
    burnoutStatus: 'none',
    temperament: null,
    taskLog: null,
    ...overrides,
  };
}

describe('processGroomingSession() — DB persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: horse exists, groom exists, update/create succeed
    mockPrisma.horse.findUnique.mockResolvedValue(makeHorse());
    mockPrisma.groom.findUnique.mockResolvedValue({ personality: 'patient' });
    mockPrisma.groomInteraction.create.mockResolvedValue({ id: 99 });
    mockPrisma.horse.update.mockResolvedValue({});
  });

  // ── Happy path: groom assigned ───────────────────────────────────────────

  it('returns success:true with bondingEffects, consecutiveDaysUpdate, immunityCheck', async () => {
    const result = await processGroomingSession(1, 10, 'brushing', 30);
    expect(result.success).toBe(true);
    expect(result.bondingEffects).toBeDefined();
    expect(result.consecutiveDaysUpdate).toBeDefined();
    expect(result.immunityCheck).toBeDefined();
  });

  it('calls groomInteraction.create with correct fields when groomId is provided', async () => {
    await processGroomingSession(1, 10, 'brushing', 30);
    expect(mockPrisma.groomInteraction.create).toHaveBeenCalledTimes(1);
    const { data } = mockPrisma.groomInteraction.create.mock.calls[0][0];
    expect(data.foalId).toBe(1);
    expect(data.groomId).toBe(10);
    expect(data.interactionType).toBe('brushing');
    expect(data.duration).toBe(30);
    expect(data.stressChange).toBe(0);
    expect(data.quality).toBe('good');
    expect(data.qualityScore).toBe(0.75);
    expect(Number.isInteger(data.bondingChange)).toBe(true); // schema requires Int
  });

  it('calls horse.update with rounded bondScore, new streak, burnoutStatus, lastGroomed, taskLog', async () => {
    await processGroomingSession(1, 10, 'brushing', 30);
    expect(mockPrisma.horse.update).toHaveBeenCalledTimes(1);
    const { data } = mockPrisma.horse.update.mock.calls[0][0];
    expect(Number.isInteger(data.bondScore)).toBe(true);
    expect(data.bondScore).toBe(22); // 20 + round(2) = 22
    expect(data.daysGroomedInARow).toBe(1);
    expect(typeof data.burnoutStatus).toBe('string');
    expect(data.lastGroomed).toBeInstanceOf(Date);
    expect(data.taskLog).toBeDefined();
    expect(data.taskLog['brushing']).toBe(1);
  });

  // ── No groom provided ────────────────────────────────────────────────────

  it('skips groomInteraction.create when groomId is falsy (0)', async () => {
    await processGroomingSession(1, 0, 'brushing', 30);
    expect(mockPrisma.groomInteraction.create).not.toHaveBeenCalled();
    expect(mockPrisma.horse.update).toHaveBeenCalledTimes(1); // horse still updated
  });

  it('skips groomInteraction.create when groomId is null', async () => {
    await processGroomingSession(1, null, 'brushing', 30);
    expect(mockPrisma.groomInteraction.create).not.toHaveBeenCalled();
    expect(mockPrisma.horse.update).toHaveBeenCalledTimes(1);
  });

  // ── Groom DB returns null (not found) ────────────────────────────────────

  it('processes session without synergy when groom record does not exist', async () => {
    mockPrisma.groom.findUnique.mockResolvedValue(null);
    const result = await processGroomingSession(1, 99, 'brushing', 30);
    expect(result.success).toBe(true);
    expect(result.bondingEffects.synergyModifier).toBe(0);
    expect(result.bondingEffects.bondChange).toBe(2);
  });

  // ── Synergy applied correctly ─────────────────────────────────────────────

  it('Nervous horse + patient groom: bondChange rounds to 3, stored bondScore = 23', async () => {
    mockPrisma.horse.findUnique.mockResolvedValue(makeHorse({ temperament: 'Nervous' }));
    mockPrisma.groom.findUnique.mockResolvedValue({ personality: 'patient' });
    await processGroomingSession(1, 10, 'brushing', 30);
    const { data } = mockPrisma.horse.update.mock.calls[0][0];
    // effectiveGain = 2 * 1.25 = 2.5 → Math.round(22.5) = 23
    expect(data.bondScore).toBe(23);
    const { data: iData } = mockPrisma.groomInteraction.create.mock.calls[0][0];
    expect(iData.bondingChange).toBe(3); // Math.round(2.5) = 3
  });

  it('Nervous horse + strict groom: bondChange rounds to 2, stored bondScore = 22', async () => {
    mockPrisma.horse.findUnique.mockResolvedValue(makeHorse({ temperament: 'Nervous' }));
    mockPrisma.groom.findUnique.mockResolvedValue({ personality: 'strict' });
    await processGroomingSession(1, 10, 'brushing', 30);
    const { data } = mockPrisma.horse.update.mock.calls[0][0];
    // effectiveGain = 2 * 0.85 = 1.7 → Math.round(21.7) = 22
    expect(data.bondScore).toBe(22);
    const { data: iData } = mockPrisma.groomInteraction.create.mock.calls[0][0];
    expect(iData.bondingChange).toBe(2); // Math.round(1.7) = 2
  });

  // ── taskLog accumulates ───────────────────────────────────────────────────

  it('taskLog increments existing count when horse already has a log', async () => {
    mockPrisma.horse.findUnique.mockResolvedValue(makeHorse({ taskLog: { brushing: 3, 'hand-walking': 1 } }));
    await processGroomingSession(1, 10, 'brushing', 30);
    const { data } = mockPrisma.horse.update.mock.calls[0][0];
    expect(data.taskLog['brushing']).toBe(4);
    expect(data.taskLog['hand-walking']).toBe(1); // unchanged
  });

  // ── Enrichment task on adult horse: eligible, but bondChange = 0 ──────────

  it('enrichment task on adult horse: success:true, bondChange:0, horse still updated', async () => {
    // desensitization is enrichment — eligible for 3+ year olds but produces no bonding
    const result = await processGroomingSession(1, 10, 'desensitization', 30);
    expect(result.success).toBe(true);
    expect(result.bondingEffects.bondChange).toBe(0);
    expect(mockPrisma.horse.update).toHaveBeenCalledTimes(1);
    // bondScore unchanged (0 gain), taskLog records the enrichment task
    const { data } = mockPrisma.horse.update.mock.calls[0][0];
    expect(data.bondScore).toBe(20);
    expect(data.taskLog['desensitization']).toBe(1);
  });

  // ── Ineligible task: foal too young for grooming task ─────────────────────

  it('returns success:false for brushing on newborn foal (age=0), no DB writes', async () => {
    // At age 0 only enrichment tasks are eligible — brushing is not
    mockPrisma.horse.findUnique.mockResolvedValue(makeHorse({ age: 0 }));
    const result = await processGroomingSession(1, 10, 'brushing', 30);
    expect(result.success).toBe(false);
    expect(mockPrisma.groomInteraction.create).not.toHaveBeenCalled();
    expect(mockPrisma.horse.update).not.toHaveBeenCalled();
  });

  // ── Horse not found ───────────────────────────────────────────────────────

  it('throws an error when horse does not exist, no DB writes', async () => {
    mockPrisma.horse.findUnique.mockResolvedValue(null);
    await expect(processGroomingSession(999, 10, 'brushing', 30)).rejects.toThrow('Horse with ID 999 not found');
    expect(mockPrisma.groomInteraction.create).not.toHaveBeenCalled();
    expect(mockPrisma.horse.update).not.toHaveBeenCalled();
  });

  // ── Duration defaults to 0 when not supplied ─────────────────────────────

  it('stores duration: 0 in interaction when duration arg is undefined', async () => {
    await processGroomingSession(1, 10, 'brushing');
    const { data } = mockPrisma.groomInteraction.create.mock.calls[0][0];
    expect(data.duration).toBe(0);
  });

  // ── Burnout immunity progression ─────────────────────────────────────────

  it('grants burnout immunity after reaching threshold consecutive days', async () => {
    const threshold = GROOM_CONFIG.BURNOUT_IMMUNITY_THRESHOLD_DAYS;
    mockPrisma.horse.findUnique.mockResolvedValue(makeHorse({ daysGroomedInARow: threshold - 1 }));
    const result = await processGroomingSession(1, 10, 'brushing', 30);
    expect(result.immunityCheck.immunityGranted).toBe(true);
    const { data } = mockPrisma.horse.update.mock.calls[0][0];
    expect(data.burnoutStatus).toBe(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE);
  });
});
