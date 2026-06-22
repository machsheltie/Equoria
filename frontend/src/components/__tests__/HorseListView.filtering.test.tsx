/**
 * Horse List View Component Tests — Filtering, Sorting & Pagination
 *
 * Split (Equoria-urqic.2) from the original monolithic HorseListView.test.tsx.
 * Behavior groups in this file:
 * - Filtering and Sorting
 * - Pagination
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

  describe('Filtering and Sorting', () => {
    test('provides filter options for breed, age, and discipline', async () => {
      // NO MOCKING - Pass horses data as props
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Age filters have minimum and maximum inputs
        expect(screen.getByLabelText(/minimum age/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/maximum age/i)).toBeInTheDocument();

        // Discipline filter checkboxes (Racing, Dressage, etc.)
        expect(screen.getByLabelText(/filter by racing/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by dressage/i)).toBeInTheDocument();
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
        const nameHeader = nameElements.find((el) => el.closest('th'));
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
      const enabledNextButton = nextButtons.find((btn) => !btn.hasAttribute('disabled'));

      if (enabledNextButton) {
        fireEvent.click(enabledNextButton);

        // Verify we're showing horses from page 2 (Horse 11-20)
        await waitFor(() => {
          expect(screen.getByText(/Horse 11/i)).toBeInTheDocument();
        });
      }
    });
  });
});
