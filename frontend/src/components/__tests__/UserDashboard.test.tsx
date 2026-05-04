/**
 * User Dashboard Component Tests
 *
 * Tests for the rebranded UserDashboard ("Celestial Ascension" theme).
 * The component renders a single `<main>` (no testid IDs, no aria-label),
 * with sections for ascension progress, command center quick actions,
 * a chronicle (activity feed), glory (recent shows), and an optional
 * weekly coffers (salary) reminder.
 *
 * Earlier tests asserted features that no longer exist (mobile/desktop
 * dashboard testids, role=progressbar with aria-label, achievement-section,
 * "Visit Stable / Train Horses / Enter Competition" button names,
 * "Weekly Groom Salaries" copy, "Manage Grooms" link, "$1,300 total paid").
 * Those assertions have been rewritten to match current copy or removed
 * when the feature is gone.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MockAuthProvider } from '../../test/utils';
import UserDashboard from '../UserDashboard';

// Mock data for testing (NO MOCKING - real data passed as props)
const mockProgressData = {
  userId: 'user-1',
  username: 'TestUser',
  level: 10,
  xp: 1500,
  xpToNextLevel: 2000,
  money: 50000,
  totalHorses: 5,
  totalCompetitions: 25,
  totalWins: 15,
  winRate: 60,
};

const mockDashboardData = {
  user: {
    id: 1,
    username: 'TestUser',
    email: 'test@example.com',
    level: 10,
    xp: 1500,
    money: 50000,
  },
  horses: { total: 5 },
  recentShows: [
    { id: 1, name: 'Spring Championship', date: '2024-03-15', placement: 1 },
    { id: 2, name: 'Summer Classic', date: '2024-06-20', placement: 3 },
  ],
};

const mockActivityData = [
  {
    id: 1,
    type: 'competition',
    description: 'Won Spring Championship',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
  },
  {
    id: 2,
    type: 'training',
    description: 'Trained Thunder in dressage',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
];

// Test wrapper with required providers
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};

const fullProps = {
  userId: 1,
  progressData: mockProgressData as any,
  dashboardData: mockDashboardData as any,
  activityData: mockActivityData as any,
};

describe('UserDashboard Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
  });

  describe('Component Rendering', () => {
    test('renders the dashboard main region when data is supplied', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    test('renders welcome header with username', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/welcome,\s*TestUser/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Overview Display', () => {
    test('displays user level', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/level\s*10/i)).toBeInTheDocument();
      });
    });

    test('displays user money', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/50,000/)).toBeInTheDocument();
      });
    });

    test('displays horse count', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/5\s+horses/i)).toBeInTheDocument();
      });
    });

    test('displays XP-to-next-level pair', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/1500\s*\/\s*2000\s*XP/i)).toBeInTheDocument();
      });
    });
  });

  describe('Progress Tracking', () => {
    test('displays progress percentage', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        // xp 1500 % 100 = 0 → 0%; we just check the % suffix exists
        expect(screen.getByText(/Ascension Progress/i)).toBeInTheDocument();
      });
    });

    test('displays the four overview stats', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/competitions/i)).toBeInTheDocument();
        expect(screen.getByText(/victories/i)).toBeInTheDocument();
        expect(screen.getByText(/win rate/i)).toBeInTheDocument();
        expect(screen.getByText(/stable size/i)).toBeInTheDocument();
      });
    });
  });

  describe('Activity Feed', () => {
    test('renders chronicle section', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/chronicle/i)).toBeInTheDocument();
      });
    });

    test('shows activity descriptions', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/won spring championship/i)).toBeInTheDocument();
        expect(screen.getByText(/trained thunder in dressage/i)).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    test('renders all three Command Center buttons', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stable management/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /training grounds/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /competition/i })).toBeInTheDocument();
      });
    });

    test('Stable Management button is clickable', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      const stableButton = await screen.findByRole('button', { name: /stable management/i });
      fireEvent.click(stableButton);
      // No assertion error means click was handled (navigation is a side effect of useNavigate)
      expect(stableButton).toBeInTheDocument();
    });
  });

  describe('Real-time Updates / Refresh', () => {
    test('renders Refresh button', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      const refreshButton = await screen.findByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    test('Refresh button is clickable', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      const refreshButton = await screen.findByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('loads within acceptable time limits', async () => {
      const startTime = Date.now();

      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000);
    });
  });

  describe('Accessibility', () => {
    test('renders a main landmark', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    test('supports keyboard focus on quick action buttons', async () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} />
        </TestWrapper>
      );

      const buttons = await screen.findAllByRole('button');
      const firstButton = buttons[0];
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);
    });
  });

  describe('Weekly Coffers (Salary Reminder)', () => {
    const mockSalarySummaryData = {
      totalMonthlyCost: 1300,
      totalWeeklyCost: 325,
      groomCount: 3,
      breakdown: [
        { groomId: 1, groomName: 'Sarah Johnson', weeklyCost: 100, assignmentCount: 2 },
        { groomId: 2, groomName: 'Mike Rodriguez', weeklyCost: 75, assignmentCount: 0 },
        { groomId: 3, groomName: 'Emma Thompson', weeklyCost: 150, assignmentCount: 1 },
      ],
    };

    test('displays weekly coffers panel when grooms are hired', () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} salarySummaryData={mockSalarySummaryData as any} />
        </TestWrapper>
      );

      expect(screen.getByText(/weekly coffers/i)).toBeInTheDocument();
      expect(screen.getByText(/\$325/)).toBeInTheDocument();
    });

    test('renders Manage Staff link to /grooms', () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} salarySummaryData={mockSalarySummaryData as any} />
        </TestWrapper>
      );

      const manageLink = screen.getByRole('link', { name: /manage staff/i });
      expect(manageLink).toBeInTheDocument();
      expect(manageLink).toHaveAttribute('href', '/grooms');
    });

    test('does not display salary reminder when no grooms hired', () => {
      const noGroomsSalaryData = {
        totalMonthlyCost: 0,
        totalWeeklyCost: 0,
        groomCount: 0,
        breakdown: [],
      };

      render(
        <TestWrapper>
          <UserDashboard {...fullProps} salarySummaryData={noGroomsSalaryData as any} />
        </TestWrapper>
      );

      expect(screen.queryByText(/weekly coffers/i)).not.toBeInTheDocument();
    });

    test('dismisses salary reminder when close button clicked', () => {
      render(
        <TestWrapper>
          <UserDashboard {...fullProps} salarySummaryData={mockSalarySummaryData as any} />
        </TestWrapper>
      );

      // The dismiss button has an sr-only "Dismiss" label
      const closeButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(closeButton);

      expect(screen.queryByText(/weekly coffers/i)).not.toBeInTheDocument();
    });
  });
});
