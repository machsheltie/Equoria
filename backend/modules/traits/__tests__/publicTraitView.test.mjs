/**
 * Pure rules of the public trait view (Equoria-6dace): what may be sent to a
 * client about a horse's main traits. The routes that use it are covered end
 * to end by hiddenTraitNamesNeverLeave.test.mjs.
 */

import { describe, it, expect } from '@jest/globals';
import {
  hiddenTraitSet,
  publicTraitModifiers,
  visibleTraitKeys,
  withPublicTraitModifiers,
  withoutHiddenTraitHistory,
} from '../../../utils/publicTraitView.mjs';

const STORED = { positive: ['resilient'], negative: ['nervous'], hidden: ['bold', 'zenith'] };

describe('publicTraitModifiers', () => {
  it('keeps visible lists and turns the hidden list into a count', () => {
    expect(publicTraitModifiers(STORED)).toEqual({
      positive: ['resilient'],
      negative: ['nervous'],
      hiddenCount: 2,
    });
  });

  it('sends only the three public keys, whatever else the column holds', () => {
    const view = publicTraitModifiers({ ...STORED, epigenetic_tags: ['calm'] });
    expect(Object.keys(view).sort()).toEqual(['hiddenCount', 'negative', 'positive']);
  });

  it('is idempotent: a view passed back in keeps its count', () => {
    expect(publicTraitModifiers(publicTraitModifiers(STORED))).toEqual(publicTraitModifiers(STORED));
  });

  it('treats a missing or malformed column as empty', () => {
    const empty = { positive: [], negative: [], hiddenCount: 0 };
    expect(publicTraitModifiers(null)).toEqual(empty);
    expect(publicTraitModifiers('bold')).toEqual(empty);
    expect(publicTraitModifiers({ hidden: 'bold' })).toEqual(empty);
  });
});

describe('hiddenTraitSet / visibleTraitKeys', () => {
  it('splits a horse into hidden and visible keys', () => {
    expect([...hiddenTraitSet(STORED)]).toEqual(['bold', 'zenith']);
    expect(visibleTraitKeys(STORED)).toEqual(['resilient', 'nervous']);
  });
});

describe('withPublicTraitModifiers', () => {
  it('rewrites epigeneticModifiers at any depth, inside objects and arrays', () => {
    const body = {
      success: true,
      data: {
        id: 1,
        epigeneticModifiers: STORED,
        sire: { id: 2, epigeneticModifiers: { positive: [], negative: [], hidden: ['zenith'] } },
        foals: [{ id: 3, epigeneticModifiers: STORED }],
      },
    };
    const out = withPublicTraitModifiers(body);
    expect(JSON.stringify(out)).not.toMatch(/bold|zenith/);
    expect(out.data.sire.epigeneticModifiers.hiddenCount).toBe(1);
    expect(out.data.foals[0].epigeneticModifiers.hiddenCount).toBe(2);
  });

  it('never mutates its input and keeps untouched branches by identity', () => {
    const untouched = { id: 9, name: 'Willow' };
    const body = { data: { horse: { epigeneticModifiers: STORED }, other: untouched } };
    const snapshot = JSON.stringify(body);
    const out = withPublicTraitModifiers(body);
    expect(JSON.stringify(body)).toBe(snapshot);
    expect(out.data.other).toBe(untouched);
    expect(out).not.toBe(body);
  });

  it('returns a body with no epigeneticModifiers unchanged', () => {
    const when = new Date('2026-10-19T00:00:00Z');
    const body = { data: [{ id: 1, when }], meta: null };
    const out = withPublicTraitModifiers(body);
    expect(out).toBe(body);
    expect(out.data[0].when).toBe(when);
  });
});

describe('withoutHiddenTraitHistory', () => {
  it('drops history rows naming a trait still hidden on the horse', () => {
    const rows = [{ traitName: 'resilient' }, { traitName: 'bold' }, { traitName: 'nervous' }];
    const kept = withoutHiddenTraitHistory(rows, () => STORED);
    expect(kept.map(r => r.traitName)).toEqual(['resilient', 'nervous']);
  });

  it('keeps a row again once its trait is revealed', () => {
    const revealed = { positive: ['resilient', 'bold'], negative: [], hidden: ['zenith'] };
    const kept = withoutHiddenTraitHistory([{ traitName: 'bold' }], () => revealed);
    expect(kept).toEqual([{ traitName: 'bold' }]);
  });
});
