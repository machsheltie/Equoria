/**
 * BreedingPairSelection Integration Tests
 *
 * Story 6-1: Breeding Pair Selection
 * Integration tests for the complete breeding pair selection flow
 *
 * Equoria-f12xy: Migrated off the api-client module mock to MSW at the
 *   network (fetch) boundary. The page self-fetches via horsesApi.list,
 *   breedingPredictionApi.getBreedingCompatibility, the genetic/inbreeding/
 *   lineage prediction hooks, and breedingApi.breedFoal — all of which MSW
 *   intercepts at the HTTP layer (exercising the real api-client
 *   request/CSRF/unwrap path). The auth-context and useNavigate doubles are
 *   legitimate routing/context test seams, not api-client mocks, so they
 *   stay. MSW does not mock the api-client module, so the eslint
 *   no-restricted-imports api-client-mock rule stays clean.
 *
 *   This breeding flow remains covered end-to-end by a real backend +
 *   real-DB Playwright spec; this hermetic MSW suite keeps the fast
 *   per-state coverage (loading / error / disabled-button / stud-fee calc /
 *   modal gating) that an E2E run is too coarse to assert cheaply.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../../../test/msw/server';
import BreedingPairSelection from '../BreedingPairSelection';
import { RewardToastProvider } from '@/components/feedback';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Mock the auth context (legitimate context seam — not the api-client).
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock navigate (legitimate routing seam — not the api-client).
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BreedingPairSelection - Story 6-1 Integration', () => {
  let queryClient: QueryClient;

  const mockHorses = [
    {
      id: 1,
      name: 'Thunder',
      age: 5,
      ageYears: 5,
      sex: 'Stallion',
      gender: 'male',
      breed: 'Thoroughbred',
      breedName: 'Thoroughbred',
      healthStatus: 'Healthy',
      dateOfBirth: '2019-01-01',
      level: 10,
      stats: { speed: 85, stamina: 80, agility: 75, strength: 78, intelligence: 70, health: 90 },
      disciplineScores: {},
      traits: [],
    },
    {
      id: 2,
      name: 'Lightning',
      age: 4,
      ageYears: 4,
      sex: 'Mare',
      gender: 'female',
      breed: 'Arabian',
      breedName: 'Arabian',
      healthStatus: 'Healthy',
      dateOfBirth: '2020-01-01',
      level: 8,
      stats: { speed: 80, stamina: 85, agility: 82, strength: 70, intelligence: 75, health: 88 },
      disciplineScores: {},
      traits: [],
    },
    {
      id: 3,
      name: 'Storm',
      age: 2,
      ageYears: 2,
      sex: 'Colt',
      gender: 'male',
      breed: 'Quarter Horse',
      breedName: 'Quarter Horse',
      healthStatus: 'Healthy',
      dateOfBirth: '2022-01-01',
      level: 3,
      stats: { speed: 60, stamina: 65, agility: 70, strength: 68, intelligence: 55, health: 85 },
      disciplineScores: {},
      traits: [],
    },
  ];

  const mockCompatibility = {
    overallScore: 85,
    temperamentCompatibility: 88,
    traitSynergy: 90,
    geneticDiversity: 78,
    recommendations: ['Excellent match', 'Strong genetic diversity'],
  };

  /**
   * Register the happy-path MSW handlers shared by most tests. Individual
   * tests override specific endpoints (error / never-resolve / foal-shape)
   * with a later server.use(...) — last registered handler wins in MSW.
   */
  const useDefaultHandlers = () => {
    server.use(
      // horsesApi.list → GET /api/v1/horses?t=<timestamp> (path-only match)
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({ success: true, data: mockHorses })
      ),
      // breedingPredictionApi.getBreedingCompatibility → POST /api/v1/genetics/breeding-compatibility
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, () =>
        HttpResponse.json({ success: true, data: mockCompatibility })
      ),
      // breedingApi.breedFoal default → pregnancy-flow contract
      http.post(`${base}/api/v1/horses/foals`, () =>
        HttpResponse.json({
          success: true,
          message: 'Breeding successful!',
          data: {
            pregnancyStarted: true,
            damId: 2,
            sireId: 1,
            foalDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        })
      )
      // The genetic-probability / inbreeding-analysis / lineage-analysis
      // endpoints used by the Pedigree preview are covered by the global
      // handlers in src/test/msw/handlers.ts — no per-test override needed.
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
    mockNavigate.mockClear();

    useDefaultHandlers();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RewardToastProvider>
          <MemoryRouter>
            <BreedingPairSelection userId="test-user-123" />
          </MemoryRouter>
        </RewardToastProvider>
      </QueryClientProvider>
    );
  };

  describe('Initial Load', () => {
    it('should display loading state initially', () => {
      // Never-resolving horse list keeps the page in its loading state.
      server.use(http.get(`${base}/api/v1/horses`, () => new Promise(() => {})));

      renderComponent();

      expect(screen.getByText(/Loading horses/i)).toBeInTheDocument();
    });

    it('should load and display horses', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
        expect(screen.getByText('Lightning')).toBeInTheDocument();
      });
    });

    it('should display page title and description', async () => {
      renderComponent();

      // The component no longer renders its own "Breeding Pair Selection"
      // title or description — those have moved to a parent layout / route shell.
      // Verify the page-level structure still renders the two selectors.
      await waitFor(() => {
        expect(screen.getByText('Sire (Stallion)')).toBeInTheDocument();
        expect(screen.getByText('Dam (Mare)')).toBeInTheDocument();
      });
    });

    it('should display both horse selectors', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Select Sire')).toBeInTheDocument();
        expect(screen.getByText('Select Dam')).toBeInTheDocument();
      });
    });
  });

  describe('Horse Selection Flow', () => {
    it('should allow selecting a sire', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const thunderButton = screen.getByLabelText('Select Thunder');
      await user.click(thunderButton);

      await waitFor(() => {
        expect(screen.getByText('✓ Selected')).toBeInTheDocument();
      });
    });

    it('should allow selecting a dam', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Lightning')).toBeInTheDocument();
      });

      const lightningButton = screen.getByLabelText('Select Lightning');
      await user.click(lightningButton);

      await waitFor(() => {
        expect(screen.getByText('✓ Selected')).toBeInTheDocument();
      });
    });

    it('should fetch compatibility when both horses selected', async () => {
      const user = userEvent.setup();

      // Capture the compatibility request body to assert the real payload.
      let compatibilityBody: unknown = null;
      server.use(
        http.post(`${base}/api/v1/genetics/breeding-compatibility`, async ({ request }) => {
          compatibilityBody = await request.json();
          return HttpResponse.json({ success: true, data: mockCompatibility });
        })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Select sire
      const thunderButton = screen.getByLabelText('Select Thunder');
      await user.click(thunderButton);

      // Select dam
      const lightningButton = screen.getByLabelText('Select Lightning');
      await user.click(lightningButton);

      // Wait for compatibility request to fire with the correct payload.
      await waitFor(() => {
        expect(compatibilityBody).toEqual({ stallionId: 1, mareId: 2 });
      });
    });

    it('should display compatibility analysis after selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        expect(screen.getByText(/Compatibility Analysis/i)).toBeInTheDocument();
      });
    });
  });

  describe('Breeding Initiation', () => {
    it('should enable Initiate Breeding button when both horses selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
      expect(initiateButton).toBeDisabled();

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        expect(initiateButton).not.toBeDisabled();
      });
    });

    it('should open confirmation modal when Initiate Breeding clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      // The modal only renders after compatibilityData is populated
      // (selectedSire && selectedDam && compatibilityData), so wait for the
      // Compatibility Analysis section before clicking Initiate.
      await waitFor(() => {
        expect(screen.getByText(/Compatibility Analysis/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
      await user.click(initiateButton);

      await waitFor(() => {
        // Modal renders title "Confirm Breeding" AND a footer button with the
        // same text — query the heading specifically to avoid the duplicate.
        expect(screen.getByRole('heading', { name: 'Confirm Breeding' })).toBeInTheDocument();
      });
    });

    it('should call breeding API when confirmed', async () => {
      const user = userEvent.setup();

      // Legacy direct-foal response shape + capture of the breed payload.
      let breedBody: unknown = null;
      server.use(
        http.post(`${base}/api/v1/horses/foals`, async ({ request }) => {
          breedBody = await request.json();
          return HttpResponse.json({
            success: true,
            message: 'Breeding successful!',
            data: {
              foal: {
                id: 123,
                name: 'Baby Horse',
                sireId: 1,
                damId: 2,
                dateOfBirth: '2024-02-06',
                ageInDays: 0,
                sex: 'Male',
                userId: 'test-user-123',
              },
            },
          });
        })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      // The BreedingConfirmationModal is gated on compatibilityData being present.
      await waitFor(() => {
        expect(screen.getByText(/Compatibility Analysis/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Confirm Breeding' })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm Breeding/i });
      await user.click(confirmButton);

      // The real api-client sends the breed payload to the backend boundary.
      await waitFor(() => {
        expect(breedBody).toEqual({
          sireId: 1,
          damId: 2,
          userId: 'test-user-123',
        });
      });

      // Equoria-55bo.1: a successful breed is a meaningful milestone — the
      // real onSuccess path must surface a RewardToast (role=status).
      await waitFor(() => {
        const status = document.body.querySelector('[role="status"]');
        expect(status).toBeInTheDocument();
        expect(status?.textContent).toMatch(/foal is born|breeding successful/i);
      });
    });

    it('should navigate to foal page after successful breeding', async () => {
      const user = userEvent.setup();

      server.use(
        http.post(`${base}/api/v1/horses/foals`, () =>
          HttpResponse.json({
            success: true,
            message: 'Breeding successful!',
            data: {
              foal: {
                id: 123,
                name: 'Baby Horse',
                sireId: 1,
                damId: 2,
                dateOfBirth: '2024-02-06',
                ageInDays: 0,
                sex: 'Male',
                userId: 'test-user-123',
              },
            },
          })
        )
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        expect(screen.getByText(/Compatibility Analysis/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Confirm Breeding' })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm Breeding/i });
      await user.click(confirmButton);

      // Navigation is delayed by 2s normally but 3.5s on the first-ever breed
      // (cinematic). The auth mock has no settings.milestones.firstBreed flag,
      // so this counts as a first breed.
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/foals/123');
        },
        { timeout: 4500 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error when horses fail to load', async () => {
      server.use(
        http.get(`${base}/api/v1/horses`, () =>
          HttpResponse.json({ status: 'error', message: 'Network error' }, { status: 500 })
        )
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load horses/i)).toBeInTheDocument();
      });
    });

    it('should display error message when breeding fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.post(`${base}/api/v1/horses/foals`, () =>
          HttpResponse.json({ status: 'error', message: 'Insufficient funds' }, { status: 400 })
        )
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));
      await user.click(screen.getByLabelText('Select Lightning'));

      await waitFor(() => {
        expect(screen.getByText(/Compatibility Analysis/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        const initiateButton = screen.getByRole('button', { name: /Initiate Breeding/i });
        expect(initiateButton).not.toBeDisabled();
      });

      await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Confirm Breeding' })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm Breeding/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Insufficient funds/i)).toBeInTheDocument();
      });
    });
  });

  describe('Stud Fee Display', () => {
    it('should display calculated stud fee', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Stud Fee')).toBeInTheDocument();
      });

      // Default calculation for no selection should be $0
      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('should update stud fee when sire is selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Select Thunder'));

      await waitFor(() => {
        // Thunder has level 10, so fee = 500 * 10 = 5000
        expect(screen.getByText('$5,000')).toBeInTheDocument();
      });
    });
  });
});
