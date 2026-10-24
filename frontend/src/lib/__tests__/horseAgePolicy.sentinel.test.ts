/**
 * One retirement age, one forum-section list on the frontend (Equoria-iehtc).
 *
 * Before: RETIREMENT_AGE_YEARS = 21 was declared inline in CommunityPage while
 * MyStablePage and StableView kept their own bare `21` literals, and
 * MessageBoardPage kept a private copy of the forum sections, so a change to
 * either could half-apply.
 *
 * Now the age lives in lib/horseAgePolicy.ts (mirroring the backend's
 * constants/horseAgePolicy.mjs) and the board's tabs come from forumSections.
 *
 * Sentinel-positive: each assertion fails when its consolidation is undone.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { retirementAgeYears } from '../horseAgePolicy';
import { forumSections } from '../api/forum';

const read = (relative: string) => readFileSync(join(__dirname, relative), 'utf8');

describe('shared retirement age (Equoria-iehtc)', () => {
  it('mirrors the backend horseAgePolicy value', () => {
    const backend = read('../../../../backend/constants/horseAgePolicy.mjs');
    const match = /export const retirementAgeYears = (\d+);/.exec(backend);

    expect(match).not.toBeNull();
    expect(retirementAgeYears).toBe(Number(match?.[1]));
  });

  it.each([
    ['CommunityPage', '../../pages/CommunityPage.tsx'],
    ['MyStablePage', '../../pages/MyStablePage.tsx'],
    ['StableView', '../../pages/StableView.tsx'],
  ])('%s imports the shared constant instead of declaring or hardcoding it', (_name, path) => {
    const source = read(path);

    expect(source).toMatch(/retirementAgeYears[\s\S]*from '@\/lib\/horseAgePolicy'/);
    expect(source).not.toMatch(/const (RETIREMENT_AGE_YEARS|retirementAgeYears)\s*=/);
    expect(source).not.toMatch(/>=\s*21\b/);
    expect(source).not.toMatch(/\?\?\s*21\b/);
  });
});

describe('message board sections (Equoria-iehtc)', () => {
  it('MessageBoardPage takes its sections from forumSections, not a private list', () => {
    const source = read('../../pages/MessageBoardPage.tsx');

    expect(source).toMatch(/forumSections/);
    expect(source).not.toMatch(/const sections: ForumSection\[\]/);
  });

  it('every shared section has board copy (label, emoji, description)', async () => {
    // The page keeps its copy keyed by the same union; a section added to
    // forumSections without copy would render a blank tab.
    const source = read('../../pages/MessageBoardPage.tsx');
    for (const section of forumSections) {
      expect(source).toMatch(new RegExp(`\\b${section}:\\s*\\{`));
    }
  });
});
