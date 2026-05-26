/**
 * FoalDevelopmentTracker Tests (Epic 29-2 Celestial Night refactor)
 *
 * The component was rewritten to delegate display to a child
 * `<DevelopmentTracker />` (age-stage timeline + milestone cards + activity
 * cards). The old free-text "Activity name" / "Duration" inputs are gone —
 * users now click an activity card, which surfaces a "Confirm Activity"
 * confirmation card that calls logActivity with the activity's id and
 * cooldownHours when confirmed.
 *
 * Earlier tests asserted features that no longer exist (literal "Foal
 * Development" header, "Bonding"/"Stress"/"Enrichment" wellbeing labels,
 * free-text activity inputs, "Activity Log" heading visible by default,
 * "trust_building" rendered as a value in an input, etc.). Tests below
 * preserve original BEHAVIORAL intents that map to the new shape:
 *  - rendering, loading state, error state
 *  - activity selection → confirmation card → logActivity mutation
 *  - reveal traits / advance stage / enrich mutations
 *  - activity log collapsible (visible after expand)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FoalDevelopmentTracker from '../FoalDevelopmentTracker';
import * as useBreedingHooks from '@/hooks/api/useBreeding';

// Mock all breeding hooks
vi.mock('@/hooks/api/useBreeding');

// Helper: pick a dateOfBirth that puts the foal in the "weanling" stage
// (4-26 weeks old). 60 days = ~8.5 weeks → weanling.
const weanlingDob = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

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
        dateOfBirth: weanlingDob,
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
        // Equoria-g89vy: enrichment activities for the foal's derived day,
        // supplied by the backend. Drives the Enrich activity picker.
        availableEnrichmentActivities: [
          { type: 'gentle_touch', name: 'Gentle Touch' },
          { type: 'soft_voice', name: 'Soft Voice' },
        ],
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
      isSuccess: false,
      data: null,
    } as any);

    vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useBreedingHooks.useGraduateFoal).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: null,
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
    it('renders the DevelopmentTracker child with the foal name', () => {
      renderComponent();
      expect(screen.getByTestId('development-tracker')).toBeInTheDocument();
      expect(screen.getByText(/Little Star/)).toBeInTheDocument();
    });

    it('renders Foal #N when name is missing', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: {
          id: 7,
          dateOfBirth: weanlingDob,
          sireId: 10,
          damId: 11,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent(7);
      expect(screen.getByText(/Foal #7/)).toBeInTheDocument();
    });
  });

  describe('Development Stage Display', () => {
    it('displays stage and progress in the stat cards', () => {
      renderComponent();
      expect(screen.getByText('Stage')).toBeInTheDocument();
      // Stage card shows the lowercase value (capitalize CSS only)
      expect(screen.getByText('weanling')).toBeInTheDocument();
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('shows fallback values when stage / progress are missing', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: {
          bonding: 60,
          stress: 10,
          enrichmentLevel: 40,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Stat Cards', () => {
    it('renders Stress and Enrichment stat cards', () => {
      renderComponent();
      expect(screen.getByText('Stress')).toBeInTheDocument();
      expect(screen.getByText('Enrichment')).toBeInTheDocument();
    });
  });

  describe('Activity Selection Flow', () => {
    it('shows the confirmation card after clicking an activity', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Weanling stage — first activity is "Desensitization". DevelopmentTracker
      // renders both a DesktopTimeline and a MobileCard at all viewports, so
      // the same activity appears twice. Click the first one.
      const activityButtons = screen.getAllByRole('button', { name: /desensitization/i });
      await user.click(activityButtons[0]);

      expect(screen.getByText(/confirm activity/i)).toBeInTheDocument();
      // Confirmation card lists the chosen activity's label + description
      expect(screen.getAllByText(/desensitization/i).length).toBeGreaterThan(0);
    });

    it('calls logActivity mutation with the activity id when Confirm is clicked', async () => {
      const user = userEvent.setup();
      const mockLogActivity = vi.fn();
      vi.mocked(useBreedingHooks.useLogFoalActivity).mockReturnValue({
        mutate: mockLogActivity,
        isPending: false,
      } as any);

      renderComponent();

      // DevelopmentTracker renders both desktop + mobile views — duplicate buttons.
      const activityButton = screen.getAllByRole('button', { name: /desensitization/i })[0];
      await user.click(activityButton);

      // Confirm the pending activity
      const confirmButton = screen.getByRole('button', { name: /^confirm$/i });
      await user.click(confirmButton);

      // Component passes { activity: id, duration: cooldownHours } to mutate
      expect(mockLogActivity).toHaveBeenCalledWith({
        activity: 'desensitization',
        duration: 24,
      });
    });

    it('Cancel clears the pending activity', async () => {
      const user = userEvent.setup();
      renderComponent();

      // DevelopmentTracker renders both desktop + mobile views — duplicate buttons.
      const activityButton = screen.getAllByRole('button', { name: /desensitization/i })[0];
      await user.click(activityButton);

      expect(screen.getByText(/confirm activity/i)).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/confirm activity/i)).not.toBeInTheDocument();
    });
  });

  describe('Enrich Functionality', () => {
    it('opens an activity picker and calls enrichFoal with a real activity type', async () => {
      const user = userEvent.setup();
      const mockEnrichFoal = vi.fn();
      vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
        mutate: mockEnrichFoal,
        isPending: false,
      } as any);

      renderComponent();

      // Clicking Enrich reveals the day's available enrichment activities.
      const enrichButton = screen.getByRole('button', { name: /^enrich$/i });
      await user.click(enrichButton);

      // Pick a real activity from the picker.
      const choice = await screen.findByRole('button', { name: /gentle touch/i });
      await user.click(choice);

      // The backend derives the day; the client sends only the activity type.
      expect(mockEnrichFoal).toHaveBeenCalledWith({ activity: 'gentle_touch' });
    });

    it('disables Enrich when no enrichment activities are available (window closed)', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: {
          stage: 'yearling',
          progress: 100,
          availableEnrichmentActivities: [],
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();
      const enrichButton = screen.getByRole('button', { name: /^enrich$/i });
      expect(enrichButton).toBeDisabled();
    });

    it('disables Enrich button when mutation is pending', () => {
      vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);

      renderComponent();
      const enrichButton = screen.getByRole('button', { name: /enriching…/i });
      expect(enrichButton).toBeDisabled();
    });
  });

  describe('Trait Revelation', () => {
    it('displays foal traits when available', () => {
      renderComponent();
      // Each trait is rendered as a separate pill
      expect(screen.getByText('fast')).toBeInTheDocument();
      expect(screen.getByText('gentle')).toBeInTheDocument();
      expect(screen.getByText('Discovered Traits')).toBeInTheDocument();
    });

    it('omits traits section when traits are empty', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: {
          id: 1,
          name: 'Little Star',
          dateOfBirth: weanlingDob,
          sireId: 10,
          damId: 11,
          traits: [],
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();
      expect(screen.queryByText('Discovered Traits')).not.toBeInTheDocument();
    });

    it('calls revealTraits mutation when Reveal Traits button is clicked', async () => {
      const user = userEvent.setup();
      const mockRevealTraits = vi.fn();
      vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
        mutate: mockRevealTraits,
        isPending: false,
        isSuccess: false,
        data: null,
      } as any);

      renderComponent();

      const revealButton = screen.getByRole('button', { name: /reveal traits/i });
      await user.click(revealButton);

      expect(mockRevealTraits).toHaveBeenCalled();
    });

    it('disables Reveal Traits button when mutation is pending', () => {
      vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isSuccess: false,
        data: null,
      } as any);

      renderComponent();
      const revealButton = screen.getByRole('button', { name: /revealing…/i });
      expect(revealButton).toBeDisabled();
    });
  });

  describe('Activity Log Display', () => {
    it('renders the collapsible activity log header', () => {
      renderComponent();
      expect(screen.getByText(/activity log/i)).toBeInTheDocument();
    });

    it('shows logged activities after expanding the log', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click the "Activity Log (N)" toggle to expand
      const logToggle = screen.getByRole('button', { name: /activity log/i });
      await user.click(logToggle);

      // Activity items become visible
      expect(screen.getByText('trust_building')).toBeInTheDocument();
      expect(screen.getByText('grooming')).toBeInTheDocument();
      expect(screen.getByText('15 min')).toBeInTheDocument();
      expect(screen.getByText('10 min')).toBeInTheDocument();
    });

    it('omits the activity log when no activities exist', () => {
      vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      renderComponent();
      expect(screen.queryByText(/activity log/i)).not.toBeInTheDocument();
    });
  });

  describe('Advance Stage Functionality', () => {
    it('calls developFoal with progress + 5', async () => {
      const user = userEvent.setup();
      const mockDevelopFoal = vi.fn();
      vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
        mutate: mockDevelopFoal,
        isPending: false,
      } as any);

      renderComponent();

      const advanceButton = screen.getByRole('button', { name: /advance stage/i });
      await user.click(advanceButton);

      expect(mockDevelopFoal).toHaveBeenCalledWith({ progress: 65 });
    });

    it('falls back to 0 + 5 when progress is undefined', async () => {
      const user = userEvent.setup();
      const mockDevelopFoal = vi.fn();
      vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
        mutate: mockDevelopFoal,
        isPending: false,
      } as any);
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: { stage: 'foal' },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      const advanceButton = screen.getByRole('button', { name: /advance stage/i });
      await user.click(advanceButton);

      expect(mockDevelopFoal).toHaveBeenCalledWith({ progress: 5 });
    });

    it('disables Advance Stage button when mutation is pending', () => {
      vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);

      renderComponent();
      const advanceButton = screen.getByRole('button', { name: /updating…/i });
      expect(advanceButton).toBeDisabled();
    });
  });

  describe('Loading States', () => {
    it('shows the loading indicator when foal is loading', () => {
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderComponent();
      expect(screen.getByText(/loading foal details/i)).toBeInTheDocument();
    });

    it('shows the loading indicator when development is loading', () => {
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderComponent();
      expect(screen.getByText(/loading foal details/i)).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('displays the development-fetch error message', () => {
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
