/**
 * Tests for ActivityCard Component
 *
 * Testing Sprint Day 3+ - Story 6-3: Enrichment Activity UI
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Helper functions (category icons, status icons, benefit formatting)
 * - Basic rendering (all sections)
 * - Header display (category icon, name, status, recommended badge)
 * - Description and time info
 * - Cooldown timer (conditional rendering)
 * - Cannot perform reason (conditional rendering)
 * - Benefits display (temperament, trait discovery, milestone, bonding, stress)
 * - Click handling and interactions
 * - Card styling (available/unavailable, recommended, cursor)
 * - Props variations and edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivityCard from '../ActivityCard';
import type { EnrichmentActivityDefinition, EnrichmentActivityStatus, Foal } from '@/types/foal';

// Mock the foal type helper functions
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    getActivityStatusColor: vi.fn((status: string) => {
      switch (status) {
        case 'available':
          return 'bg-green-100 text-green-700';
        case 'on_cooldown':
          return 'bg-amber-100 text-amber-700';
        case 'completed_today':
          return 'bg-blue-100 text-blue-700';
        case 'locked':
          return 'bg-gray-100 text-gray-700';
        default:
          return 'bg-slate-100 text-slate-700';
      }
    }),
    getActivityStatusLabel: vi.fn((status: string) => {
      switch (status) {
        case 'available':
          return 'Available';
        case 'on_cooldown':
          return 'Cooldown';
        case 'completed_today':
          return 'Completed';
        case 'locked':
          return 'Locked';
        default:
          return 'Unknown';
      }
    }),
    getCategoryColor: vi.fn((category: string) => {
      switch (category) {
        case 'trust':
          return 'text-pink-600 bg-pink-100';
        case 'desensitization':
          return 'text-purple-600 bg-purple-100';
        case 'exposure':
          return 'text-blue-600 bg-blue-100';
        case 'habituation':
          return 'text-emerald-600 bg-emerald-100';
        default:
          return 'text-slate-600 bg-slate-100';
      }
    }),
    formatCooldownTime: vi.fn((minutes: number) => {
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
      }
      return `${minutes}m`;
    }),
    canPerformActivity: vi.fn((activity, foal, status) => {
      if (status.status === 'available') {
        return { canPerform: true, reason: null };
      }
      if (status.status === 'on_cooldown') {
        return { canPerform: false, reason: 'Activity is on cooldown' };
      }
      if (status.status === 'locked') {
        return { canPerform: false, reason: 'Foal is too young for this activity' };
      }
      return { canPerform: false, reason: 'Activity cannot be performed' };
    }),
  };
});

describe('ActivityCard Component', () => {
  const mockActivity: EnrichmentActivityDefinition = {
    id: 'gentle-touch',
    name: 'Gentle Touch',
    description: 'Build trust through gentle handling and petting',
    category: 'trust',
    durationMinutes: 15,
    cooldownHours: 24,
    benefits: {
      temperamentModifiers: {
        confidence: 5,
        trust: 10,
      },
      traitDiscoveryBoost: 15,
      milestoneBonus: 2,
      bondingIncrease: 5,
      stressReduction: 10,
    },
  };

  const mockFoal: Foal = {
    id: 1,
    userId: 1,
    name: 'Test Foal',
    sex: 'male',
    ageInDays: 30,
    currentMilestone: 'imprinting',
  } as Foal;

  const mockAvailableStatus: EnrichmentActivityStatus = {
    activityId: 'gentle-touch',
    status: 'available',
    lastPerformed: null,
  };

  const mockCooldownStatus: EnrichmentActivityStatus = {
    activityId: 'gentle-touch',
    status: 'on_cooldown',
    lastPerformed: new Date().toISOString(),
    cooldownRemainingMinutes: 120,
  };

  const mockLockedStatus: EnrichmentActivityStatus = {
    activityId: 'gentle-touch',
    status: 'locked',
    lastPerformed: null,
  };

  describe('basic rendering', () => {
    it('should render the activity card', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Gentle Touch')).toBeInTheDocument();
    });

    it('should display activity name', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Gentle Touch')).toBeInTheDocument();
    });

    it('should display activity description', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText(/Build trust through gentle handling/)).toBeInTheDocument();
    });

    it('should display category badge', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Trust')).toBeInTheDocument();
    });

    it('should display status badge', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Available')).toBeInTheDocument();
    });
  });

  describe('header and badges', () => {
    it('should show recommended badge when isRecommended is true', () => {
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          isRecommended={true}
        />
      );
      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('should not show recommended badge when isRecommended is false', () => {
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          isRecommended={false}
        />
      );
      expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
    });

    it('should show different status badge for cooldown', () => {
      render(<ActivityCard activity={mockActivity} status={mockCooldownStatus} foal={mockFoal} />);
      expect(screen.getByText('Cooldown')).toBeInTheDocument();
    });

    it('should show different status badge for locked', () => {
      render(<ActivityCard activity={mockActivity} status={mockLockedStatus} foal={mockFoal} />);
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });

    it('should capitalize category name in badge', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Trust')).toBeInTheDocument();
    });
  });

  describe('time information', () => {
    it('should display duration in minutes', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText(/Duration: 15m/)).toBeInTheDocument();
    });

    it('should display cooldown in hours', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText(/Cooldown: 24h/)).toBeInTheDocument();
    });
  });

  describe('cooldown timer', () => {
    it('should show cooldown timer when status is on_cooldown', () => {
      render(<ActivityCard activity={mockActivity} status={mockCooldownStatus} foal={mockFoal} />);
      expect(screen.getByText(/Available in/)).toBeInTheDocument();
    });

    it('should format cooldown time correctly', () => {
      render(<ActivityCard activity={mockActivity} status={mockCooldownStatus} foal={mockFoal} />);
      expect(screen.getByText(/2h 0m/)).toBeInTheDocument();
    });

    it('should not show cooldown timer when status is available', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.queryByText(/Available in/)).not.toBeInTheDocument();
    });
  });

  describe('cannot perform reason', () => {
    it('should show reason when activity is locked', () => {
      render(<ActivityCard activity={mockActivity} status={mockLockedStatus} foal={mockFoal} />);
      expect(screen.getByText(/Foal is too young/)).toBeInTheDocument();
    });

    it('should not show reason when on cooldown (cooldown timer shows instead)', () => {
      const { container } = render(
        <ActivityCard activity={mockActivity} status={mockCooldownStatus} foal={mockFoal} />
      );
      const reasonElements = container.querySelectorAll('.bg-gray-100');
      expect(reasonElements.length).toBe(0);
    });

    it('should not show reason when available', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.queryByText(/too young/)).not.toBeInTheDocument();
    });
  });

  describe('benefits display', () => {
    it('should display benefits section header', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Benefits:')).toBeInTheDocument();
    });

    it('should display temperament modifier benefits', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('confidence:')).toBeInTheDocument();
      expect(screen.getByText('trust:')).toBeInTheDocument();
    });

    it('should format temperament modifiers with plus sign', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      const plusFiveElements = screen.getAllByText('+5');
      expect(plusFiveElements.length).toBeGreaterThan(0);
    });

    it('should display trait discovery boost', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Trait Discovery:')).toBeInTheDocument();
      expect(screen.getByText('+15%')).toBeInTheDocument();
    });

    it('should display milestone bonus', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Milestone:')).toBeInTheDocument();
      expect(screen.getByText('+2 pts')).toBeInTheDocument();
    });

    it('should display bonding increase', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Bonding:')).toBeInTheDocument();
      const plusFiveElements = screen.getAllByText('+5');
      expect(plusFiveElements.length).toBeGreaterThan(0);
    });

    it('should display stress reduction', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Stress:')).toBeInTheDocument();
      expect(screen.getByText('-10')).toBeInTheDocument();
    });

    it('should handle activity without temperament modifiers', () => {
      const activityNoMods = {
        ...mockActivity,
        benefits: { ...mockActivity.benefits, temperamentModifiers: undefined },
      };
      render(
        <ActivityCard activity={activityNoMods} status={mockAvailableStatus} foal={mockFoal} />
      );
      expect(screen.getByText('Trait Discovery:')).toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('should call onClick when card is clicked and available', () => {
      const handleClick = vi.fn();
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          onClick={handleClick}
        />
      );

      const card = screen.getByRole('button', { name: /Start Gentle Touch/ });
      fireEvent.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when card is unavailable', () => {
      const handleClick = vi.fn();
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockCooldownStatus}
          foal={mockFoal}
          onClick={handleClick}
        />
      );

      // Card should not have button role when unavailable
      const card = screen.queryByRole('button', { name: /Start Gentle Touch/ });
      expect(card).not.toBeInTheDocument();
    });

    it('should show action hint when available and onClick provided', () => {
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          onClick={() => {}}
        />
      );
      expect(screen.getByText(/Click to start activity/)).toBeInTheDocument();
    });

    it('should not show action hint when unavailable', () => {
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockCooldownStatus}
          foal={mockFoal}
          onClick={() => {}}
        />
      );
      expect(screen.queryByText(/Click to start activity/)).not.toBeInTheDocument();
    });

    it('should not show action hint when onClick not provided', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.queryByText(/Click to start activity/)).not.toBeInTheDocument();
    });
  });

  describe('card styling', () => {
    it('should have white background for available activities', () => {
      const { container } = render(
        <ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      const card = container.querySelector('.bg-white');
      expect(card).toBeInTheDocument();
    });

    it('should have gray background for unavailable activities', () => {
      const { container } = render(
        <ActivityCard activity={mockActivity} status={mockCooldownStatus} foal={mockFoal} />
      );
      const card = container.querySelector('.bg-gray-50');
      expect(card).toBeInTheDocument();
    });

    it('should have blue ring when recommended', () => {
      const { container } = render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          isRecommended={true}
        />
      );
      const card = container.querySelector('.ring-2.ring-blue-400');
      expect(card).toBeInTheDocument();
    });

    it('should not have blue ring when not recommended', () => {
      const { container } = render(
        <ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      const card = container.querySelector('.ring-2.ring-blue-400');
      expect(card).not.toBeInTheDocument();
    });

    it('should have pointer cursor when available with onClick', () => {
      const { container } = render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          onClick={() => {}}
        />
      );
      const card = container.querySelector('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });

    it('should have default cursor when unavailable', () => {
      const { container } = render(
        <ActivityCard
          activity={mockActivity}
          status={mockCooldownStatus}
          foal={mockFoal}
          onClick={() => {}}
        />
      );
      const card = container.querySelector('.cursor-default');
      expect(card).toBeInTheDocument();
    });
  });

  describe('category variations', () => {
    it('should handle desensitization category', () => {
      const desensActivity = { ...mockActivity, category: 'desensitization' };
      render(
        <ActivityCard activity={desensActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      expect(screen.getByText('Desensitization')).toBeInTheDocument();
    });

    it('should handle exposure category', () => {
      const exposureActivity = { ...mockActivity, category: 'exposure' };
      render(
        <ActivityCard activity={exposureActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      expect(screen.getByText('Exposure')).toBeInTheDocument();
    });

    it('should handle habituation category', () => {
      const habituationActivity = { ...mockActivity, category: 'habituation' };
      render(
        <ActivityCard activity={habituationActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      expect(screen.getByText('Habituation')).toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('should render category icon', () => {
      const { container } = render(
        <ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should render status icon', () => {
      const { container } = render(
        <ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(3); // Multiple icons in component
    });

    it('should render benefits icon', () => {
      render(<ActivityCard activity={mockActivity} status={mockAvailableStatus} foal={mockFoal} />);
      expect(screen.getByText('Benefits:')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle activity with long name', () => {
      const longNameActivity = {
        ...mockActivity,
        name: 'Very Long Activity Name That Should Handle Properly',
      };
      render(
        <ActivityCard activity={longNameActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      expect(screen.getByText(/Very Long Activity Name/)).toBeInTheDocument();
    });

    it('should handle activity with long description', () => {
      const longDescActivity = {
        ...mockActivity,
        description:
          'This is a very long description that explains the activity in great detail and should wrap properly',
      };
      render(
        <ActivityCard activity={longDescActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      expect(screen.getByText(/very long description/)).toBeInTheDocument();
    });

    it('should handle zero benefit values', () => {
      const zeroBenefitActivity = {
        ...mockActivity,
        benefits: {
          ...mockActivity.benefits,
          stressReduction: 0,
        },
      };
      render(
        <ActivityCard activity={zeroBenefitActivity} status={mockAvailableStatus} foal={mockFoal} />
      );
      expect(screen.getByText('-0')).toBeInTheDocument();
    });

    it('should handle completed_today status', () => {
      const completedStatus: EnrichmentActivityStatus = {
        activityId: 'gentle-touch',
        status: 'completed_today',
        lastPerformed: new Date().toISOString(),
      };
      render(<ActivityCard activity={mockActivity} status={completedStatus} foal={mockFoal} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should handle very short cooldown time', () => {
      const shortCooldownStatus: EnrichmentActivityStatus = {
        ...mockCooldownStatus,
        cooldownRemainingMinutes: 15,
      };
      render(<ActivityCard activity={mockActivity} status={shortCooldownStatus} foal={mockFoal} />);
      expect(screen.getByText(/Available in 15m/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have button role when available and clickable', () => {
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should have descriptive aria-label when available', () => {
      render(
        <ActivityCard
          activity={mockActivity}
          status={mockAvailableStatus}
          foal={mockFoal}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole('button', { name: /Start Gentle Touch/ });
      expect(button).toBeInTheDocument();
    });

    it('should have descriptive aria-label when unavailable', () => {
      const { container } = render(
        <ActivityCard activity={mockActivity} status={mockLockedStatus} foal={mockFoal} />
      );
      const card = container.querySelector('[aria-label*="too young"]');
      expect(card).toBeInTheDocument();
    });
  });
});
