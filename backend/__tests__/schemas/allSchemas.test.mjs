import { describe, it, expect } from '@jest/globals';
import { allSchemas } from '../../schemas/index.mjs';
import { authSchemas } from '../../schemas/authSchemas.mjs';
import { horseSchemas } from '../../schemas/horseSchemas.mjs';
import { breedingSchemas } from '../../schemas/breedingSchemas.mjs';
import { competitionSchemas } from '../../schemas/competitionSchemas.mjs';
import { groomSchemas } from '../../schemas/groomSchemas.mjs';
import { trainingSchemas } from '../../schemas/trainingSchemas.mjs';
import { traitSchemas } from '../../schemas/traitSchemas.mjs';
import { adminSchemas } from '../../schemas/adminSchemas.mjs';
import { docsSchemas } from '../../schemas/docsSchemas.mjs';
import { labSchemas } from '../../schemas/labSchemas.mjs';
import { leaderboardSchemas } from '../../schemas/leaderboardSchemas.mjs';

describe('allSchemas (index)', () => {
  it('is an array', () => {
    expect(Array.isArray(allSchemas)).toBe(true);
  });

  it('has at least one entry', () => {
    expect(allSchemas.length).toBeGreaterThan(0);
  });

  it('every entry has a path string', () => {
    for (const schema of allSchemas) {
      expect(typeof schema.path).toBe('string');
    }
  });

  it('every entry has a method string', () => {
    for (const schema of allSchemas) {
      expect(typeof schema.method).toBe('string');
    }
  });

  it('every entry has a tags array', () => {
    for (const schema of allSchemas) {
      expect(Array.isArray(schema.tags)).toBe(true);
    }
  });

  it('every entry has a responses object', () => {
    for (const schema of allSchemas) {
      expect(typeof schema.responses).toBe('object');
    }
  });

  it('contains entries from all sub-schema groups', () => {
    const allPaths = allSchemas.map(s => s.path);
    expect(allPaths.some(p => p.includes('auth'))).toBe(true);
    expect(allPaths.some(p => p.includes('horse') || p.includes('breed'))).toBe(true);
  });
});

describe('authSchemas', () => {
  it('is an array with at least 2 entries', () => {
    expect(Array.isArray(authSchemas)).toBe(true);
    expect(authSchemas.length).toBeGreaterThanOrEqual(2);
  });

  it('has a login endpoint', () => {
    const login = authSchemas.find(s => s.path.includes('login'));
    expect(login).toBeDefined();
    expect(login.method).toBe('post');
  });

  it('has a register endpoint', () => {
    const register = authSchemas.find(s => s.path.includes('register'));
    expect(register).toBeDefined();
    expect(register.method).toBe('post');
  });

  it('login requires email and password', () => {
    const login = authSchemas.find(s => s.path.includes('login'));
    expect(login.request.body.required).toContain('email');
    expect(login.request.body.required).toContain('password');
  });

  it('all entries tagged with auth', () => {
    for (const schema of authSchemas) {
      expect(schema.tags).toContain('auth');
    }
  });
});

describe('horseSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(horseSchemas)).toBe(true);
    expect(horseSchemas.length).toBeGreaterThan(0);
  });

  it('has a GET /horses entry', () => {
    const entry = horseSchemas.find(s => s.method === 'get' && s.path === '/horses');
    expect(entry).toBeDefined();
  });

  it('has a POST /horses entry with required fields', () => {
    const entry = horseSchemas.find(s => s.method === 'post' && s.path === '/horses');
    expect(entry).toBeDefined();
    expect(entry.request.body.required).toContain('name');
    expect(entry.request.body.required).toContain('discipline');
  });

  it('all entries tagged with horses', () => {
    for (const schema of horseSchemas) {
      expect(schema.tags).toContain('horses');
    }
  });
});

describe('breedingSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(breedingSchemas)).toBe(true);
    expect(breedingSchemas.length).toBeGreaterThan(0);
  });

  it('has a breeding request endpoint', () => {
    const entry = breedingSchemas.find(s => s.path.includes('breeding'));
    expect(entry).toBeDefined();
  });

  it('breeding request requires sireId and damId', () => {
    const entry = breedingSchemas.find(s => s.method === 'post');
    expect(entry.request.body.required).toContain('sireId');
    expect(entry.request.body.required).toContain('damId');
  });
});

describe('competitionSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(competitionSchemas)).toBe(true);
    expect(competitionSchemas.length).toBeGreaterThan(0);
  });

  it('all entries tagged with competition', () => {
    for (const schema of competitionSchemas) {
      expect(schema.tags).toContain('competition');
    }
  });
});

describe('groomSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(groomSchemas)).toBe(true);
    expect(groomSchemas.length).toBeGreaterThan(0);
  });

  it('all entries tagged with grooms', () => {
    for (const schema of groomSchemas) {
      expect(schema.tags).toContain('grooms');
    }
  });
});

describe('trainingSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(trainingSchemas)).toBe(true);
    expect(trainingSchemas.length).toBeGreaterThan(0);
  });

  it('all entries tagged with training', () => {
    for (const schema of trainingSchemas) {
      expect(schema.tags).toContain('training');
    }
  });
});

describe('traitSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(traitSchemas)).toBe(true);
    expect(traitSchemas.length).toBeGreaterThan(0);
  });
});

describe('adminSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(adminSchemas)).toBe(true);
    expect(adminSchemas.length).toBeGreaterThan(0);
  });
});

describe('docsSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(docsSchemas)).toBe(true);
    expect(docsSchemas.length).toBeGreaterThan(0);
  });
});

describe('labSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(labSchemas)).toBe(true);
    expect(labSchemas.length).toBeGreaterThan(0);
  });
});

describe('leaderboardSchemas', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(leaderboardSchemas)).toBe(true);
    expect(leaderboardSchemas.length).toBeGreaterThan(0);
  });
});
