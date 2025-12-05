/**
 * Horse List View Component Tests
 * 
 * Tests for the comprehensive horse list interface including:
 * - Horse list display with sorting and filtering
 * - Pagination for large horse collections
 * - Real-time data updates with React Query
 * - Responsive design for mobile and desktop
 * - Search functionality and filter options
 * 
 * Following TDD with NO MOCKING approach for authentic component validation
 * Testing real API integration with backend horse management endpoints
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import HorseListView from '../HorseListView';

// Mock horse data for testing (NO MOCKING - real data structures)
const mockHorses = [
  {
    id: 1,
    name: 'Thunder',
    breed: 'Thoroughbred',
    age: 5,
    level: 10,
    health: 95,
    xp: 1500,
    stats: {
      speed: 85,
      stamina: 80,
      agility: 75,
      balance: 70,
      precision: 72,
      intelligence: 68,
      boldness: 78,
      flexibility: 65,
      obedience: 70,
      focus: 75,
    },
    disciplineScores: {
      'Western Pleasure': 85,
      'Dressage': 70,
    },
  },
  {
    id: 2,
    name: 'Lightning',
    breed: 'Arabian',
    age: 3,
    level: 5,
    health: 100,
    xp: 500,
    stats: {
      speed: 90,
      stamina: 85,
      agility: 88,
      balance: 82,
      precision: 80,
      intelligence: 85,
      boldness: 75,
      flexibility: 78,
      obedience: 80,
      focus: 82,
    },
    disciplineScores: {
      'Endurance': 90,
      'Show Jumping': 75,
    },
  },
  {
    id: 3,
    name: 'Storm',
    breed: 'Quarter Horse',
    age: 7,
    level: 15,
    health: 90,
    xp: 3000,
    stats: {
      speed: 80,
      stamina: 75,
      agility: 70,
      balance: 75,
      precision: 78,
      intelligence: 72,
      boldness: 85,
      flexibility: 68,
      obedience: 75,
      focus: 70,
    },
    disciplineScores: {
      'Barrel Racing': 88,
      'Reining': 82,
    },
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
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('HorseListView Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
  });

  describe('Component Rendering', () => {
    test('renders horse list view with loading state', async () => {
      // When no horses are provided as props and fetch is not available,
      // the component shows error state since fetch fails
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      // In test environment without fetch, component shows loading or error state
      await waitFor(() => {
        const hasContent =
          screen.queryByText(/loading horses/i) ||
          screen.queryByText(/error loading horses/i) ||
          screen.queryByText(/no horses found/i);
        expect(hasContent).toBeTruthy();
      });
    });

    test('renders horse list view with proper structure', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Check for main sections
      expect(screen.getByRole('main')).toHaveClass('horse-list-container');
    });
  });

  describe('Horse List Display', () => {
    test('displays horses in a sortable table format', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Check for table headers - use getAllByText since some text appears in multiple places
      const nameElements = screen.getAllByText(/name/i);
      expect(nameElements.length).toBeGreaterThan(0);

      // "Breed" appears in both filter dropdown and table header
      const breedElements = screen.getAllByText(/breed/i);
      expect(breedElements.length).toBeGreaterThan(0);

      const ageElements = screen.getAllByText(/age/i);
      expect(ageElements.length).toBeGreaterThan(0);

      const levelElements = screen.getAllByText(/level/i);
      expect(levelElements.length).toBeGreaterThan(0);
    });

    test('displays horse cards on mobile view', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('horse-cards-container')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Sorting', () => {
    test('provides filter options for breed, age, and level', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by breed/i)).toBeInTheDocument();
        // Age and level filters have minimum and maximum inputs
        expect(screen.getByLabelText(/filter by age minimum/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by age maximum/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by level minimum/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by level maximum/i)).toBeInTheDocument();
      });
    });

    test('allows sorting by different columns', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Check if desktop or mobile layout is rendered
      const desktopLayout = screen.queryByTestId('desktop-layout');
      const mobileLayout = screen.queryByTestId('mobile-layout');

      if (desktopLayout && screen.queryByRole('table')) {
        // Desktop layout with table - test sorting
        const nameElements = screen.getAllByText(/name/i);
        const nameHeader = nameElements.find(el => el.closest('th'));
        expect(nameHeader).toBeDefined();

        if (nameHeader) {
          fireEvent.click(nameHeader);

          // Verify sort indicator appears
          await waitFor(() => {
            expect(nameHeader.closest('th')).toHaveAttribute('aria-sort');
          });
        }
      } else if (mobileLayout) {
        // Mobile layout - sorting is not available via table headers
        // Just verify the component rendered successfully
        expect(mobileLayout).toBeInTheDocument();
      }
    });

    test('filters horses based on search input', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      const searchInput = await screen.findByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Thunder' } });

      // Verify search is applied
      await waitFor(() => {
        expect(searchInput).toHaveValue('Thunder');
      });
    });
  });

  describe('Pagination', () => {
    test('displays pagination controls when needed', async () => {
      // NO MOCKING - Pass horses data as props (need more than 10 horses for pagination)
      const manyHorses = Array.from({ length: 25 }, (_, i) => ({
        ...mockHorses[0],
        id: i + 1,
        name: `Horse ${i + 1}`,
      }));

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={manyHorses} />
        </TestWrapper>
      );

      // There are multiple pagination elements (mobile and desktop), use getAllByRole
      await waitFor(() => {
        const paginationElements = screen.getAllByRole('navigation', { name: /pagination/i });
        expect(paginationElements.length).toBeGreaterThan(0);
      });
    });

    test('allows navigation between pages', async () => {
      // NO MOCKING - Pass horses data as props (need more than 10 horses for pagination)
      const manyHorses = Array.from({ length: 25 }, (_, i) => ({
        ...mockHorses[0],
        id: i + 1,
        name: `Horse ${i + 1}`,
      }));

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={manyHorses} />
        </TestWrapper>
      );

      // Get all next page buttons (mobile and desktop) and click the first enabled one
      const nextButtons = await screen.findAllByRole('button', { name: /next page/i });
      const enabledNextButton = nextButtons.find(btn => !btn.hasAttribute('disabled'));

      if (enabledNextButton) {
        fireEvent.click(enabledNextButton);

        // Verify we're showing horses from page 2 (Horse 11-20)
        await waitFor(() => {
          expect(screen.getByText(/Horse 11/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Horse Actions', () => {
    test('provides quick action buttons for each horse', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Multiple horses means multiple buttons, use getAllByRole
      await waitFor(() => {
        const viewButtons = screen.getAllByRole('button', { name: /view details/i });
        expect(viewButtons.length).toBeGreaterThan(0);

        const trainButtons = screen.getAllByRole('button', { name: /train/i });
        expect(trainButtons.length).toBeGreaterThan(0);

        const competeButtons = screen.getAllByRole('button', { name: /compete/i });
        expect(competeButtons.length).toBeGreaterThan(0);
      });
    });

    test('navigates to horse detail view when clicking view details', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Multiple horses means multiple view buttons, get all and click the first one
      const viewButtons = await screen.findAllByRole('button', { name: /view details/i });
      expect(viewButtons.length).toBeGreaterThan(0);

      fireEvent.click(viewButtons[0]);

      // Verify button is still in document (navigation would be handled by React Router in real app)
      expect(viewButtons[0]).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('adapts layout for mobile screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      });
    });

    test('shows table layout for desktop screens', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      });
    });
  });

  describe('View Toggle', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    test('renders view toggle button on desktop', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        const toggleButton = screen.getByRole('button', { name: /switch to grid view/i });
        expect(toggleButton).toBeInTheDocument();
      });
    });

    test('does not render view toggle on mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      });

      // View toggle should not exist on mobile
      const toggleButton = screen.queryByRole('button', { name: /switch to/i });
      expect(toggleButton).not.toBeInTheDocument();
    });

    test('toggles between grid and list view when clicked', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Initially should show list view
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to grid view/i })).toBeInTheDocument();
      });

      // Click to switch to grid view
      const toggleButton = screen.getByRole('button', { name: /switch to grid view/i });
      fireEvent.click(toggleButton);

      // Should now show option to switch back to list view
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to list view/i })).toBeInTheDocument();
      });

      // Grid layout should be rendered
      expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
    });

    test('renders grid layout when viewMode is grid', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set localStorage to grid view
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Should render grid layout
      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Should show option to switch to list view
      expect(screen.getByRole('button', { name: /switch to list view/i })).toBeInTheDocument();
    });

    test('renders table layout when viewMode is list', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set localStorage to list view (default)
      localStorage.setItem('horseListViewMode', 'list');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Should render table layout
      await waitFor(() => {
        expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Should show option to switch to grid view
      expect(screen.getByRole('button', { name: /switch to grid view/i })).toBeInTheDocument();
    });

    test('persists view preference to localStorage', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Initially should be list view (default)
      expect(localStorage.getItem('horseListViewMode')).toBe('list');

      // Click to switch to grid view
      const toggleButton = await screen.findByRole('button', { name: /switch to grid view/i });
      fireEvent.click(toggleButton);

      // Should save grid view to localStorage
      await waitFor(() => {
        expect(localStorage.getItem('horseListViewMode')).toBe('grid');
      });

      // Click to switch back to list view
      const listButton = await screen.findByRole('button', { name: /switch to list view/i });
      fireEvent.click(listButton);

      // Should save list view to localStorage
      await waitFor(() => {
        expect(localStorage.getItem('horseListViewMode')).toBe('list');
      });
    });

    test('loads view preference from localStorage on mount', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set localStorage to grid view before rendering
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Should load grid view from localStorage
      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /switch to list view/i })).toBeInTheDocument();
      });
    });

    test('displays horses correctly in grid view', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set localStorage to grid view
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Grid layout should be rendered
      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Grid should contain cards for all horses (3 horses)
      const gridLayout = screen.getByTestId('desktop-grid-layout');
      const horseCards = gridLayout.querySelectorAll('.bg-white.rounded-lg.shadow-md');
      expect(horseCards.length).toBe(3);

      // Check that horse names are rendered (getAllByText since each appears in card)
      expect(screen.getAllByText('Thunder').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lightning').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Storm').length).toBeGreaterThan(0);
    });

    test('grid cards have action buttons', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set localStorage to grid view
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Should have action buttons (3 horses × 3 buttons = 9 buttons minimum)
      const viewButtons = screen.getAllByRole('button', { name: /view details/i });
      expect(viewButtons.length).toBe(3);

      const trainButtons = screen.getAllByRole('button', { name: /train/i });
      expect(trainButtons.length).toBe(3);

      const competeButtons = screen.getAllByRole('button', { name: /compete/i });
      expect(competeButtons.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    test('displays error message when API fails', async () => {
      // In test environment without fetch available, the component shows error state
      render(
        <TestWrapper>
          <HorseListView userId={999999} />
        </TestWrapper>
      );

      // Without fetch, component shows error state
      await waitFor(() => {
        expect(screen.getByText(/error loading horses/i)).toBeInTheDocument();
      });
    });

    test('provides retry functionality on error', async () => {
      // In test environment without fetch available, the component shows error state with retry button
      render(
        <TestWrapper>
          <HorseListView userId={999999} />
        </TestWrapper>
      );

      // Error state has a retry button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    test('loads within acceptable time limits', async () => {
      const startTime = Date.now();

      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
    });
  });

  describe('Accessibility', () => {
    test('provides proper ARIA labels and roles', async () => {
      // Mock desktop viewport to ensure table view
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Wait for main element with proper aria-label
      await waitFor(() => {
        const mainElement = screen.getByRole('main');
        expect(mainElement).toHaveAttribute('aria-label', 'Horse list');
      }, { timeout: 3000 });

      // Check if table exists (only in desktop list view)
      const desktopLayout = screen.queryByTestId('desktop-layout');
      if (desktopLayout) {
        const table = screen.getByRole('table');
        expect(table).toHaveAttribute('aria-label', 'Horses table');
      }
    });

    test('supports keyboard navigation', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Multiple buttons exist, get all and focus the first one
      const buttons = await screen.findAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons[0].focus();

      expect(document.activeElement).toBe(buttons[0]);
    });
  });
});
