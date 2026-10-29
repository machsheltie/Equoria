/**
 * markingLegCap.test.mjs
 *
 * Equoria-2r7xv (GEN-08): an inherited foal never has more marked legs than
 * its breed's markingBias.maxLegsMarked (Cleveland Bay: 1), even when its
 * parents are marked on different legs. Pure function, real code, seeded RNG.
 */

import { inheritMarkings } from '../services/markingGenerationService.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const clevelandBayLike = {
  markingBias: {
    legsGeneralProbability: 0.1,
    legSpecificProbabilities: { coronet: 0.6, pastern: 0.4 },
    maxLegsMarked: 1,
  },
};

function markings(legMarkings) {
  return {
    faceMarking: 'none',
    legMarkings,
    advancedMarkings: { bloodyShoulderPresent: false, snowflakePresent: false, frostPresent: false },
    modifiers: { isSooty: false, isFlaxen: false, hasPangare: false, isRabicano: false },
  };
}

const sire = markings({ frontLeft: 'sock', frontRight: 'none', hindLeft: 'sock', hindRight: 'none' });
const dam = markings({ frontLeft: 'none', frontRight: 'stocking', hindLeft: 'none', hindRight: 'stocking' });

const legNames = ['frontLeft', 'frontRight', 'hindLeft', 'hindRight'];
const markedLegs = legs => legNames.filter(leg => legs[leg] && legs[leg] !== 'none').length;

describe('Equoria-2r7xv: inherited leg markings respect maxLegsMarked', () => {
  it('a cap-1 breed foal of parents marked on different legs has at most one marked leg', () => {
    const rng = seededRng(0x2e7);
    let sawOne = false;
    for (let i = 0; i < 2000; i++) {
      const foal = inheritMarkings(sire, dam, clevelandBayLike, 'Bay', rng);
      const count = markedLegs(foal.legMarkings);
      expect(count).toBeLessThanOrEqual(1);
      sawOne = sawOne || count === 1;
      for (const leg of legNames) {
        expect(typeof foal.legMarkings[leg]).toBe('string');
      }
    }
    expect(sawOne).toBe(true);
  });

  it('a breed with no cap set keeps the default of four legs', () => {
    const rng = seededRng(0x4);
    let sawFour = false;
    for (let i = 0; i < 500 && !sawFour; i++) {
      const foal = inheritMarkings(sire, dam, null, 'Bay', rng);
      sawFour = markedLegs(foal.legMarkings) === 4;
    }
    expect(sawFour).toBe(true);
  });
});
