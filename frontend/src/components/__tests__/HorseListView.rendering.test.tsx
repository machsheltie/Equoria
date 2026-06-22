/**
 * Horse List View Component Tests — Rendering & Display
 *
 * Split (Equoria-urqic.2) from the original monolithic HorseListView.test.tsx.
 * Behavior groups in this file:
 * - Component Rendering
 * - Horse List Display
 * - Responsive Design
 * - View Toggle
 *
 * Following TDD with NO MOCKING approach for authentic component validation.
 * Describe blocks moved VERBATIM; shared mockHorses + createTestWrapper come
 * from HorseListView.testUtils.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HorseListView from '../HorseListView';
import { mockHorses, createTestWrapper } from './HorseListView.testUtils';

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
      const horseCards = gridLayout.querySelectorAll('.glass-panel.rounded-lg');
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

      // Should have action buttons for each horse
      const viewButtons = screen.getAllByRole('button', { name: /view details/i });
      expect(viewButtons.length).toBe(3);

      // Train buttons include both enabled and disabled variants
      // mockHorses has horses ages 5, 3, 7 - all eligible (3-20 age range, no cooldown)
      const trainButtons = screen.getAllByRole('button', { name: /train horse/i });
      expect(trainButtons.length).toBe(3);

      const competeButtons = screen.getAllByRole('button', { name: /compete/i });
      expect(competeButtons.length).toBe(3);
    });
  });
});
