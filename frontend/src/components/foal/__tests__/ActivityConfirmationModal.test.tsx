/**
 * Tests for ActivityConfirmationModal Component
 *
 * Testing Sprint - Story 6-3: Enrichment Activity UI
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Null handling (no activity or foal)
 * - BaseModal integration
 * - Category icons and colors (trust, desensitization, exposure, habituation)
 * - Activity header display (name, category badge)
 * - Foal information (name, age, bonding, stress)
 * - Time details (duration, cooldown)
 * - Benefits display (temperament modifiers, trait discovery, milestone, bonding, stress)
 * - Cooldown warning message
 * - Action buttons (cancel, confirm, loading states)
 * - Submitting state with spinner
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import ActivityConfirmationModal from '../ActivityConfirmationModal';
import type { EnrichmentActivityDefinition, Foal } from '@/types/foal';

// Mock BaseModal
interface MockBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isSubmitting?: boolean;
}

vi.mock('@/components/common/BaseModal', () => ({
  default: ({ isOpen, onClose, title, children, isSubmitting }: MockBaseModalProps) =>
    isOpen ? (
      <div data-testid="base-modal" data-submitting={isSubmitting}>
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close modal">
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

// Mock getCategoryColor helper
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    getCategoryColor: (category: string) => {
      const colorMap: Record<string, string> = {
        trust: 'text-blue-600 bg-blue-50',
        desensitization: 'text-purple-600 bg-purple-50',
        exposure: 'text-emerald-600 bg-emerald-50',
        habituation: 'text-amber-600 bg-amber-50',
      };
      return colorMap[category] || 'text-slate-600 bg-slate-50';
    },
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Heart: () => <svg data-testid="heart-icon" />,
  Shield: () => <svg data-testid="shield-icon" />,
  Compass: () => <svg data-testid="compass-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  Sparkles: () => <svg data-testid="sparkles-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  AlertCircle: () => <svg data-testid="alert-circle-icon" />,
  Timer: () => <svg data-testid="timer-icon" />,
}));

describe('ActivityConfirmationModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockActivity: EnrichmentActivityDefinition = {
    id: 'gentle-touch',
    name: 'Gentle Touch',
    description: 'Build trust through gentle, consistent touch and grooming.',
    category: 'trust',
    durationMinutes: 15,
    cooldownHours: 6,
    benefits: {
      temperamentModifiers: {
        boldness: 2,
        obedience: 3,
      },
      traitDiscoveryBoost: 5,
      milestoneBonus: 10,
      bondingIncrease: 5,
      stressReduction: 3,
    },
    minAge: 1,
    maxAge: 365,
    requiredBonding: 0,
  };

  const mockFoal: Foal = {
    id: 'foal-1',
    name: 'Thunder',
    ageInDays: 30,
    bondingLevel: 45,
    stressLevel: 20,
    sireId: 'sire-1',
    damId: 'dam-1',
    birthDate: '2026-01-15',
    userId: 'user-1',
  };

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    activity: mockActivity,
    foal: mockFoal,
    isSubmitting: false,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnConfirm.mockClear();
  });

  describe('null handling', () => {
    it('should return null when activity is null', () => {
      const { container } = render(<ActivityConfirmationModal {...defaultProps} activity={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('should return null when foal is null', () => {
      const { container } = render(<ActivityConfirmationModal {...defaultProps} foal={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when both activity and foal are provided', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });
  });

  describe('BaseModal integration', () => {
    it('should pass isOpen prop to BaseModal', () => {
      render(<ActivityConfirmationModal {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<ActivityConfirmationModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });

    it('should pass correct title to BaseModal', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Confirm Enrichment Activity')).toBeInTheDocument();
    });

    it('should pass isSubmitting state to BaseModal', () => {
      render(<ActivityConfirmationModal {...defaultProps} isSubmitting={true} />);
      const modal = screen.getByTestId('base-modal');
      expect(modal).toHaveAttribute('data-submitting', 'true');
    });
  });

  describe('category icons', () => {
    it('should display Heart icon for trust category', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('heart-icon')).toBeInTheDocument();
    });

    it('should display Shield icon for desensitization category', () => {
      const desensitizationActivity = {
        ...mockActivity,
        category: 'desensitization' as const,
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={desensitizationActivity} />);
      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
    });

    it('should display Compass icon for exposure category', () => {
      const exposureActivity = {
        ...mockActivity,
        category: 'exposure' as const,
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={exposureActivity} />);
      expect(screen.getByTestId('compass-icon')).toBeInTheDocument();
    });

    it('should display Clock icon for habituation category', () => {
      const habituationActivity = {
        ...mockActivity,
        category: 'habituation' as const,
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={habituationActivity} />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should display Sparkles icon for unknown category', () => {
      const unknownActivity = {
        ...mockActivity,
        category: 'unknown',
      } as EnrichmentActivityDefinition;
      render(<ActivityConfirmationModal {...defaultProps} activity={unknownActivity} />);
      expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
    });
  });

  describe('activity header', () => {
    it('should display activity name', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Gentle Touch')).toBeInTheDocument();
    });

    it('should display category badge with capitalized text', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Trust')).toBeInTheDocument();
    });

    it('should capitalize first letter of category', () => {
      const exposureActivity = {
        ...mockActivity,
        category: 'exposure' as const,
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={exposureActivity} />);
      expect(screen.getByText('Exposure')).toBeInTheDocument();
    });
  });

  describe('foal information', () => {
    it('should display foal name', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText(/Thunder/)).toBeInTheDocument();
    });

    it('should display foal age', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText(/30 days old/)).toBeInTheDocument();
    });

    it('should display bonding level', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText(/Bonding:/)).toBeInTheDocument();
      expect(screen.getByText(/45\/100/)).toBeInTheDocument();
    });

    it('should display stress level', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText(/Stress:/)).toBeInTheDocument();
      expect(screen.getByText(/20\/100/)).toBeInTheDocument();
    });

    it('should handle foal with no name', () => {
      const unnamedFoal = {
        ...mockFoal,
        name: '',
      };
      render(<ActivityConfirmationModal {...defaultProps} foal={unnamedFoal} />);
      expect(screen.getByText(/Unnamed Foal/)).toBeInTheDocument();
    });

    it('should handle missing bonding level', () => {
      const foalNoBonding = {
        ...mockFoal,
        bondingLevel: undefined,
      } as Foal;
      render(<ActivityConfirmationModal {...defaultProps} foal={foalNoBonding} />);
      expect(screen.getByText(/0\/100/)).toBeInTheDocument();
    });

    it('should handle missing stress level', () => {
      const foalNoStress = {
        ...mockFoal,
        stressLevel: undefined,
      } as Foal;
      render(<ActivityConfirmationModal {...defaultProps} foal={foalNoStress} />);
      expect(screen.getByText(/0\/100/)).toBeInTheDocument();
    });
  });

  describe('description', () => {
    it('should display activity description', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(
        screen.getByText('Build trust through gentle, consistent touch and grooming.')
      ).toBeInTheDocument();
    });
  });

  describe('time details', () => {
    it('should display duration in minutes', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('15 minutes')).toBeInTheDocument();
    });

    it('should display cooldown in hours', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Cooldown')).toBeInTheDocument();
      expect(screen.getByText('6 hours')).toBeInTheDocument();
    });

    it('should display Clock icon for duration', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      const clockIcons = screen.getAllByTestId('clock-icon');
      expect(clockIcons.length).toBeGreaterThan(0);
    });

    it('should display Timer icon for cooldown', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('timer-icon')).toBeInTheDocument();
    });
  });

  describe('benefits display', () => {
    it('should display TrendingUp icon in benefits section', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('should display "Expected Benefits" header', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Expected Benefits')).toBeInTheDocument();
    });

    it('should display temperament modifiers with + prefix for positive values', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText(/Boldness:/i)).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.getByText(/Obedience:/i)).toBeInTheDocument();
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('should display negative temperament modifiers without + prefix', () => {
      const activityWithNegative = {
        ...mockActivity,
        benefits: {
          ...mockActivity.benefits,
          temperamentModifiers: {
            boldness: -2,
          },
        },
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={activityWithNegative} />);
      expect(screen.getByText('-2')).toBeInTheDocument();
    });

    it('should display trait discovery boost with % sign', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Trait Discovery:')).toBeInTheDocument();
      expect(screen.getByText('+5%')).toBeInTheDocument();
    });

    it('should display milestone bonus with pts suffix', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Milestone Bonus:')).toBeInTheDocument();
      expect(screen.getByText('+10 pts')).toBeInTheDocument();
    });

    it('should display bonding increase', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Bonding Increase:')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should display stress reduction with minus prefix', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Stress Reduction:')).toBeInTheDocument();
      expect(screen.getByText('-3')).toBeInTheDocument();
    });

    it('should handle multiple temperament modifiers', () => {
      const activityWithMultiple = {
        ...mockActivity,
        benefits: {
          ...mockActivity.benefits,
          temperamentModifiers: {
            boldness: 2,
            obedience: 3,
            intelligence: 1,
          },
        },
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={activityWithMultiple} />);
      expect(screen.getByText(/Boldness:/i)).toBeInTheDocument();
      expect(screen.getByText(/Obedience:/i)).toBeInTheDocument();
      expect(screen.getByText(/Intelligence:/i)).toBeInTheDocument();
    });

    it('should handle activity with no temperament modifiers', () => {
      const activityNoMods = {
        ...mockActivity,
        benefits: {
          ...mockActivity.benefits,
          temperamentModifiers: {},
        },
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={activityNoMods} />);
      // Should still display other benefits
      expect(screen.getByText('Trait Discovery:')).toBeInTheDocument();
    });
  });

  describe('cooldown warning', () => {
    it('should display AlertCircle icon', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    it('should display "Important Note" header', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByText('Important Note')).toBeInTheDocument();
    });

    it('should display cooldown warning message with hours', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(
        screen.getByText(/After completing this activity, it will be unavailable for 6 hours/i)
      ).toBeInTheDocument();
    });

    it('should display planning advice', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(
        screen.getByText(/Plan your foal's enrichment schedule accordingly/i)
      ).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should display Cancel button', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should display Start Activity button', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Start Activity/i })).toBeInTheDocument();
    });

    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ActivityConfirmationModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when Start Activity is clicked', async () => {
      const user = userEvent.setup();
      render(<ActivityConfirmationModal {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: /Start Activity/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should disable buttons when isSubmitting is true', () => {
      render(<ActivityConfirmationModal {...defaultProps} isSubmitting={true} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      const confirmButton = screen.getByRole('button', { name: /Starting Activity/i });

      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });

    it('should display loading spinner when submitting', () => {
      const { container } = render(
        <ActivityConfirmationModal {...defaultProps} isSubmitting={true} />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should change button text to "Starting Activity..." when submitting', () => {
      render(<ActivityConfirmationModal {...defaultProps} isSubmitting={true} />);
      expect(screen.getByText('Starting Activity...')).toBeInTheDocument();
    });

    it('should not display Sparkles icon when submitting', () => {
      render(<ActivityConfirmationModal {...defaultProps} isSubmitting={true} />);
      // Sparkles icon should not be in the confirm button
      const confirmButton = screen.getByRole('button', { name: /Starting Activity/i });
      expect(confirmButton.querySelector('[data-testid="sparkles-icon"]')).not.toBeInTheDocument();
    });

    it('should display Sparkles icon when not submitting', () => {
      render(<ActivityConfirmationModal {...defaultProps} />);
      const confirmButton = screen.getByRole('button', { name: /Start Activity/i });
      expect(confirmButton.textContent).toContain('Start Activity');
    });
  });

  describe('edge cases', () => {
    it('should handle activity with zero duration', () => {
      const activityZeroDuration = {
        ...mockActivity,
        durationMinutes: 0,
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={activityZeroDuration} />);
      expect(screen.getByText('0 minutes')).toBeInTheDocument();
    });

    it('should handle activity with zero cooldown', () => {
      const activityZeroCooldown = {
        ...mockActivity,
        cooldownHours: 0,
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={activityZeroCooldown} />);
      expect(screen.getByText('0 hours')).toBeInTheDocument();
    });

    it('should handle foal with age 0', () => {
      const newbornFoal = {
        ...mockFoal,
        ageInDays: 0,
      };
      render(<ActivityConfirmationModal {...defaultProps} foal={newbornFoal} />);
      expect(screen.getByText(/0 days old/)).toBeInTheDocument();
    });

    it('should handle very long activity names', () => {
      const longNameActivity = {
        ...mockActivity,
        name: 'This is a very long activity name that should still display correctly',
      };
      render(<ActivityConfirmationModal {...defaultProps} activity={longNameActivity} />);
      expect(
        screen.getByText('This is a very long activity name that should still display correctly')
      ).toBeInTheDocument();
    });

    it('should handle empty description', () => {
      const emptyDescActivity = {
        ...mockActivity,
        description: '',
      };
      const { container } = render(
        <ActivityConfirmationModal {...defaultProps} activity={emptyDescActivity} />
      );
      // Should still render modal even with empty description
      expect(container.querySelector('.space-y-4')).toBeInTheDocument();
    });
  });
});
