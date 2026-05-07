/**
 * securityValidation — unit tests (Equoria-rr7)
 *
 * Pure functions (crypto + logger imports only). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateHorseData,
  validateTrainingData,
  validateTransactionData,
  generateDataHash,
  verifyDataIntegrity,
  sanitizeInput,
  validateId,
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
});
