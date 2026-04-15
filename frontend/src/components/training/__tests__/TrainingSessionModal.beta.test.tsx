/**
 * TrainingSessionModal — Active Feature Tests
 *
 * Verifies that training modal exposes live training actions universally.
 * The "Learn More" HelpCircle button was a no-op placeholder and has been
 * removed universally — this is not a beta-specific behavior.
 *
 * Story 21R-2: Remove beta-hidden behavior — training modal must expose
 * all real actions consistently across beta and production.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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

describe('TrainingSessionModal — active training UX', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the trait modifiers section', () => {
    render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

    expect(screen.getByTestId('trait-modifiers-section')).toBeInTheDocument();
    expect(screen.getByText('Trait Modifiers')).toBeInTheDocument();
  });

  it('renders Start Training and Check Eligibility action buttons', () => {
    render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

    expect(screen.getByRole('button', { name: /start training/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check eligibility/i })).toBeInTheDocument();
  });

  it('does not render a no-op "Learn more about traits" button — it has no implementation', () => {
    render(<TrainingSessionModal horse={mockHorse} onClose={mockOnClose} />);

    // The help button was a placeholder with no implementation and was removed universally.
    // If this button is needed in future, implement it before re-adding it.
    expect(
      screen.queryByRole('button', { name: /learn more about traits/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('help-circle-icon')).not.toBeInTheDocument();
  });
});
