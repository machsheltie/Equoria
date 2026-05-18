/**
 * pedigreeTreeFromLineage tests (Equoria-55bo.2)
 *
 * Asserts the pure mapper turns the REAL backend lineage-analysis response
 * shape (recursive sire/dam nodes from buildHorseNode) into a PedigreeTree,
 * and returns null (honest empty state — no fabrication) when the payload is
 * missing or has no root horses.
 */

import { describe, it, expect } from 'vitest';
import { mapLineageToPedigreeTree } from '../pedigreeTreeFromLineage';

// Mirrors the documented backend response after apiClient unwraps the
// { success, data } envelope: the inner object from the lineage-analysis route.
const realBackendLineage = {
  lineageTree: {
    root: {
      stallion: {
        id: 1,
        name: 'Atlas',
        generation: 0,
        sire: {
          id: 11,
          name: 'Atlas Sire',
          generation: 1,
          sire: { id: 111, name: 'Atlas GrandSire', generation: 2, sire: null, dam: null },
          dam: { id: 112, name: 'Atlas GrandDam', generation: 2, sire: null, dam: null },
        },
        dam: { id: 12, name: 'Atlas Dam', generation: 1, sire: null, dam: null },
      },
      mare: {
        id: 2,
        name: 'Luna',
        generation: 0,
        sire: { id: 21, name: 'Luna Sire', generation: 1, sire: null, dam: null },
        dam: { id: 22, name: 'Luna Dam', generation: 1, sire: null, dam: null },
      },
    },
  },
  diversityMetrics: {},
  performanceAnalysis: {},
};

describe('mapLineageToPedigreeTree', () => {
  it('builds a recursive 3-generation tree from the real backend shape', () => {
    const tree = mapLineageToPedigreeTree(realBackendLineage);
    expect(tree).not.toBeNull();
    expect(tree!.stallion?.name).toBe('Atlas');
    expect(tree!.mare?.name).toBe('Luna');

    // Generation 1 (parents of the breeding pair)
    expect(tree!.stallion?.sire?.name).toBe('Atlas Sire');
    expect(tree!.stallion?.dam?.name).toBe('Atlas Dam');

    // Generation 2 (grandparents) — proves it is a TREE, not a flat list
    expect(tree!.stallion?.sire?.sire?.name).toBe('Atlas GrandSire');
    expect(tree!.stallion?.sire?.dam?.name).toBe('Atlas GrandDam');
    expect(tree!.stallion?.sire?.sire?.generation).toBe(2);

    // Leaf nodes have null parents (no fabricated deeper ancestors)
    expect(tree!.stallion?.sire?.sire?.sire).toBeNull();
    expect(tree!.mare?.sire?.name).toBe('Luna Sire');
  });

  it('returns null when lineage payload is missing (no fabrication)', () => {
    expect(mapLineageToPedigreeTree(null)).toBeNull();
    expect(mapLineageToPedigreeTree(undefined)).toBeNull();
    expect(mapLineageToPedigreeTree({})).toBeNull();
    expect(mapLineageToPedigreeTree({ lineageTree: { root: {} } })).toBeNull();
  });

  it('drops malformed nodes instead of inventing data', () => {
    const tree = mapLineageToPedigreeTree({
      lineageTree: {
        root: {
          stallion: { id: 1, name: 'OnlySire', generation: 0, sire: null, dam: null },
          mare: { name: 'NoId' } as unknown as { id: number; name: string },
        },
      },
    });
    expect(tree).not.toBeNull();
    expect(tree!.stallion?.name).toBe('OnlySire');
    // mare node had no numeric id → dropped, not fabricated
    expect(tree!.mare).toBeNull();
  });
});
