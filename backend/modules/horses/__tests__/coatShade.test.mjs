/**
 * coatShade.test.mjs
 *
 * Equoria-1fyfa (GEN-10): a shade a breed weights zero is never picked, by the
 * genotype-hash path (every breed today) or by the rolled path
 * ("shadeSelection": "rolled"). Pure function, real code.
 */

import { selectShade } from '../services/coatShade.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const shadeBias = { Bay: { dark: 0, standard: 0.6, light: 0.4 } };

describe('Equoria-1fyfa: a zero-weight coat shade is never picked', () => {
  it('genotype-hash selection never picks the zero-weight shade', () => {
    const picked = new Set();
    for (let hash = 0; hash < 500; hash++) {
      picked.add(selectShade('Bay', shadeBias, hash, null));
    }
    expect([...picked].sort()).toEqual(['light', 'standard']);
  });

  it('rolled selection never picks the zero-weight shade', () => {
    const rng = seededRng(0x10fa);
    const picked = new Set();
    for (let i = 0; i < 2000; i++) {
      picked.add(selectShade('Bay', shadeBias, 0, rng));
    }
    expect([...picked].sort()).toEqual(['light', 'standard']);
  });

  it('a negative weight is treated as zero', () => {
    const bias = { Bay: { dark: -0.2, standard: 1 } };
    for (let hash = 0; hash < 50; hash++) {
      expect(selectShade('Bay', bias, hash, null)).toBe('standard');
    }
  });

  it('a colour whose shades are all weighted zero falls back to standard', () => {
    expect(selectShade('Bay', { Bay: { dark: 0, light: 0 } }, 3, null)).toBe('standard');
  });

  it('a small positive weight stays pickable', () => {
    const bias = { Bay: { dark: 0.02, standard: 0.98 } };
    const picked = new Set();
    for (let hash = 0; hash < 200; hash++) {
      picked.add(selectShade('Bay', bias, hash, null));
    }
    expect(picked.has('dark')).toBe(true);
  });
});
