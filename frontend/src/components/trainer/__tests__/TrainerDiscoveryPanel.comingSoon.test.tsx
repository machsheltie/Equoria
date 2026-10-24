/**
 * TrainerDiscoveryPanel — Horse Compatibility slots say "Coming soon" and the revealed
 * count is honest about them (Equoria-1poxi, owner ruling q14 2026-10-23; trainer fit is
 * coming soon, q34/q61). The count says what it counts: only the slots that can be
 * revealed today, with the compatibility slots named separately.
 *
 * The profile starts from the component's own empty profile (two slots in each of the
 * three categories, in order: specialization, method, compatibility).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import TrainerDiscoveryPanel, {
  buildEmptyTrainerDiscoveryProfile,
  type TrainerDiscoveryProfile,
} from '../TrainerDiscoveryPanel';

/** A profile whose slots are revealed (with a trait) where `discovered[i]` is true. */
function profile(discovered: boolean[]): TrainerDiscoveryProfile {
  const empty = buildEmptyTrainerDiscoveryProfile(1);
  const slots = empty.slots.map((s, i) =>
    discovered[i]
      ? {
          ...s,
          discovered: true,
          trait: {
            id: `t${i}`,
            label: `Label t${i}`,
            description: `About t${i}`,
            icon: '*',
            strength: 'strong' as const,
          },
        }
      : s
  );
  return { ...empty, slots, discoveredCount: discovered.filter(Boolean).length };
}

describe('TrainerDiscoveryPanel — Coming soon (Equoria-1poxi)', () => {
  it('counts revealed slots without the compatibility ones and names them as coming soon', () => {
    render(<TrainerDiscoveryPanel profile={profile([true, true, true, true, true, true])} />);

    expect(screen.getByText('4 / 4 revealed · 2 coming soon')).toBeInTheDocument();
  });

  it('a partial reveal reads x / 4', () => {
    render(<TrainerDiscoveryPanel profile={profile([true, false, true, false, false, false])} />);

    expect(screen.getByText('2 / 4 revealed · 2 coming soon')).toBeInTheDocument();
  });

  it('both Horse Compatibility slots say Coming soon, never a trait or a question mark', () => {
    render(<TrainerDiscoveryPanel profile={profile([true, true, true, true, true, true])} />);

    const heading = screen.getByRole('heading', { name: /horse compatibility/i });
    const section = heading.closest('div')!.parentElement!;
    expect(within(section).getAllByText('Coming soon')).toHaveLength(2);
    expect(within(section).queryByText('Not yet discovered')).not.toBeInTheDocument();
    expect(within(section).queryByText(/Label t4|Label t5/)).not.toBeInTheDocument();
  });

  it('the other categories keep their traits and "Not yet discovered" slots', () => {
    render(<TrainerDiscoveryPanel profile={profile([true, false, false, false, false, false])} />);

    expect(screen.getByText('Label t0')).toBeInTheDocument();
    expect(screen.getAllByText('Not yet discovered')).toHaveLength(3);
  });
});
