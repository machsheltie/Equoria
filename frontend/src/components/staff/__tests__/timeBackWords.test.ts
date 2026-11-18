/**
 * The Owner's outage words (Equoria-puj1e.5): every count a time-back reports
 * reads as words, never as the server's field name.
 */

import { describe, it, expect } from 'vitest';
import { movedLines } from '../timeBackWords';

describe('movedLines', () => {
  it('names owed weekly bank claims in words (owner ruling 2026-10-12)', () => {
    expect(movedLines({ 'User.owedWeeklyClaims': 12, 'Horse.lastGroomed': 0 })).toEqual([
      '12 weekly bank claims owed to players',
    ]);
  });

  it('never shows a field name, even for one it does not know', () => {
    const lines = movedLines({ 'Horse.lastGroomed': 3, 'Mystery.field': 1 });
    expect(lines).toEqual(['3 groomings', '1 other dates']);
    expect(lines.join(' ')).not.toMatch(/Horse\.|Mystery|User\./);
  });
});
