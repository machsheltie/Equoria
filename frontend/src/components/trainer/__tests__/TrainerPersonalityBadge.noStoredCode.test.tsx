/**
 * TrainerPersonalityBadge never shows a stored personality code (Equoria-no441,
 * owner rulings 2026-10-28 q164/q165): a personality the badge has not been
 * taught reads as authored words, like the rider and groom badges.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrainerPersonalityBadge, { getTrainerPersonalityInfo } from '../TrainerPersonalityBadge';

describe('TrainerPersonalityBadge: an unlisted personality', () => {
  it('reads "Hard to Read", never the stored value', () => {
    const { container } = render(<TrainerPersonalityBadge personality="steelyCalmV2" />);
    expect(screen.getByText('Hard to Read')).toBeInTheDocument();
    expect(container.textContent).not.toContain('steelyCalmV2');
    expect(getTrainerPersonalityInfo('steelyCalmV2').label).toBe('Hard to Read');
  });

  it('keeps the authored word for a listed personality', () => {
    render(<TrainerPersonalityBadge personality="focused" />);
    expect(screen.getByText('Focused')).toBeInTheDocument();
  });
});
