/**
 * TrainingSessionModal — Beta Mode Tests
 *
 * Verifies that the "Learn More" HelpCircle button is hidden when isBetaMode is true.
 * handleLearnMore has no implementation yet and must not appear as a live action in beta.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code (course correction)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock betaRouteScope with isBetaMode: true ─────────────────────────────────
vi.mock('@/config/betaRouteScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/betaRouteScope')>();
  return {
    ...actual,
    isBetaMode: true,
  };
});

// Mock training hooks
vi.mock('@/hooks/api/useTraining', () => ({
  useTrainingStatus: () => ({ data: { score: 75, nextEligibleDate: null } }),
  useTrainingEligibility: () => ({ mutateAsync: vi.fn(), data: null, isPending: false }),
  useTrainingSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Import AFTER mocks are registered
const { default: TrainingSessionModal } = await import('../TrainingSessionModal');

const mockHorse = {
  id: 1,
  name: 'Thunder',
  level: 5,
  breed: 'Arabian',
  ageYears: 4,
  bestDisciplines: ['Dressage', 'Racing'],
  nextEligibleAt: null,
};

describe('TrainingSessionModal — beta mode', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides the "Learn more about traits" help button in beta mode', () => {
    render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

    expect(
      screen.queryByRole('button', { name: /learn more about traits/i })
    ).not.toBeInTheDocument();
  });

  it('hides the HelpCircle icon in beta mode', () => {
    render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

    expect(screen.queryByTestId('help-circle-icon')).not.toBeInTheDocument();
  });

  it('still renders the trait modifiers section in beta mode', () => {
    render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

    expect(screen.getByTestId('trait-modifiers-section')).toBeInTheDocument();
    expect(screen.getByText('Trait Modifiers')).toBeInTheDocument();
  });

  it('still renders Start Training and Check Eligibility buttons in beta mode', () => {
    render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

    expect(screen.getByRole('button', { name: /start training/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check eligibility/i })).toBeInTheDocument();
  });
});
