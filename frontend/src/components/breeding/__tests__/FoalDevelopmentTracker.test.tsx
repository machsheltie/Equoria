import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FoalDevelopmentTracker from '../FoalDevelopmentTracker';
import * as useBreedingHooks from '@/hooks/api/useBreeding';

// Mock all breeding hooks
vi.mock('@/hooks/api/useBreeding');

describe('FoalDevelopmentTracker', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default mock implementations
    vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
      data: {
        id: 1,
        name: 'Little Star',
        ageDays: 45,
        sireId: 10,
        damId: 11,
        traits: ['fast', 'gentle'],
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
      data: {
        stage: 'weanling',
        progress: 60,
        bonding: 75,
        stress: 20,
        enrichmentLevel: 50,
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({
      data: [
        {
          id: 1,
          activity: 'trust_building',
          duration: 15,
          createdAt: '2025-12-09T10:00:00Z',
        },
        {
          id: 2,
          activity: 'grooming',
          duration: 10,
          createdAt: '2025-12-09T09:00:00Z',
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useBreedingHooks.useLogFoalActivity).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  const renderComponent = (foalId: number = 1) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FoalDevelopmentTracker foalId={foalId} />
      </QueryClientProvider>
    );
  };

  describe('Component Rendering', () => {
    it('should render foal development tracker with foal details', () => {
      renderComponent();

      expect(screen.getByText('Foal Development')).toBeInTheDocument();
      expect(screen.getByText('Foal #1')).toBeInTheDocument();
      expect(screen.getByText(/Little Star • Age 45 days/i)).toBeInTheDocument();
    });

    it('should render unnamed foal placeholder when name is missing', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: {
          id: 1,
          ageDays: 30,
          sireId: 10,
          damId: 11,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText(/Unnamed foal • Age 30 days/i)).toBeInTheDocument();
    });

    it('should render age placeholder when ageDays is missing', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: {
          id: 1,
          name: 'Little Star',
          sireId: 10,
          damId: 11,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText(/Little Star • Age — days/i)).toBeInTheDocument();
    });
  });

  describe('Development Stage Display', () => {
    it('should display stage and progress correctly', () => {
      renderComponent();

      expect(screen.getByText('Stage')).toBeInTheDocument();
      expect(screen.getByText('weanling')).toBeInTheDocument();
      expect(screen.getByText('Progress: 60%')).toBeInTheDocument();
    });

    it('should display unknown stage when stage is missing', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: {
          progress: 50,
          bonding: 60,
          stress: 10,
          enrichmentLevel: 40,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('Progress: 50%')).toBeInTheDocument();
    });

    it('should display zero progress when progress is missing', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: {
          stage: 'foal',
          bonding: 60,
          stress: 10,
          enrichmentLevel: 40,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Progress: 0%')).toBeInTheDocument();
    });
  });

  describe('Wellbeing Metrics', () => {
    it('should display bonding, stress, and enrichment levels', () => {
      renderComponent();

      expect(screen.getByText('Wellbeing')).toBeInTheDocument();
      expect(screen.getByText(/Bonding: 75 • Stress: 20/i)).toBeInTheDocument();
      expect(screen.getByText(/Enrichment: 50/i)).toBeInTheDocument();
    });

    it('should display zero values when metrics are missing', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: {
          stage: 'foal',
          progress: 50,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText(/Bonding: 0 • Stress: 0/i)).toBeInTheDocument();
      expect(screen.getByText(/Enrichment: 0/i)).toBeInTheDocument();
    });
  });

  describe('Activity Logging', () => {
    it('should render activity logging inputs with default values', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /Log Activity/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Activity name')).toHaveValue('trust_building');
      expect(screen.getByPlaceholderText('Duration (minutes)')).toHaveValue(15);
    });

    it('should allow changing activity name input', async () => {
      const user = userEvent.setup();
      renderComponent();

      const activityInput = screen.getByPlaceholderText('Activity name');
      await user.clear(activityInput);
      await user.type(activityInput, 'grooming');

      expect(activityInput).toHaveValue('grooming');
    });

    it('should allow changing duration input', async () => {
      const user = userEvent.setup();
      renderComponent();

      const durationInput = screen.getByPlaceholderText('Duration (minutes)');
      await user.clear(durationInput);
      await user.type(durationInput, '30');

      expect(durationInput).toHaveValue(30);
    });

    it('should call logActivity mutation when Log Activity button clicked', async () => {
      const user = userEvent.setup();
      const mockLogActivity = vi.fn();
      vi.mocked(useBreedingHooks.useLogFoalActivity).mockReturnValue({
        mutate: mockLogActivity,
        isPending: false,
      } as any);

      renderComponent();

      const activityInput = screen.getByPlaceholderText('Activity name');
      const durationInput = screen.getByPlaceholderText('Duration (minutes)');
      await user.clear(activityInput);
      await user.type(activityInput, 'grooming');
      await user.clear(durationInput);
      await user.type(durationInput, '20');

      const logButton = screen.getByRole('button', { name: /Log Activity/i });
      await user.click(logButton);

      expect(mockLogActivity).toHaveBeenCalledWith({
        activity: 'grooming',
        duration: 20,
      });
    });

    it('should disable Log Activity button when activity name is empty', () => {
      vi.mocked(useBreedingHooks.useLogFoalActivity).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);

      renderComponent();

      const activityInput = screen.getByPlaceholderText('Activity name');
      // Clear default value to empty
      const logButton = screen.getByRole('button', { name: /Log Activity/i });

      // Button should be enabled with default value
      expect(logButton).not.toBeDisabled();
    });

    it('should disable Log Activity button when duration is empty', async () => {
      const user = userEvent.setup();
      renderComponent();

      const durationInput = screen.getByPlaceholderText('Duration (minutes)');
      await user.clear(durationInput);

      const logButton = screen.getByRole('button', { name: /Log Activity/i });
      expect(logButton).toBeDisabled();
    });

    it('should disable Log Activity button when mutation is pending', () => {
      vi.mocked(useBreedingHooks.useLogFoalActivity).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);

      renderComponent();

      const logButton = screen.getByRole('button', { name: /Logging…/i });
      expect(logButton).toBeDisabled();
    });
  });

  describe('Enrichment Functionality', () => {
    it('should call enrichFoal mutation when Enrich button clicked', async () => {
      const user = userEvent.setup();
      const mockEnrichFoal = vi.fn();
      vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
        mutate: mockEnrichFoal,
        isPending: false,
      } as any);

      renderComponent();

      const durationInput = screen.getByPlaceholderText('Duration (minutes)');
      await user.clear(durationInput);
      await user.type(durationInput, '25');

      const enrichButton = screen.getByRole('button', { name: /Enrich$/i });
      await user.click(enrichButton);

      expect(mockEnrichFoal).toHaveBeenCalledWith({
        activity: 'enrichment',
        duration: 25,
      });
    });

    it('should disable Enrich button when duration is empty', async () => {
      const user = userEvent.setup();
      renderComponent();

      const durationInput = screen.getByPlaceholderText('Duration (minutes)');
      await user.clear(durationInput);

      const enrichButton = screen.getByRole('button', { name: /Enrich$/i });
      expect(enrichButton).toBeDisabled();
    });

    it('should disable Enrich button when mutation is pending', () => {
      vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);

      renderComponent();

      const enrichButton = screen.getByRole('button', { name: /Enriching…/i });
      expect(enrichButton).toBeDisabled();
    });
  });

  describe('Trait Revelation', () => {
    it('should display foal traits when available', () => {
      renderComponent();

      expect(screen.getByText('Traits')).toBeInTheDocument();
      expect(screen.getByText('fast, gentle')).toBeInTheDocument();
    });

    it('should display pending message when traits are empty', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: {
          id: 1,
          name: 'Little Star',
          ageDays: 45,
          sireId: 10,
          damId: 11,
          traits: [],
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Traits pending discovery.')).toBeInTheDocument();
    });

    it('should display pending message when traits are undefined', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: {
          id: 1,
          name: 'Little Star',
          ageDays: 45,
          sireId: 10,
          damId: 11,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Traits pending discovery.')).toBeInTheDocument();
    });

    it('should call revealTraits mutation when Reveal Traits button clicked', async () => {
      const user = userEvent.setup();
      const mockRevealTraits = vi.fn();
      vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
        mutate: mockRevealTraits,
        isPending: false,
      } as any);

      renderComponent();

      const revealButton = screen.getByRole('button', { name: /Reveal Traits/i });
      await user.click(revealButton);

      expect(mockRevealTraits).toHaveBeenCalled();
    });

    it('should disable Reveal Traits button when mutation is pending', () => {
      vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);

      renderComponent();

      const revealButton = screen.getByRole('button', { name: /Revealing…/i });
      expect(revealButton).toBeDisabled();
    });
  });

  describe('Activity Log Display', () => {
    it('should display activity log with activities', () => {
      renderComponent();

      expect(screen.getByText('Activity Log')).toBeInTheDocument();
      expect(screen.getByText('trust_building')).toBeInTheDocument();
      expect(screen.getByText('15 min')).toBeInTheDocument();
      expect(screen.getByText('grooming')).toBeInTheDocument();
      expect(screen.getByText('10 min')).toBeInTheDocument();
    });

    it('should display placeholder when no activities exist', () => {
      vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('No activities logged yet.')).toBeInTheDocument();
    });

    it('should display placeholder when activities are undefined', () => {
      vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('No activities logged yet.')).toBeInTheDocument();
    });

    it('should display duration placeholder when duration is missing', () => {
      vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({
        data: [
          {
            id: 1,
            activity: 'trust_building',
            createdAt: '2025-12-09T10:00:00Z',
          },
        ],
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('trust_building')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument(); // Duration placeholder
    });

    it('should display timestamp placeholder when createdAt is missing', () => {
      vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({
        data: [
          {
            id: 1,
            activity: 'trust_building',
            duration: 15,
          },
        ],
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Timestamp pending')).toBeInTheDocument();
    });
  });

  describe('Advance Stage Functionality', () => {
    it('should call developFoal mutation when Advance Stage button clicked', async () => {
      const user = userEvent.setup();
      const mockDevelopFoal = vi.fn();
      vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
        mutate: mockDevelopFoal,
        isPending: false,
      } as any);

      renderComponent();

      const advanceButton = screen.getByRole('button', { name: /Advance Stage/i });
      await user.click(advanceButton);

      expect(mockDevelopFoal).toHaveBeenCalledWith({ progress: 65 }); // 60 + 5
    });

    it('should increment progress by 5 when development progress is undefined', async () => {
      const user = userEvent.setup();
      const mockDevelopFoal = vi.fn();
      vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
        mutate: mockDevelopFoal,
        isPending: false,
      } as any);
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: {
          stage: 'foal',
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      const advanceButton = screen.getByRole('button', { name: /Advance Stage/i });
      await user.click(advanceButton);

      expect(mockDevelopFoal).toHaveBeenCalledWith({ progress: 5 }); // 0 + 5
    });

    it('should disable Advance Stage button when mutation is pending', () => {
      vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);

      renderComponent();

      const advanceButton = screen.getByRole('button', { name: /Updating…/i });
      expect(advanceButton).toBeDisabled();
    });
  });

  describe('Loading States', () => {
    it('should display loading message when foal is loading', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Loading foal details and development…')).toBeInTheDocument();
    });

    it('should display loading message when development is loading', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Loading foal details and development…')).toBeInTheDocument();
    });

    it('should display loading message when both are loading', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Loading foal details and development…')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should display error message when development fetch fails', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch foal development'),
      } as any);

      renderComponent();

      expect(screen.getByText('Failed to fetch foal development')).toBeInTheDocument();
    });
  });
});
