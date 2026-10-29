/**
 * TrainerDiscoveryPanel — no "~N more training sessions to reveal" hint (Equoria-colgp).
 *
 * OLD: the panel printed "~{nextDiscoveryAt} more training sessions to reveal the next
 * trait". The server's nextDiscoveryAt is a staff LEVEL, not a count of sessions, so the
 * line was false; the empty profile also seeded a made-up nextDiscoveryAt of 5.
 * NEW (owner ruling q160, 2026-10-28: "Remove the hint line"): the line is gone, as it
 * already is on the rider panel.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrainerDiscoveryPanel, {
  buildEmptyTrainerDiscoveryProfile,
  type TrainerDiscoveryProfile,
} from '../TrainerDiscoveryPanel';

const hint = /more training session|to reveal the next trait/i;

describe('TrainerDiscoveryPanel — no next-reveal hint (Equoria-colgp)', () => {
  it('an empty profile shows no session-count hint', () => {
    render(<TrainerDiscoveryPanel profile={buildEmptyTrainerDiscoveryProfile(1)} />);

    expect(screen.getByText('0 / 4 revealed · 2 coming soon')).toBeInTheDocument();
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it('a partly revealed profile shows no session-count hint', () => {
    const empty = buildEmptyTrainerDiscoveryProfile(1);
    const partial: TrainerDiscoveryProfile = {
      ...empty,
      slots: empty.slots.map((s, i) =>
        i === 0
          ? {
              ...s,
              discovered: true,
              trait: {
                id: 't0',
                label: 'Label t0',
                description: 'About t0',
                icon: '*',
                strength: 'strong' as const,
              },
            }
          : s
      ),
      discoveredCount: 1,
    };

    render(<TrainerDiscoveryPanel profile={partial} />);

    expect(screen.getByText('1 / 4 revealed · 2 coming soon')).toBeInTheDocument();
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it('the empty profile invents no next-reveal value', () => {
    expect(buildEmptyTrainerDiscoveryProfile(1)).not.toHaveProperty('nextDiscoveryAt');
  });
});
