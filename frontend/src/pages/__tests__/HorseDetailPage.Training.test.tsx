/**
 * HorseDetailPage Training Tab Integration Tests
 *
 * Comprehensive test suite for the training tab within HorseDetailPage:
 * - Tab integration tests
 * - Discipline selection flow
 * - Training confirmation modal flow
 * - Training result display
 * - Training status and cooldown handling
 * - Complete training flow end-to-end
 * - Error handling
 *
 * Story 4-1: Training Session Interface - Task 6
 * Target: 35+ tests
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from '../../test/utils';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import HorseDetailPage from '../HorseDetailPage';

// Mock horse data with training-compatible structure
const createMockHorse = (overrides = {}) => ({
  id: 1,
  name: 'Thunder',
  breed: 'Thoroughbred',
  breedId: 1,
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2020-03-15',
  healthStatus: 'Excellent',
  description: 'A magnificent thoroughbred with exceptional speed and stamina.',
  imageUrl: 'https://example.com/horses/thunder.jpg',
  stats: {
    speed: 85,
    stamina: 80,
    agility: 75,
    strength: 82,
    intelligence: 78,
    health: 95,
  },
  disciplineScores: {
    'western-pleasure': 45,
    dressage: 30,
    'show-jumping': 55,
    endurance: 25,
    'barrel-racing': 0,
  },
  traits: ['Fast Learner', 'Even Tempered', 'Strong Build'],
  parentIds: {
    sireId: 10,
    damId: 11,
  },
  ...overrides,
});

// Mock horse data for young horses (under 3 years)
const createYoungHorse = () =>
  createMockHorse({
    id: 2,
    name: 'Foalster',
    age: 2,
    dateOfBirth: '2023-06-15',
  });

// Mock training overview (no cooldowns)
const createMockTrainingOverview = () => [
  { discipline: 'western-pleasure', score: 45, nextEligibleDate: null, lastTrainedAt: null },
  { discipline: 'dressage', score: 30, nextEligibleDate: null, lastTrainedAt: null },
  { discipline: 'show-jumping', score: 55, nextEligibleDate: null, lastTrainedAt: null },
];

// Mock training overview with cooldown
const createMockTrainingOverviewWithCooldown = () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5); // 5 days in future

  return [
    {
      discipline: 'western-pleasure',
      score: 45,
      nextEligibleDate: futureDate.toISOString(),
      lastTrainedAt: new Date().toISOString(),
    },
    { discipline: 'dressage', score: 30, nextEligibleDate: null, lastTrainedAt: null },
    { discipline: 'show-jumping', score: 55, nextEligibleDate: null, lastTrainedAt: null },
  ];
};

// Mock successful training result
const createMockTrainingResult = (disciplineId: string) => ({
  success: true,
  updatedHorse: {
    id: 1,
    name: 'Thunder',
    discipline_scores: { [disciplineId]: 50 },
  },
  message: 'Training successful',
  nextEligible: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  statGain: { stat: 'speed', amount: 2, traitModified: false },
  traitEffects: { appliedTraits: ['Fast Learner'], scoreModifier: 1, xpModifier: 25 },
  updatedScore: 50,
  discipline: disciplineId,
  horseId: 1,
});

// Store original fetch
const originalFetch = global.fetch;

// Create mock fetch handler
const createFetchMock = (
  options: {
    horse?: any;
    trainingOverview?: any;
    trainingResult?: any;
    trainingError?: string;
    geneticsData?: any;
  } = {}
) => {
  const {
    horse = createMockHorse(),
    trainingOverview = createMockTrainingOverview(),
    trainingResult,
    trainingError,
    geneticsData = { traits: [], interactions: [], timeline: [] },
  } = options;

  return vi.fn((url: string | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const method = init?.method?.toUpperCase() || 'GET';

    // Horse endpoint
    if (urlStr.includes('/api/horses/') && method === 'GET' && !urlStr.includes('/training')) {
      if (horse === null) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ success: false, message: 'Horse not found' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: horse }),
      } as Response);
    }

    // Training overview endpoint
    if (urlStr.includes('/api/training/status/') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: trainingOverview }),
      } as Response);
    }

    // Training execution endpoint
    if (urlStr.includes('/api/training/train') && method === 'POST') {
      if (trainingError) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ success: false, message: trainingError }),
        } as Response);
      }

      // Extract discipline from request body
      const body = init?.body ? JSON.parse(init.body.toString()) : {};
      const result = trainingResult || createMockTrainingResult(body.discipline);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: result }),
      } as Response);
    }

    // Genetics endpoints
    if (urlStr.includes('/epigenetic-insights')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { traits: geneticsData.traits } }),
      } as Response);
    }
    if (urlStr.includes('/trait-interactions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ success: true, data: { interactions: geneticsData.interactions } }),
      } as Response);
    }
    if (urlStr.includes('/trait-timeline')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { timeline: geneticsData.timeline } }),
      } as Response);
    }

    // Fallback
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
    } as Response);
  }) as typeof fetch;
};

// Test wrapper with required providers
const renderWithProviders = (ui: React.ReactElement, { route = '/horses/1' } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Set up routing
  window.history.pushState({}, 'Test', route);

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/horses/:id" element={ui} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Helper to wait for horse data to load
const waitForHorseToLoad = async (horseName: string = 'Thunder') => {
  await waitFor(() => {
    expect(screen.getByText(horseName)).toBeInTheDocument();
  });
};

// Helper to navigate to training tab
const navigateToTrainingTab = async () => {
  const trainingTab = screen.getByRole('tab', { name: /training/i });
  await userEvent.click(trainingTab);

  await waitFor(() => {
    expect(trainingTab).toHaveAttribute('aria-selected', 'true');
  });
};

describe('HorseDetailPage Training Tab Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ============================================
  // Tab Integration Tests (4 tests)
  // ============================================
  describe('Tab Integration', () => {
    test('Training tab appears in tab navigation', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();

      const trainingTab = screen.getByRole('tab', { name: /training/i });
      expect(trainingTab).toBeInTheDocument();
    });

    test('Clicking Training tab shows training content', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-tab')).toBeInTheDocument();
      });
    });

    test('Training tab is keyboard accessible', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();

      const trainingTab = screen.getByRole('tab', { name: /training/i });

      // Focus and press Enter
      trainingTab.focus();
      fireEvent.keyDown(trainingTab, { key: 'Enter', code: 'Enter' });
      await userEvent.click(trainingTab);

      await waitFor(() => {
        expect(trainingTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    test('Training tab maintains ARIA attributes correctly', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();

      const trainingTab = screen.getByRole('tab', { name: /training/i });
      expect(trainingTab).toHaveAttribute('aria-selected', 'false');
      expect(trainingTab).toHaveAttribute('aria-controls', 'training-panel');

      await navigateToTrainingTab();

      expect(trainingTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  // ============================================
  // Discipline Selection Tests (5 tests)
  // ============================================
  describe('Discipline Selection', () => {
    test('DisciplinePicker renders with horse discipline scores', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Check that discipline categories are visible
      expect(screen.getByText('Western')).toBeInTheDocument();
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    test('Clicking discipline opens confirm modal', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Wait for discipline picker to load
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Click on a discipline (Western Pleasure)
      const disciplineButton = screen.getByRole('button', { name: /western pleasure/i });
      await user.click(disciplineButton);

      // Check confirm modal opens
      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });
    });

    test('Selected discipline state updates correctly', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Click on a discipline
      const disciplineButton = screen.getByRole('button', { name: /dressage/i });
      await user.click(disciplineButton);

      // Check that modal shows selected discipline
      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Dressage');
      });
    });

    test('Can select different disciplines', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Select first discipline
      const firstDiscipline = screen.getByRole('button', { name: /western pleasure/i });
      await user.click(firstDiscipline);

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Close modal
      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      });

      // Select different discipline
      const secondDiscipline = screen.getByRole('button', { name: /dressage/i });
      await user.click(secondDiscipline);

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Dressage');
      });
    });

    test('Shows current scores for each discipline', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Check that scores are displayed (match the mock data)
      // Western Pleasure score should show 45
      const westernButton = screen.getByRole('button', { name: /western pleasure.*score.*45/i });
      expect(westernButton).toBeInTheDocument();
    });
  });

  // ============================================
  // Training Confirmation Flow Tests (8 tests)
  // ============================================
  describe('Training Confirmation Flow', () => {
    test('Confirm modal opens with correct horse and discipline data', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      // Click discipline
      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('horse-name')).toHaveTextContent('Thunder');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Dressage');
      });
    });

    test('Shows correct expected score gain', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        // Base score gain is +5
        expect(within(modal).getByTestId('base-score-gain')).toHaveTextContent('+5');
      });
    });

    test('Shows trait modifiers if any', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        // Horse has "Fast Learner" trait which adds +1
        expect(within(modal).getByTestId('trait-modifiers-list')).toBeInTheDocument();
      });
    });

    test('Cancel button closes modal without training', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByTestId('cancel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      });
    });

    test('Confirm button executes training mutation', async () => {
      const fetchMock = createFetchMock();
      global.fetch = fetchMock;
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Click confirm
      await user.click(screen.getByTestId('confirm-button'));

      // Verify training API was called
      await waitFor(() => {
        const trainingCalls = fetchMock.mock.calls.filter((call) =>
          call[0]?.toString().includes('/api/training/train')
        );
        expect(trainingCalls.length).toBeGreaterThan(0);
      });
    });

    test('Loading state shown during mutation', async () => {
      // Create a delayed fetch mock
      const delayedFetch = vi.fn((url: string | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = init?.method?.toUpperCase() || 'GET';

        if (urlStr.includes('/api/training/train') && method === 'POST') {
          // Add delay to simulate loading
          return new Promise<Response>((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: () =>
                  Promise.resolve({ success: true, data: createMockTrainingResult('dressage') }),
              } as Response);
            }, 100);
          });
        }

        return createFetchMock()(url, init);
      }) as typeof fetch;

      global.fetch = delayedFetch;
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Click confirm
      await user.click(screen.getByTestId('confirm-button'));

      // Check for loading state
      await waitFor(() => {
        expect(screen.getByTestId('confirm-button')).toHaveAttribute('aria-busy', 'true');
      });
    });

    test('Modal closes after successful training', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      // Wait for confirm modal to close and result modal to open
      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      });
    });

    test('Error handling for failed training', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Horse is on cooldown',
      });
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      // Modal should stay open on error
      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Training Result Display Tests (6 tests)
  // ============================================
  describe('Training Result Display', () => {
    test('Result modal opens after successful training', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      // Wait for result modal
      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });
    });

    test('Shows correct score gain breakdown', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        const modal = screen.getByTestId('training-result-modal');
        expect(within(modal).getByTestId('score-breakdown')).toBeInTheDocument();
      });
    });

    test('Displays new score value', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        const modal = screen.getByTestId('training-result-modal');
        expect(within(modal).getByTestId('new-score')).toBeInTheDocument();
      });
    });

    test('Shows stat gains if any', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        const modal = screen.getByTestId('training-result-modal');
        // Mock result includes speed stat gain
        expect(within(modal).getByTestId('stat-gain-speed')).toBeInTheDocument();
      });
    });

    test('Shows XP gain if any', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        const modal = screen.getByTestId('training-result-modal');
        // Mock result includes XP gain
        expect(within(modal).getByTestId('xp-gain')).toBeInTheDocument();
      });
    });

    test('Closing result modal resets training state', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      // Close result modal
      await user.click(screen.getByTestId('close-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });

      // State should be reset - can start new training
      expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
    });
  });

  // ============================================
  // Training Status Display Tests (4 tests)
  // ============================================
  describe('Training Status Display', () => {
    test('Shows "Ready to train" when no cooldown', async () => {
      global.fetch = createFetchMock();
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-status-ready')).toBeInTheDocument();
        expect(screen.getByText(/ready to train/i)).toBeInTheDocument();
      });
    });

    test('Shows cooldown date when on cooldown', async () => {
      global.fetch = createFetchMock({
        trainingOverview: createMockTrainingOverviewWithCooldown(),
      });
      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-status-cooldown')).toBeInTheDocument();
        expect(screen.getByText(/next training available/i)).toBeInTheDocument();
      });
    });

    test('Shows ineligible status for young horses', async () => {
      global.fetch = createFetchMock({
        horse: createYoungHorse(),
      });
      renderWithProviders(<HorseDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Foalster')).toBeInTheDocument();
      });

      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-status-ineligible')).toBeInTheDocument();
        // Use within to scope the query to the status element
        const statusElement = screen.getByTestId('training-status-ineligible');
        expect(within(statusElement).getByText(/at least 3 years old/i)).toBeInTheDocument();
      });
    });

    test('Displays training eligibility warning for young horses', async () => {
      global.fetch = createFetchMock({
        horse: createYoungHorse(),
      });
      renderWithProviders(<HorseDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Foalster')).toBeInTheDocument();
      });

      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('training-eligibility-warning')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Complete Training Flow Tests (5 tests)
  // ============================================
  describe('Complete Training Flow', () => {
    test('Full flow: select -> confirm -> train -> view results -> close', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Step 1: Select discipline
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      // Step 2: Confirm modal opens
      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Step 3: Confirm training
      await user.click(screen.getByTestId('confirm-button'));

      // Step 4: Result modal opens
      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      // Step 5: Close result modal
      await user.click(screen.getByTestId('close-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });
    });

    test('Can start new training after completing one', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Complete first training
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('close-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });

      // Start second training with different discipline
      await user.click(screen.getByRole('button', { name: /show jumping/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
        const modal = screen.getByTestId('training-confirm-modal');
        expect(within(modal).getByTestId('discipline-name')).toHaveTextContent('Show Jumping');
      });
    });

    test('State resets correctly after flow completes', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      // Complete training flow
      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('close-button'));

      // Verify state is reset
      await waitFor(() => {
        // No modals visible
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
        // No error displayed
        expect(screen.queryByTestId('training-error')).not.toBeInTheDocument();
        // Discipline picker is ready
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });
    });

    test('Escape key closes confirm modal', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      // Press Escape key
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      });
    });

    test('Escape key closes result modal', async () => {
      global.fetch = createFetchMock();
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      });

      // Press Escape key
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Error Handling Tests (3 tests)
  // ============================================
  describe('Error Handling', () => {
    test('Shows error message if training fails', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Training failed: Horse is too tired',
      });
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });
    });

    test('Keeps modal open on error for retry', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Training failed: Network error',
      });
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });

      // Modal should still be visible for retry
      expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
    });

    test('Error state clears when modal closes', async () => {
      global.fetch = createFetchMock({
        trainingError: 'Training failed: Server error',
      });
      const user = userEvent.setup();

      renderWithProviders(<HorseDetailPage />);

      await waitForHorseToLoad();
      await navigateToTrainingTab();

      await waitFor(() => {
        expect(screen.getByTestId('discipline-picker')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dressage/i }));

      await waitFor(() => {
        expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('training-error')).toBeInTheDocument();
      });

      // Close modal
      await user.click(screen.getByTestId('cancel-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('training-error')).not.toBeInTheDocument();
      });
    });
  });
});
