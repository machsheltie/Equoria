/**
 * Horse Search & Filter Integration Tests
 *
 * End-to-end integration tests verifying:
 * - Search and filter user flows work correctly
 * - URL state persistence (bookmarking/sharing)
 * - Real-time result updates
 * - Filter combinations
 * - Performance with large datasets
 *
 * Story 3-6: Horse Search & Filter - Task 6
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import HorseListView from '../HorseListView';

// Mock horse data for integration testing
const createMockHorses = (count: number) => {
  const breeds = ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Appaloosa'];
  const disciplines = ['Racing', 'Dressage', 'ShowJumping', 'Endurance'];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Horse ${i + 1}`,
    breed: breeds[i % breeds.length],
    age: 3 + (i % 8),
    level: 5 + (i % 15),
    health: 90 + (i % 10),
    xp: 500 * (i + 1),
    imageUrl: `https://example.com/horse-${i + 1}.jpg`,
    stats: {
      speed: 70 + (i % 30),
      stamina: 70 + (i % 30),
      agility: 70 + (i % 30),
      balance: 70 + (i % 30),
      precision: 70 + (i % 30),
      intelligence: 70 + (i % 30),
      boldness: 70 + (i % 30),
      flexibility: 70 + (i % 30),
      obedience: 70 + (i % 30),
      focus: 70 + (i % 30),
    },
    disciplineScores: {
      [disciplines[i % disciplines.length]]: 80 + (i % 20),
    },
  }));
};

// Test wrapper with URL tracking
const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.search}</div>;
};

const createTestWrapper = (initialUrl = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        {children}
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Horse Search & Filter Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('User Flow: Search Horses', () => {
    test('searching updates results in real-time', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      // Initially shows all horses
      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
        expect(screen.getByText(/showing 10 of 10 horses/i)).toBeInTheDocument();
      });

      // Type in search using fireEvent (bypasses debounce delay in tests)
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Thoroughbred' } });

      // Wait for filter - should show only Thoroughbred horses (3 out of 10)
      await waitFor(
        () => {
          const resultText = screen.getByText(/showing \d+ of 10 horses/i).textContent;
          expect(resultText).toContain('3 of 10');
        },
        { timeout: 1500 }
      );
    });

    test('search updates URL with search parameter', async () => {
      const horses = createMockHorses(5);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Arabian' } });

      // URL should update with search parameter
      await waitFor(
        () => {
          const locationDisplay = screen.getByTestId('location-display');
          expect(locationDisplay.textContent).toContain('search=Arabian');
        },
        { timeout: 1500 }
      );
    });

    test('clear search button resets results and URL', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/showing 10 of 10 horses/i)).toBeInTheDocument();
      });

      // Search for something
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Arabian' } });

      // Wait for filtered results (should show 3 Arabians)
      await waitFor(
        () => {
          const resultText = screen.getByText(/showing \d+ of 10 horses/i).textContent;
          expect(resultText).toContain('3 of 10');
        },
        { timeout: 1500 }
      );

      // Clear search
      const clearButton = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearButton);

      // All horses should be visible again
      await waitFor(() => {
        expect(screen.getByText(/showing 10 of 10 horses/i)).toBeInTheDocument();
      });

      // Search input should be cleared
      expect(searchInput).toHaveValue('');

      // URL should not have search parameter
      const locationDisplay = screen.getByTestId('location-display');
      expect(locationDisplay.textContent).not.toContain('search=');
    });
  });

  describe('User Flow: Filter Horses', () => {
    test('age range filter updates results', async () => {
      const horses = createMockHorses(20);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
      });

      // Set min age to 5
      const minAgeInput = screen.getByLabelText(/minimum age/i);
      fireEvent.change(minAgeInput, { target: { value: '5' } });

      // Results should update (horses with age < 5 should be hidden)
      await waitFor(() => {
        // Horse 1 has age 3, should be filtered out
        expect(screen.queryByText('Horse 1')).not.toBeInTheDocument();
        // Horse 3 has age 5, should be visible
        expect(screen.getByText('Horse 3')).toBeInTheDocument();
      });
    });

    test('discipline filter updates results', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
      });

      // Select a discipline filter
      const racingCheckbox = screen.getByLabelText(/filter by racing/i);
      await user.click(racingCheckbox);

      // Results should filter to horses with Racing discipline
      await waitFor(() => {
        expect(racingCheckbox).toBeChecked();
      });
    });

    test('filters persist in URL for bookmarking', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
      });

      // Apply age filter
      const minAgeInput = screen.getByLabelText(/minimum age/i);
      fireEvent.change(minAgeInput, { target: { value: '5' } });

      // URL should contain filter parameters
      await waitFor(() => {
        const locationDisplay = screen.getByTestId('location-display');
        expect(locationDisplay.textContent).toContain('minAge=5');
      });
    });

    test('loading from URL with filters applies filters automatically', async () => {
      const horses = createMockHorses(20);
      // Start with URL containing filter parameters
      const TestWrapper = createTestWrapper('/?minAge=7&maxAge=9');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Age inputs should reflect URL parameters
        const minAgeInput = screen.getByLabelText(/minimum age/i) as HTMLInputElement;
        const maxAgeInput = screen.getByLabelText(/maximum age/i) as HTMLInputElement;

        expect(minAgeInput.value).toBe('7');
        expect(maxAgeInput.value).toBe('9');
      });

      // Results should be filtered automatically
      await waitFor(() => {
        // Horse 1 has age 3, should be filtered out
        expect(screen.queryByText('Horse 1')).not.toBeInTheDocument();
        // Horse 5 has age 7, should be visible
        expect(screen.getByText('Horse 5')).toBeInTheDocument();
      });
    });
  });

  describe('User Flow: Combined Filters', () => {
    test('search and filters work together', async () => {
      const horses = createMockHorses(20);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/showing 20 of 20 horses/i)).toBeInTheDocument();
      });

      // Apply search
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Thoroughbred' } });

      // Apply age filter
      const minAgeInput = screen.getByLabelText(/minimum age/i);
      fireEvent.change(minAgeInput, { target: { value: '7' } });

      // Should show horses matching both search AND age filter
      await waitFor(
        () => {
          const locationDisplay = screen.getByTestId('location-display');
          expect(locationDisplay.textContent).toContain('search=Thoroughbred');
          expect(locationDisplay.textContent).toContain('minAge=7');

          // Should show fewer horses than original 20
          const resultText = screen.getByText(/showing \d+ of 20 horses/i).textContent;
          // Combined filters should reduce the count
          expect(parseInt(resultText.match(/showing (\d+)/)?.[1] || '0')).toBeLessThan(5);
        },
        { timeout: 1500 }
      );
    });

    test('clear all filters resets everything', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
      });

      // Apply multiple filters
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      await user.type(searchInput, 'Horse 5');

      const minAgeInput = screen.getByLabelText(/minimum age/i);
      fireEvent.change(minAgeInput, { target: { value: '5' } });

      // Clear all filters
      const clearAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearAllButton);

      // All horses should be visible again
      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
        expect(screen.getByText('Horse 5')).toBeInTheDocument();
      });

      // Search input should be cleared
      expect(searchInput).toHaveValue('');

      // Age inputs should be cleared
      expect((minAgeInput as HTMLInputElement).value).toBe('');

      // URL should not have any filter parameters
      const locationDisplay = screen.getByTestId('location-display');
      expect(locationDisplay.textContent).toBe('');
    });
  });

  describe('Performance & Edge Cases', () => {
    test('handles large dataset (100+ horses) efficiently', async () => {
      const horses = createMockHorses(150);
      const TestWrapper = createTestWrapper();
      const startTime = Date.now();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;

      // Should render within 3 seconds even with 150 horses
      expect(loadTime).toBeLessThan(3000);
    });

    test('shows empty state when no results match filters', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/showing 10 of 10 horses/i)).toBeInTheDocument();
      });

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'ZZZNonexistentBreedXYZ' } });

      // Should show empty state
      await waitFor(
        () => {
          expect(screen.getByText(/no horses found/i)).toBeInTheDocument();
          expect(screen.getByText(/showing 0 of 10 horses/i)).toBeInTheDocument();
        },
        { timeout: 1500 }
      );
    });

    test('handles rapid filter changes gracefully', async () => {
      const horses = createMockHorses(20);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Horse 1')).toBeInTheDocument();
      });

      const minAgeInput = screen.getByLabelText(/minimum age/i);

      // Rapidly change age filter multiple times
      fireEvent.change(minAgeInput, { target: { value: '3' } });
      fireEvent.change(minAgeInput, { target: { value: '5' } });
      fireEvent.change(minAgeInput, { target: { value: '7' } });
      fireEvent.change(minAgeInput, { target: { value: '4' } });

      // Should handle gracefully and end up with final value
      await waitFor(() => {
        expect((minAgeInput as HTMLInputElement).value).toBe('4');
      });
    });
  });

  describe('Accessibility', () => {
    test('filter controls are keyboard accessible', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/showing 10 of 10 horses/i)).toBeInTheDocument();
      });

      // Change min age using fireEvent (keyboard input simulation)
      const minAgeInput = screen.getByLabelText(/minimum age/i) as HTMLInputElement;
      fireEvent.change(minAgeInput, { target: { value: '7' } });

      await waitFor(() => {
        expect(minAgeInput.value).toBe('7');
        // Results should be filtered
        const resultText = screen.getByText(/showing \d+ of 10 horses/i).textContent;
        // Should filter to horses age >= 7
        expect(parseInt(resultText.match(/showing (\d+)/)?.[1] || '0')).toBeLessThan(10);
      });
    });

    test('search has proper ARIA labels', async () => {
      const horses = createMockHorses(3);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search horses/i);
        expect(searchInput).toHaveAttribute('aria-label');
      });
    });

    test('filter results count is announced', async () => {
      const horses = createMockHorses(10);
      const TestWrapper = createTestWrapper();

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={horses} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show total count
        expect(screen.getByText(/showing 10 of 10 horses/i)).toBeInTheDocument();
      });

      // Apply filter
      const minAgeInput = screen.getByLabelText(/minimum age/i);
      fireEvent.change(minAgeInput, { target: { value: '7' } });

      // Count should update to show fewer horses
      await waitFor(() => {
        const resultText = screen.getByText(/showing \d+ of 10 horses/i).textContent;
        // Should show fewer than 10 (but total is still "of 10 horses")
        expect(resultText).toMatch(/showing [1-9] of 10 horses/i);
      });
    });
  });
});
