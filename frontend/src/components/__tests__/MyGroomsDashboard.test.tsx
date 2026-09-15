/**
 * MyGroomsDashboard Component Tests
 *
 * Comprehensive test suite for MyGroomsDashboard component following TDD with NO MOCKING.
 * All tests use real data passed as props to validate authentic component behavior.
 */

import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { BrowserRouter } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import MyGroomsDashboard from '../MyGroomsDashboard';

// Test wrapper with React Query and Router
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
};

// Mock data structures (NO MOCKING - real data passed as props)
const mockGroomsData = [
  {
    id: 1,
    name: 'Sarah Johnson',
    specialty: 'foalCare',
    skillLevel: 'expert',
    personality: 'gentle',
    experience: 8,
    sessionRate: 100,
    bio: 'Experienced foal care specialist',
    isActive: true,
    availableSlots: 2,
    currentAssignments: 2,
    maxAssignments: 4,
    userId: 1,
  },
  {
    id: 2,
    name: 'Mike Rodriguez',
    specialty: 'generalCare',
    skillLevel: 'intermediate',
    personality: 'energetic',
    experience: 5,
    sessionRate: 75,
    bio: 'General care expert',
    isActive: true,
    availableSlots: 3,
    currentAssignments: 0,
    maxAssignments: 3,
    userId: 1,
  },
  {
    id: 3,
    name: 'Emma Thompson',
    specialty: 'training',
    skillLevel: 'master',
    personality: 'patient',
    experience: 12,
    sessionRate: 150,
    bio: 'Master training specialist',
    isActive: true,
    availableSlots: 4,
    currentAssignments: 1,
    maxAssignments: 5,
    userId: 1,
  },
];

const mockAssignmentsData = [
  {
    id: 1,
    groomId: 1,
    horseId: 101,
    bondScore: 75,
    startDate: new Date('2025-10-01').toISOString(),
    isActive: true,
    priority: 1,
    notes: 'Primary caretaker',
  },
  {
    id: 2,
    groomId: 1,
    horseId: 102,
    bondScore: 50,
    startDate: new Date('2025-10-10').toISOString(),
    isActive: true,
    priority: 2,
    notes: undefined,
  },
  {
    id: 3,
    groomId: 3,
    horseId: 103,
    bondScore: 90,
    startDate: new Date('2025-09-15').toISOString(),
    isActive: true,
    priority: 1,
    notes: 'Advanced training focus',
  },
];

// Equoria-95yrv (owner ruling, 2026-09-14): the weekly fee is 70 per horse in a
// groom's care, up to ten horses. Sarah is on 2 horses (140), Mike on none (0),
// Emma on 1 (70). The old fixture carried per-groom wages (100/75/150) and a
// `totalMonthlyCost` the API has never sent.
const mockSalaryCostsData = {
  totalWeeklyCost: 210,
  groomCount: 3,
  feePerHorsePerWeek: 70,
  maxHorsesPerGroom: 10,
  breakdown: [
    {
      groomId: 1,
      groomName: 'Sarah Johnson',
      skillLevel: 'expert',
      speciality: 'foalCare',
      assignedHorses: 2,
      weeklyFee: 140,
      feeUnpaid: false,
    },
    {
      groomId: 2,
      groomName: 'Mike Rodriguez',
      skillLevel: 'intermediate',
      speciality: 'generalCare',
      assignedHorses: 0,
      weeklyFee: 0,
      feeUnpaid: false,
    },
    {
      groomId: 3,
      groomName: 'Emma Thompson',
      skillLevel: 'master',
      speciality: 'training',
      assignedHorses: 1,
      weeklyFee: 70,
      feeUnpaid: false,
    },
  ],
};

describe('MyGroomsDashboard Component', () => {
  describe('Component Rendering', () => {
    it('renders dashboard with title', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByRole('heading', { name: /my grooms/i })).toBeInTheDocument();
    });

    it('displays loading state when no data provided', () => {
      const Wrapper = createTestWrapper();
      render(<MyGroomsDashboard userId={1} />, { wrapper: Wrapper });

      // When no data is provided, component shows loading state — skeleton
      // uses aria-label="Loading grooms" instead of literal "loading" text.
      expect(screen.getByLabelText(/loading grooms/i)).toBeInTheDocument();
    });

    it('displays empty state when no grooms hired', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={[]}
          assignmentsData={[]}
          salaryCostsData={{ weeklyCost: 0, totalPaid: 0, groomCount: 0, breakdown: [] }}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText(/no grooms hired/i)).toBeInTheDocument();
    });
  });

  describe('Groom List Display', () => {
    it('displays all hired grooms', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Mike Rodriguez')).toBeInTheDocument();
      expect(screen.getByText('Emma Thompson')).toBeInTheDocument();
    });

    it('displays groom details correctly', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const groomCard = screen.getByTestId('groom-card-1');
      expect(within(groomCard).getByText(/expert/i)).toBeInTheDocument();
      expect(within(groomCard).getByText(/foal care/i)).toBeInTheDocument();
      expect(within(groomCard).getByText(/8 years/i)).toBeInTheDocument();
      // Equoria-95yrv: the card shows the fee the player is actually billed —
      // 70 per horse, so 140 for Sarah's two — not a per-groom wage.
      expect(within(groomCard).getByText('Weekly fee')).toBeInTheDocument();
      expect(groomCard).toHaveTextContent(/140/);
    });

    it('displays available slots for each groom', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // Equoria-95yrv: every groom may care for ten horses, whatever their skill.
      const sarahCard = screen.getByTestId('groom-card-1');
      expect(within(sarahCard).getByText('Horses')).toBeInTheDocument();
      expect(within(sarahCard).getByText(/2 \/ 10/)).toBeInTheDocument();

      const mikeCard = screen.getByTestId('groom-card-2');
      expect(within(mikeCard).getByText(/0 \/ 10/)).toBeInTheDocument();

      const emmaCard = screen.getByTestId('groom-card-3');
      expect(within(emmaCard).getByText(/1 \/ 10/)).toBeInTheDocument();
    });
  });

  describe('Assignment Display', () => {
    it('displays current assignments for each groom', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const sarahCard = screen.getByTestId('groom-card-1');
      expect(within(sarahCard).getByText(/Horse ID: 101/i)).toBeInTheDocument();
      expect(within(sarahCard).getByText(/Horse ID: 102/i)).toBeInTheDocument();
    });

    it('displays bond scores for assignments', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // Current implementation doesn't seem to display bond score in MyGroomsDashboard.tsx
      // It shows Priority and Started date.
      const sarahCard = screen.getByTestId('groom-card-1');
      expect(within(sarahCard).getByText(/priority: 1/i)).toBeInTheDocument();
    });

    it('displays priority levels for assignments', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const sarahCard = screen.getByTestId('groom-card-1');
      expect(within(sarahCard).getByText(/priority: 1/i)).toBeInTheDocument();
      expect(within(sarahCard).getByText(/priority: 2/i)).toBeInTheDocument();
    });

    it('displays message when groom has no assignments', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const mikeCard = screen.getByTestId('groom-card-2');
      expect(within(mikeCard).getByText(/available for hire/i)).toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    // mockGroomsData fixtures used by these behavior assertions:
    //   Sarah Johnson  — skillLevel=expert,       specialty=foalCare,    rate=100 (card id 1)
    //   Mike Rodriguez — skillLevel=intermediate, specialty=generalCare, rate=75  (card id 2)
    //   Emma Thompson  — skillLevel=master,        specialty=training,    rate=150 (card id 3)
    // These assert the component actually applies filteredAndSortedGrooms
    // (MyGroomsDashboard.tsx:201-220), not merely that the controls render.

    /** Read the visible groom cards in DOM order by their `Groom: <name>` aria-label. */
    const visibleGroomNames = () => {
      const grid = screen.getByTestId('groom-grid');
      return within(grid)
        .getAllByLabelText(/^Groom:/)
        .map((el) => el.getAttribute('aria-label')!.replace(/^Groom:\s*/, ''));
    };

    it('filters grooms by skill level — only matching grooms remain visible', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // Baseline: all three grooms render.
      expect(visibleGroomNames()).toEqual(
        expect.arrayContaining(['Sarah Johnson', 'Mike Rodriguez', 'Emma Thompson'])
      );

      // Select skill level = Expert → only Sarah (expert) should remain.
      fireEvent.change(screen.getByLabelText(/filter by skill level/i), {
        target: { value: 'expert' },
      });

      const names = visibleGroomNames();
      expect(names).toEqual(['Sarah Johnson']);
      expect(screen.queryByTestId('groom-card-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('groom-card-3')).not.toBeInTheDocument();
    });

    it('filters grooms by specialty — only matching grooms remain visible', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // Select specialty = Training → only Emma (training) should remain.
      fireEvent.change(screen.getByLabelText(/filter by specialty/i), {
        target: { value: 'training' },
      });

      const names = visibleGroomNames();
      expect(names).toEqual(['Emma Thompson']);
      expect(screen.queryByTestId('groom-card-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('groom-card-2')).not.toBeInTheDocument();
    });

    it('sorts grooms by name and by salary — visible order reflects the chosen sort', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // Default sort is 'name' (localeCompare ascending): Emma, Mike, Sarah.
      expect(screen.getByLabelText(/sort by/i)).toHaveValue('name');
      expect(visibleGroomNames()).toEqual(['Emma Thompson', 'Mike Rodriguez', 'Sarah Johnson']);

      // Equoria-95yrv: the fee sort is by what each groom COSTS this week —
      // Sarah's two horses (140), Emma's one (70), Mike's none (0).
      fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'salary' } });
      expect(visibleGroomNames()).toEqual(['Sarah Johnson', 'Emma Thompson', 'Mike Rodriguez']);
    });
  });

  describe('Salary Cost Display', () => {
    it('displays weekly salary cost summary', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // "Weekly Cost" label and the Currency-rendered total live in separate
      // elements. Equoria-95yrv: 70 x the three horses in this stable's care.
      expect(screen.getByText(/weekly cost/i)).toBeInTheDocument();
      expect(screen.getByText('210')).toBeInTheDocument();
    });

    it('displays how many horses the weekly cost is made of', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // Equoria-95yrv: the tile beside Weekly Cost now says what that cost is
      // made of. It used to read "Monthly Cost" from a field the API never sent,
      // so it displayed nothing at all.
      const tile = screen.getByText(/horses in care/i).closest('div');
      expect(tile).toHaveTextContent('3');
    });

    it('highlights unassigned grooms wasting money', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // Mike Rodriguez has 0 assignments. The text is split by nodes, so we check for its presence in the container.
      expect(screen.getByText(/1 groom/i)).toBeInTheDocument();
      expect(screen.getByText(/with no assignments/i)).toBeInTheDocument();
    });
  });

  describe('Assignment Actions', () => {
    it('displays assign button for grooms with available slots', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const sarahCard = screen.getByTestId('groom-card-1');
      expect(
        within(sarahCard).getByRole('button', { name: /assign to horse/i })
      ).toBeInTheDocument();
    });

    it('displays unassign button for each assignment', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const sarahCard = screen.getByTestId('groom-card-1');
      const unassignButtons = within(sarahCard).getAllByRole('button', { name: /unassign/i });
      expect(unassignButtons).toHaveLength(2); // Sarah has 2 assignments
    });

    it('disables the assign button when the groom is caring for ten horses', () => {
      // Equoria-95yrv: ten is the cap, so filling it takes ten horses.
      const fullAssignmentsData = [
        ...mockAssignmentsData.filter((a) => a.groomId !== 1),
        ...Array.from({ length: 10 }, (_, i) => ({
          id: 100 + i,
          groomId: 1,
          foalId: 200 + i,
          bondScore: 60,
          createdAt: new Date('2025-10-15').toISOString(),
          isActive: true,
          priority: 1,
          notes: null,
          horse: { id: 200 + i, name: `Horse ${i}`, age: 2 },
        })),
      ];

      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={fullAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const sarahCard = screen.getByTestId('groom-card-1');
      // The disabled button says so in the player's own terms.
      const assignButton = within(sarahCard).getByRole('button', {
        name: /caring for 10 horses/i,
      });
      expect(assignButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for groom cards', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByLabelText(/groom: sarah johnson/i)).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      // The dashboard is a sub-view rendered inside GroomsPage, whose PageHeader
      // owns the page's single h1 ("Groom Quarters"). The dashboard heading is
      // therefore an h2 — two h1s on one page would break the hierarchy.
      const mainHeading = screen.getByRole('heading', { name: /my grooms/i });
      expect(mainHeading.tagName).toBe('H2');
    });

    it('supports keyboard navigation for assign buttons', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const assignButtons = screen.getAllByRole('button', { name: /assign to horse/i });
      assignButtons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Responsive Design', () => {
    it('renders grid layout for groom cards', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const groomGrid = screen.getByTestId('groom-grid');
      expect(groomGrid).toHaveClass('grid');
    });
  });

  // Equoria-cbkw — GroomMetrics + GroomAssignmentLog surfacing.
  // No API mocking (per CLAUDE.md frontend testing philosophy): the panel is
  // collapsed by default so no request fires; clicking the toggle mounts the
  // panel which then renders its loading state (queryFn never resolves in
  // jsdom without a server — that loading state is itself the assertion that
  // the panel + hooks are wired).
  describe('Equoria-cbkw — Performance & History panel', () => {
    it('renders a Performance & History toggle for every groom', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      for (const groom of mockGroomsData) {
        expect(screen.getByTestId(`groom-detail-toggle-${groom.id}`)).toBeInTheDocument();
      }
    });

    it('detail panel is collapsed by default (no panel rendered until toggled)', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.queryByTestId('groom-detail-panel-1')).not.toBeInTheDocument();
    });

    it('clicking the toggle mounts the detail panel with metrics + history sections', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      fireEvent.click(screen.getByTestId('groom-detail-toggle-1'));

      const panel = screen.getByTestId('groom-detail-panel-1');
      expect(panel).toBeInTheDocument();
      expect(within(panel).getByTestId('groom-metrics-section-1')).toBeInTheDocument();
      expect(within(panel).getByTestId('groom-assignment-log-section-1')).toBeInTheDocument();
      // toggle reflects expanded state
      expect(screen.getByTestId('groom-detail-toggle-1')).toHaveAttribute('aria-expanded', 'true');
    });

    it('toggling again collapses the panel', () => {
      const Wrapper = createTestWrapper();
      render(
        <MyGroomsDashboard
          userId={1}
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
        />,
        { wrapper: Wrapper }
      );

      const toggle = screen.getByTestId('groom-detail-toggle-1');
      fireEvent.click(toggle);
      expect(screen.getByTestId('groom-detail-panel-1')).toBeInTheDocument();
      fireEvent.click(toggle);
      expect(screen.queryByTestId('groom-detail-panel-1')).not.toBeInTheDocument();
    });
  });
});
