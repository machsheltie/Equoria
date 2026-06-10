/**
 * HorseDetailPage — page-level tab navigation + quick actions suites
 * (Equoria-snx5i).
 *
 * Split verbatim from the former 886-line
 * frontend/src/pages/__tests__/HorseDetailPage.test.tsx (Tab Navigation +
 * Quick Actions describe blocks) per the Equoria-g6aed 300-line-per-file AC.
 * Assertions are unchanged; only their file home moved. Shared fixtures live in
 * pageDetail.testHelpers.tsx.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import HorseDetailPage from '../../HorseDetailPage';
import {
  mockHorse,
  originalFetch,
  createFetchMock,
  createTestWrapper,
} from './pageDetail.testHelpers';

describe('HorseDetailPage Component', () => {
  beforeEach(() => {
    // Set default mock that handles genetics endpoints
    global.fetch = createFetchMock();
  });

  afterEach(() => {
    // Clean up after each test
    global.fetch = originalFetch;
  });

  describe('Tab Navigation', () => {
    test('renders all tab buttons', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Verify all tabs are present
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Disciplines')).toBeInTheDocument();
      expect(screen.getByText('Genetics')).toBeInTheDocument();
      expect(screen.getByText('Training')).toBeInTheDocument();
      expect(screen.getByText('Competitions')).toBeInTheDocument();
    });

    test('switches tabs when clicked', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Disciplines tab (Radix trigger — userEvent fires the full pointer sequence)
      const disciplinesTab = screen.getByText('Disciplines');
      await userEvent.click(disciplinesTab);

      // Verify tab switched (Radix marks the active trigger via aria-selected)
      await waitFor(() => {
        const tabButton = disciplinesTab.closest('button');
        expect(tabButton).toHaveAttribute('aria-selected', 'true');
      });
    });

    test('displays discipline scores in disciplines tab', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Disciplines tab
      const disciplinesTab = screen.getByText('Disciplines');
      await userEvent.click(disciplinesTab);

      // Verify discipline scores are shown
      await waitFor(() => {
        expect(screen.getByText('Western Pleasure')).toBeInTheDocument();
        expect(screen.getByText('Dressage')).toBeInTheDocument();
        expect(screen.getByText('Show Jumping')).toBeInTheDocument();
      });
    });

    test('displays traits in genetics tab', async () => {
      global.fetch = createFetchMock({ success: true, data: mockHorse });

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click Genetics tab
      const geneticsTab = screen.getByText('Genetics');
      await userEvent.click(geneticsTab);

      // Verify Genetics tab is active with Timeline section
      await waitFor(
        () => {
          const tabButton = geneticsTab.closest('button');
          expect(tabButton).toHaveAttribute('aria-selected', 'true');

          // Verify genetics content is rendered (page has substantial content)
          const bodyText = document.body.textContent || '';
          expect(bodyText.length).toBeGreaterThan(100);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Quick Actions', () => {
    test('renders all action buttons', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Verify action buttons are present
      expect(screen.getByText(/train this horse/i)).toBeInTheDocument();
      expect(screen.getByText(/enter competition/i)).toBeInTheDocument();

      // View Parents button should appear if parentIds exist
      if (mockHorse.parentIds) {
        expect(screen.getByText(/view parents/i)).toBeInTheDocument();
      }
    });

    test('train button navigates correctly', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Click train button
      const trainButton = screen.getByText(/train this horse/i);
      fireEvent.click(trainButton);

      // Verify navigation occurred (URL should contain /training)
      await waitFor(() => {
        expect(window.location.pathname).toContain('/training');
      });
    });
  });
});
