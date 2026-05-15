/**
 * enhancedGroomController — generateInteractionRecommendations age semantics (Equoria-9ty8)
 *
 * Pre-fix: line 480 compared `horse.age < 1095` — the day-count for 3 years.
 * After Equoria-son6 migrated Horse.age to game-years, every horse was < 1095
 * (years), so the foalCare recommendation fired for adult horses too.
 *
 * Post-fix: compare `horse.age < 3` (game-years foal threshold).
 *
 * Pure helper — no DB.
 */

import { generateInteractionRecommendations } from '../controllers/enhancedGroomController.mjs';

describe('generateInteractionRecommendations — foalCare age threshold (Equoria-9ty8)', () => {
  const foalCareGroom = { speciality: 'foalCare' };
  const otherGroom = { speciality: 'generalGrooming' };
  const calmRelationship = { level: 5 }; // suppresses other recs

  it('5-year-old does NOT receive foalCare recommendation (adult horse)', () => {
    // Pre-fix: horse.age=5 < 1095 was true → 'Sensory Exploration' included.
    // Post-fix: horse.age=5 < 3 is false → not included.
    const adultHorse = { age: 5, stressLevel: 0 };
    const recs = generateInteractionRecommendations(foalCareGroom, adultHorse, calmRelationship);

    expect(recs.find(r => r.variation === 'Sensory Exploration')).toBeUndefined();
  });

  it('2-year-old foal DOES receive foalCare recommendation', () => {
    const foal = { age: 2, stressLevel: 0 };
    const recs = generateInteractionRecommendations(foalCareGroom, foal, calmRelationship);

    expect(recs.find(r => r.variation === 'Sensory Exploration')).toBeDefined();
  });

  it('foal threshold is strict: a 3-year-old does NOT get foalCare rec (boundary)', () => {
    const exactlyThree = { age: 3, stressLevel: 0 };
    const recs = generateInteractionRecommendations(foalCareGroom, exactlyThree, calmRelationship);

    expect(recs.find(r => r.variation === 'Sensory Exploration')).toBeUndefined();
  });

  it('non-foalCare groom does not get the recommendation regardless of age', () => {
    const youngHorse = { age: 1, stressLevel: 0 };
    const recs = generateInteractionRecommendations(otherGroom, youngHorse, calmRelationship);

    expect(recs.find(r => r.variation === 'Sensory Exploration')).toBeUndefined();
  });
});
