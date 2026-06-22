/**
 * Horse List View Component Tests — Actions, Errors, Performance, Accessibility
 *
 * Split (Equoria-urqic.2) from the original monolithic HorseListView.test.tsx.
 * Behavior groups in this file:
 * - Horse Actions
 * - Error Handling
 * - Performance
 * - Accessibility
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

  describe('Error Handling', () => {
    test('displays error message when API fails', async () => {
      // Mock fetch to fail
      const originalFetch = global.fetch;
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Server error' }),
        } as Response)
      );

      render(
        <TestWrapper>
          <HorseListView userId={999999} />
        </TestWrapper>
      );

      // Without fetch, component shows error state
      await waitFor(() => {
        expect(screen.getByText(/error loading horses/i)).toBeInTheDocument();
      });

      global.fetch = originalFetch;
    });

    test('provides retry functionality on error', async () => {
      // Mock fetch to fail
      const originalFetch = global.fetch;
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Server error' }),
        } as Response)
      );

      render(
        <TestWrapper>
          <HorseListView userId={999999} />
        </TestWrapper>
      );

      // Error state has a retry button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      global.fetch = originalFetch;
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
      await waitFor(
        () => {
          const mainElement = screen.getByRole('main');
          expect(mainElement).toHaveAttribute('aria-label', 'Horse list');
        },
        { timeout: 3000 }
      );

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
