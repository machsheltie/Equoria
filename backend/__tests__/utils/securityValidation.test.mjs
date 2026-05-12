/**
 * securityValidation — unit tests (Equoria-rr7)
 *
 * Pure functions (crypto + logger imports only). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateHorseData,
  validatePlayerData,
  validateBreedingData,
  validateTrainingData,
  validateTransactionData,
  generateDataHash,
  verifyDataIntegrity,
  sanitizeInput,
  validateId,
  validateRateLimit,
  validateFileUpload,
} from '../../utils/securityValidation.mjs';

// ---------------------------------------------------------------------------
// validateHorseData
// ---------------------------------------------------------------------------
describe('validateHorseData', () => {
  it('returns isValid true for minimal valid horse', () => {
    const result = validateHorseData({ name: 'Thunder', sex: 'Stallion', age: 5 });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for horse name under 2 chars', () => {
    const result = validateHorseData({ name: 'A' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('returns error for horse name over 50 chars', () => {
    const result = validateHorseData({ name: 'A'.repeat(51) });
    expect(result.isValid).toBe(false);
  });

  it('returns error for invalid sex', () => {
    const result = validateHorseData({ sex: 'unknown' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('sex'))).toBe(true);
  });

  it('accepts valid sex values', () => {
    for (const sex of ['Stallion', 'Mare', 'Colt', 'Filly', 'Rig']) {
      const result = validateHorseData({ sex });
      const hasError = result.errors.some(e => e.includes('sex'));
      expect(hasError).toBe(false);
    }
  });

  it('returns error for age out of range (>50)', () => {
    const result = validateHorseData({ age: 100 });
    expect(result.isValid).toBe(false);
  });

  it('returns error for negative age', () => {
    const result = validateHorseData({ age: -1 });
    expect(result.isValid).toBe(false);
  });

  it('returns sanitized object', () => {
    const result = validateHorseData({ name: 'Thunder', sex: 'Mare', age: 5 });
    expect(result.sanitized).toBeDefined();
  });

  it('name with special injection chars returns error', () => {
    const result = validateHorseData({ name: '<script>alert</script>' });
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateTrainingData
// ---------------------------------------------------------------------------
describe('validateTrainingData', () => {
  const validTraining = { horseId: 1, discipline: 'Racing' };

  it('returns isValid true for valid training data', () => {
    const result = validateTrainingData(validTraining);
    expect(result.isValid).toBe(true);
  });

  it('returns error when horseId missing', () => {
    const result = validateTrainingData({ discipline: 'Racing' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('horse'))).toBe(true);
  });

  it('returns error for invalid discipline', () => {
    const result = validateTrainingData({ horseId: 1, discipline: 'Polo' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('discipline'))).toBe(true);
  });

  it('accepts all valid disciplines', () => {
    for (const discipline of ['Racing', 'Show Jumping', 'Dressage', 'Cross Country', 'Western']) {
      const result = validateTrainingData({ horseId: 1, discipline });
      expect(result.isValid).toBe(true);
    }
  });

  it('removes protected stat fields from sanitized output', () => {
    const data = { horseId: 1, discipline: 'Racing', speed: 999 };
    const result = validateTrainingData(data);
    expect(result.sanitized.speed).toBeUndefined();
  });

  it('still returns isValid true even when protected fields were removed', () => {
    const data = { horseId: 1, discipline: 'Racing', precision: 100 };
    const result = validateTrainingData(data);
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTransactionData
// ---------------------------------------------------------------------------
describe('validateTransactionData', () => {
  const validTx = { amount: 100, type: 'purchase' };

  it('returns isValid true for valid transaction', () => {
    expect(validateTransactionData(validTx).isValid).toBe(true);
  });

  it('returns error when amount is missing', () => {
    const result = validateTransactionData({ type: 'purchase' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('amount'))).toBe(true);
  });

  it('returns error for amount <= 0', () => {
    expect(validateTransactionData({ amount: 0, type: 'purchase' }).isValid).toBe(false);
    expect(validateTransactionData({ amount: -5, type: 'purchase' }).isValid).toBe(false);
  });

  it('returns error for amount exceeding 10M', () => {
    expect(validateTransactionData({ amount: 10_000_001, type: 'purchase' }).isValid).toBe(false);
  });

  it('returns error for invalid type', () => {
    const result = validateTransactionData({ amount: 100, type: 'lottery' });
    expect(result.isValid).toBe(false);
  });

  it('accepts all valid transaction types', () => {
    const types = ['purchase', 'sale', 'transfer', 'breeding_fee', 'training_fee', 'competition_entry', 'prize'];
    for (const type of types) {
      expect(validateTransactionData({ amount: 50, type }).isValid).toBe(true);
    }
  });

  it('description over 200 chars returns error', () => {
    const result = validateTransactionData({
      amount: 50,
      type: 'purchase',
      description: 'A'.repeat(201),
    });
    expect(result.isValid).toBe(false);
  });

  it('description strips < and > characters', () => {
    const result = validateTransactionData({
      amount: 50,
      type: 'purchase',
      description: '<script>xss</script>',
    });
    expect(result.sanitized.description).not.toContain('<');
    expect(result.sanitized.description).not.toContain('>');
  });
});

// ---------------------------------------------------------------------------
// generateDataHash + verifyDataIntegrity
// ---------------------------------------------------------------------------
describe('generateDataHash', () => {
  it('returns a string', () => {
    expect(typeof generateDataHash({ a: 1 })).toBe('string');
  });

  it('returns 64-character hex hash (SHA-256)', () => {
    const hash = generateDataHash({ test: 'value' });
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('same data produces same hash', () => {
    const data = { id: 1, name: 'Thunder' };
    expect(generateDataHash(data)).toBe(generateDataHash(data));
  });

  it('different data produces different hash', () => {
    expect(generateDataHash({ a: 1 })).not.toBe(generateDataHash({ a: 2 }));
  });

  it('is order-independent (sorted keys)', () => {
    const h1 = generateDataHash({ a: 1, b: 2 });
    const h2 = generateDataHash({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });
});

describe('verifyDataIntegrity', () => {
  it('returns true when hash matches', () => {
    const data = { id: 42, value: 'stable' };
    const hash = generateDataHash(data);
    expect(verifyDataIntegrity(data, hash)).toBe(true);
  });

  it('returns false when hash does not match', () => {
    const data = { id: 42, value: 'stable' };
    expect(verifyDataIntegrity(data, 'wrong-hash')).toBe(false);
  });

  it('returns false when data was tampered', () => {
    const original = { id: 42, value: 'stable' };
    const hash = generateDataHash(original);
    const tampered = { id: 42, value: 'hacked' };
    expect(verifyDataIntegrity(tampered, hash)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeInput
// ---------------------------------------------------------------------------
describe('sanitizeInput', () => {
  it('returns non-string input unchanged', () => {
    expect(sanitizeInput(42)).toBe(42);
    expect(sanitizeInput(null)).toBeNull();
    expect(sanitizeInput(undefined)).toBeUndefined();
  });

  it('removes < and > characters', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).not.toContain('<');
    expect(sanitizeInput('<b>bold</b>')).not.toContain('>');
  });

  it('removes javascript: protocol', () => {
    expect(sanitizeInput('javascript:alert(1)')).not.toContain('javascript:');
  });

  it('removes event handlers like onclick=', () => {
    const result = sanitizeInput('onclick=badFn()');
    expect(result).not.toMatch(/on\w+\s*=/i);
  });

  it('removes data: protocol', () => {
    expect(sanitizeInput('data:text/html,<h1>xss</h1>')).not.toContain('data:');
  });

  it('trims leading/trailing whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('limits output to 1000 characters', () => {
    const long = 'A'.repeat(2000);
    expect(sanitizeInput(long)).toHaveLength(1000);
  });

  it('passes clean input through unchanged (after trim)', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World');
  });
});

// ---------------------------------------------------------------------------
// validateId
// ---------------------------------------------------------------------------
describe('validateId', () => {
  it('returns numeric ID for valid positive integer string', () => {
    expect(validateId('42')).toBe(42);
  });

  it('returns numeric ID for valid positive integer number', () => {
    expect(validateId(7)).toBe(7);
  });

  it('throws for non-numeric input', () => {
    expect(() => validateId('abc')).toThrow();
  });

  it('throws for zero', () => {
    expect(() => validateId(0)).toThrow();
  });

  it('throws for negative number', () => {
    expect(() => validateId(-1)).toThrow();
  });

  it('throws for number exceeding int32 max', () => {
    expect(() => validateId(2147483648)).toThrow();
  });

  it('accepts max valid ID (2147483647)', () => {
    expect(validateId(2147483647)).toBe(2147483647);
  });

  it('includes fieldName in error message', () => {
    expect(() => validateId(-1, 'HorseId')).toThrow(/HorseId/);
  });
});

// ---------------------------------------------------------------------------
// validateFileUpload
// ---------------------------------------------------------------------------
describe('validateFileUpload', () => {
  const validFile = { size: 1024, mimetype: 'image/jpeg', originalname: 'photo.jpg' };

  it('returns isValid true for valid file', () => {
    expect(validateFileUpload(validFile).isValid).toBe(true);
  });

  it('returns isValid false for null/missing file', () => {
    expect(validateFileUpload(null).isValid).toBe(false);
    expect(validateFileUpload(undefined).isValid).toBe(false);
  });

  it('returns error for file exceeding 5MB', () => {
    const big = { ...validFile, size: 6 * 1024 * 1024 };
    expect(validateFileUpload(big).isValid).toBe(false);
  });

  it('returns error for disallowed mimetype (PDF)', () => {
    const pdf = { ...validFile, mimetype: 'application/pdf' };
    expect(validateFileUpload(pdf).isValid).toBe(false);
  });

  it('accepts all allowed image types', () => {
    for (const mimetype of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      expect(validateFileUpload({ ...validFile, mimetype }).isValid).toBe(true);
    }
  });

  it('rejects file with invalid filename characters', () => {
    const bad = { ...validFile, originalname: '../../../etc/passwd' };
    expect(validateFileUpload(bad).isValid).toBe(false);
  });

  it('uses file.name when originalname is absent', () => {
    const { isValid } = validateFileUpload({ size: 512, mimetype: 'image/png', name: 'horse.png' });
    expect(isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateHorseData — additional branches not in original suite
// ---------------------------------------------------------------------------
describe('validateHorseData — additional branches', () => {
  it('rejects stat value below 0', () => {
    const { isValid, errors } = validateHorseData({ speed: -1 });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('speed'))).toBe(true);
  });

  it('rejects stat value above 100', () => {
    const { isValid, errors } = validateHorseData({ agility: 101 });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('agility'))).toBe(true);
  });

  it('accepts stat values at boundary 0 and 100', () => {
    const { isValid } = validateHorseData({ precision: 0, endurance: 100 });
    expect(isValid).toBe(true);
  });

  it('rejects total_earnings above max', () => {
    const { isValid } = validateHorseData({ total_earnings: 10_000_001 });
    expect(isValid).toBe(false);
  });

  it('rejects stud_fee above max', () => {
    const { isValid } = validateHorseData({ stud_fee: 1_000_001 });
    expect(isValid).toBe(false);
  });

  it('rejects sale_price above max', () => {
    const { isValid } = validateHorseData({ sale_price: 10_000_001 });
    expect(isValid).toBe(false);
  });

  it('accepts age = 0 (foal)', () => {
    const { isValid } = validateHorseData({ age: 0 });
    expect(isValid).toBe(true);
  });

  it('strips id and createdAt when isUpdate = true', () => {
    const { sanitized } = validateHorseData({ name: 'Storm', id: 99, createdAt: 'now' }, true);
    expect(sanitized.id).toBeUndefined();
    expect(sanitized.createdAt).toBeUndefined();
  });

  it('does not strip id when isUpdate = false', () => {
    const { sanitized } = validateHorseData({ name: 'Storm', id: 99 }, false);
    expect(sanitized.id).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// validatePlayerData
// ---------------------------------------------------------------------------
describe('validatePlayerData', () => {
  it('returns valid for complete player data', () => {
    const { isValid } = validatePlayerData({
      name: 'Rider1',
      email: 'rider@example.com',
      money: 500,
      level: 5,
      xp: 1000,
    });
    expect(isValid).toBe(true);
  });

  it('rejects name shorter than 2 chars', () => {
    const { isValid, errors } = validatePlayerData({ name: 'X' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('name'))).toBe(true);
  });

  it('rejects name longer than 30 chars', () => {
    const { isValid } = validatePlayerData({ name: 'A'.repeat(31) });
    expect(isValid).toBe(false);
  });

  it('rejects name with special characters (player names allow only alphanumeric, space, hyphen, underscore)', () => {
    const { isValid } = validatePlayerData({ name: "O'Malley" });
    expect(isValid).toBe(false);
  });

  it('rejects invalid email format', () => {
    const { isValid, errors } = validatePlayerData({ email: 'notanemail' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('email'))).toBe(true);
  });

  it('normalizes email to lowercase', () => {
    const { sanitized } = validatePlayerData({ email: 'RIDER@Example.COM' });
    expect(sanitized.email).toBe('rider@example.com');
  });

  it('rejects negative money', () => {
    const { isValid } = validatePlayerData({ money: -1 });
    expect(isValid).toBe(false);
  });

  it('rejects money above max (100M)', () => {
    const { isValid } = validatePlayerData({ money: 100_000_001 });
    expect(isValid).toBe(false);
  });

  it('rejects level below 1', () => {
    const { isValid } = validatePlayerData({ level: 0 });
    expect(isValid).toBe(false);
  });

  it('rejects level above 100', () => {
    const { isValid } = validatePlayerData({ level: 101 });
    expect(isValid).toBe(false);
  });

  it('rejects xp above max', () => {
    const { isValid } = validatePlayerData({ xp: 10_000_001 });
    expect(isValid).toBe(false);
  });

  it('rejects non-object settings', () => {
    const { isValid, errors } = validatePlayerData({ settings: 'dark' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('Settings'))).toBe(true);
  });

  it('strips disallowed setting keys, keeps allowed ones', () => {
    const { sanitized } = validatePlayerData({ settings: { darkMode: true, hackKey: true } });
    expect(sanitized.settings.darkMode).toBe(true);
    expect(sanitized.settings.hackKey).toBeUndefined();
  });

  it('accepts all four allowed setting keys', () => {
    const { isValid } = validatePlayerData({
      settings: { darkMode: true, notifications: false, privacy: 'public', language: 'en' },
    });
    expect(isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateBreedingData
// ---------------------------------------------------------------------------
describe('validateBreedingData', () => {
  it('returns valid for correct breeding data', () => {
    const { isValid } = validateBreedingData({ sireId: 1, damId: 2 });
    expect(isValid).toBe(true);
  });

  it('rejects missing sireId', () => {
    const { isValid, errors } = validateBreedingData({ damId: 2 });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('sire') || e.includes('dam'))).toBe(true);
  });

  it('rejects missing damId', () => {
    const { isValid } = validateBreedingData({ sireId: 1 });
    expect(isValid).toBe(false);
  });

  it('rejects non-numeric sireId', () => {
    const { isValid, errors } = validateBreedingData({ sireId: 'abc', damId: 2 });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('sire'))).toBe(true);
  });

  it('rejects sireId <= 0', () => {
    const { isValid } = validateBreedingData({ sireId: 0, damId: 2 });
    expect(isValid).toBe(false);
  });

  it('rejects invalid damId (negative)', () => {
    const { isValid, errors } = validateBreedingData({ sireId: 1, damId: -1 });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('dam'))).toBe(true);
  });

  it('rejects self-breeding (sireId === damId)', () => {
    const { isValid, errors } = validateBreedingData({ sireId: 5, damId: 5 });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('itself'))).toBe(true);
  });

  it('rejects breeding fee above 1,000,000', () => {
    const { isValid } = validateBreedingData({ sireId: 1, damId: 2, breedingFee: 1_000_001 });
    expect(isValid).toBe(false);
  });

  it('rejects negative breeding fee', () => {
    const { isValid } = validateBreedingData({ sireId: 1, damId: 2, breedingFee: -1 });
    expect(isValid).toBe(false);
  });

  it('accepts zero breeding fee', () => {
    const { isValid } = validateBreedingData({ sireId: 1, damId: 2, breedingFee: 0 });
    expect(isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRateLimit
// ---------------------------------------------------------------------------
describe('validateRateLimit', () => {
  beforeEach(() => {
    if (global.rateLimitStore) {
      global.rateLimitStore.clear();
    }
  });

  it('allows first request and returns remaining count', () => {
    const result = validateRateLimit('user1', 'testOp', 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('tracks remaining correctly across calls', () => {
    validateRateLimit('user2', 'op', 5, 60_000);
    validateRateLimit('user2', 'op', 5, 60_000);
    const result = validateRateLimit('user2', 'op', 5, 60_000);
    expect(result.remaining).toBe(2);
  });

  it('blocks request when max is reached', () => {
    for (let i = 0; i < 3; i++) {
      validateRateLimit('user3', 'limitedOp', 3, 60_000);
    }
    const result = validateRateLimit('user3', 'limitedOp', 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('different users have independent limits', () => {
    for (let i = 0; i < 3; i++) {
      validateRateLimit('userA', 'op', 3, 60_000);
    }
    const result = validateRateLimit('userB', 'op', 3, 60_000);
    expect(result.allowed).toBe(true);
  });

  it('initialises global store when absent', () => {
    delete global.rateLimitStore;
    const result = validateRateLimit('fresh', 'op', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(global.rateLimitStore).toBeDefined();
  });

  it('expired requests are pruned from the window (filter false-branch)', () => {
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }
    // Inject a 2-minute-old timestamp — outside 60s window
    global.rateLimitStore.set('expUser_expOp', [Date.now() - 120_000]);
    const result = validateRateLimit('expUser', 'expOp', 2, 60_000);
    // Old timestamp filtered out → only 1 new request now → 2-1=1 remaining
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// validateHorseData — NaN and financial branches
// ---------------------------------------------------------------------------
describe('validateHorseData — NaN and financial branches', () => {
  it('NaN age (non-numeric string) exercises isNaN(age) true-branch', () => {
    const { isValid, errors } = validateHorseData({ age: 'old' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('age'))).toBe(true);
  });

  it('NaN stat value (non-numeric string) exercises isNaN(value) true-branch in stat loop', () => {
    const { isValid, errors } = validateHorseData({ speed: 'fast' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('speed'))).toBe(true);
  });

  it('NaN total_earnings exercises isNaN(earnings) true-branch', () => {
    const { isValid } = validateHorseData({ total_earnings: 'lots' });
    expect(isValid).toBe(false);
  });

  it('NaN stud_fee exercises isNaN(fee) true-branch', () => {
    const { isValid } = validateHorseData({ stud_fee: 'free' });
    expect(isValid).toBe(false);
  });

  it('NaN sale_price exercises isNaN(price) true-branch', () => {
    const { isValid } = validateHorseData({ sale_price: 'priceless' });
    expect(isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePlayerData — NaN numeric field branches
// ---------------------------------------------------------------------------
describe('validatePlayerData — NaN numeric field branches', () => {
  it('NaN money (non-numeric string) exercises isNaN(money) true-branch', () => {
    const { isValid, errors } = validatePlayerData({ money: 'lots' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('money'))).toBe(true);
  });

  it('NaN level (non-numeric string) exercises isNaN(level) true-branch', () => {
    const { isValid, errors } = validatePlayerData({ level: 'top' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('level'))).toBe(true);
  });

  it('NaN xp (non-numeric string) exercises isNaN(xp) true-branch', () => {
    const { isValid, errors } = validatePlayerData({ xp: 'many' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('xp'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTrainingData — invalid horseId within else-branch
// ---------------------------------------------------------------------------
describe('validateTrainingData — invalid horseId branches', () => {
  it('negative horseId exercises horseId<=0 true-branch within else', () => {
    const { isValid, errors } = validateTrainingData({ horseId: -1, discipline: 'Racing' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('horse'))).toBe(true);
  });

  it('NaN horseId (string) exercises isNaN(horseId) true-branch within else', () => {
    const { isValid, errors } = validateTrainingData({ horseId: 'abc', discipline: 'Racing' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('horse'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateBreedingData — NaN damId branch
// ---------------------------------------------------------------------------
describe('validateBreedingData — NaN damId branch', () => {
  it('NaN damId (string) exercises isNaN(damId) true-branch', () => {
    const { isValid, errors } = validateBreedingData({ sireId: 1, damId: 'xyz' });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('dam'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateFileUpload — missing filename fallback branch
// ---------------------------------------------------------------------------
describe('validateFileUpload — filename fallback branch', () => {
  it('file with no originalname and no name exercises ||"" fallback branch', () => {
    // originalname: undefined, name: undefined → fileName = '' → regex fails → error
    const result = validateFileUpload({ size: 512, mimetype: 'image/png' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('file name') || e.toLowerCase().includes('filename'))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// validateTrainingData — missing discipline branch (line 243)
// ---------------------------------------------------------------------------
describe('validateTrainingData — missing discipline branch (line 243)', () => {
  it('omitting discipline pushes "Discipline is required" and fails validation (line 243)', () => {
    const result = validateTrainingData({ horseId: 1 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Discipline is required');
  });
});

// ---------------------------------------------------------------------------
// validateTransactionData — missing type branch (line 291)
// ---------------------------------------------------------------------------
describe('validateTransactionData — missing type branch (line 291)', () => {
  it('omitting type pushes "Transaction type is required" and fails validation (line 291)', () => {
    const result = validateTransactionData({ amount: 100 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Transaction type is required');
  });
});
