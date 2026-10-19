/**
 * Pure rules of the public trait view (Equoria-6dace): what may be sent to a
 * client about a horse's main traits. The routes that use it are covered end
 * to end by hiddenTraitNamesNeverLeave.test.mjs.
 */

import { describe, it, expect } from '@jest/globals';
import { runInNewContext } from 'node:vm';
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

  // Fix round 1 (review C1): a shared, non-cyclic reference must be scrubbed
  // at EVERY occurrence, not only the first.
  it('scrubs a parent row shared by two siblings at both occurrences', () => {
    const dam = { id: 1, epigeneticModifiers: STORED };
    const out = withPublicTraitModifiers({
      foals: [
        { id: 2, dam },
        { id: 3, dam },
      ],
    });
    expect(JSON.stringify(out)).not.toMatch(/bold|zenith/);
    expect(out.foals[1].dam.epigeneticModifiers.hiddenCount).toBe(2);
    expect(out.foals[0].dam).toBe(out.foals[1].dam);
  });

  it('scrubs an array that appears twice in one body at both occurrences', () => {
    const rows = [{ id: 1, epigeneticModifiers: STORED }];
    const out = withPublicTraitModifiers({ a: rows, b: { again: rows } });
    expect(JSON.stringify(out)).not.toMatch(/bold|zenith/);
    expect(out.b.again[0].epigeneticModifiers.hiddenCount).toBe(2);
  });

  it('scrubs a row built in another realm (as Prisma rows are under Jest)', () => {
    const foreign = runInNewContext(
      "({ id: 1, epigeneticModifiers: { positive: [], negative: [], hidden: ['zenith'] } })",
    );
    const out = withPublicTraitModifiers({ data: foreign });
    expect(JSON.stringify(out)).not.toMatch(/zenith/);
    expect(out.data.epigeneticModifiers.hiddenCount).toBe(1);
  });

  it('terminates on a true cycle and leaves no raw hidden list reachable', () => {
    const horse = { id: 1, epigeneticModifiers: STORED };
    const foal = { id: 2, dam: horse };
    horse.foals = [foal]; // horse -> foals[0] -> dam -> horse
    const out = withPublicTraitModifiers({ data: horse });
    expect(out.data.epigeneticModifiers.hiddenCount).toBe(2);
    // Walking the cycle from the output must reach the scrubbed copy, never
    // the raw input row.
    expect(out.data.foals[0].dam).toBe(out.data);
    expect(out.data.foals[0].dam.epigeneticModifiers.hidden).toBeUndefined();
    expect(horse.epigeneticModifiers).toBe(STORED); // input untouched
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
