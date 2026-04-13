/**
 * BetaExcludedNotice Tests
 *
 * Verifies the beta-excluded notice renders honest copy in expected states.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BetaExcludedNotice from '../BetaExcludedNotice';

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('BetaExcludedNotice', () => {
  describe('Default state', () => {
    it('renders with default message', () => {
      renderWithRouter(<BetaExcludedNotice />);

      expect(screen.getByTestId('beta-excluded-notice')).toBeInTheDocument();
      expect(screen.getByText('Not available in this beta')).toBeInTheDocument();
    });

    it('renders default message copy', () => {
      renderWithRouter(<BetaExcludedNotice />);

      expect(screen.getByText('Not available in this beta.')).toBeInTheDocument();
    });

    it('does not render a redirect link when redirectTo is not provided', () => {
      renderWithRouter(<BetaExcludedNotice />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('Custom props', () => {
    it('renders custom message', () => {
      renderWithRouter(<BetaExcludedNotice message="Custom beta exclusion message." />);

      expect(screen.getByText('Custom beta exclusion message.')).toBeInTheDocument();
    });

    it('renders redirect link when redirectTo is provided', () => {
      renderWithRouter(<BetaExcludedNotice redirectTo="/" redirectLabel="Go Home" />);

      const link = screen.getByRole('link', { name: 'Go Home' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/');
    });

    it('uses custom testId', () => {
      renderWithRouter(<BetaExcludedNotice testId="my-beta-notice" />);

      expect(screen.getByTestId('my-beta-notice')).toBeInTheDocument();
    });

    it('renders link with testId based on testId prop', () => {
      renderWithRouter(
        <BetaExcludedNotice testId="my-notice" redirectTo="/" redirectLabel="Home" />
      );

      expect(screen.getByTestId('my-notice-link')).toBeInTheDocument();
    });
  });

  describe('Full-page layout', () => {
    it('renders inline by default', () => {
      renderWithRouter(<BetaExcludedNotice />);

      // fullPage adds min-h-screen wrapper — without it, no flex wrapper
      const notice = screen.getByTestId('beta-excluded-notice');
      expect(notice.parentElement).not.toHaveClass('min-h-screen');
    });

    it('renders full-page layout when fullPage=true', () => {
      renderWithRouter(<BetaExcludedNotice fullPage />);

      const notice = screen.getByTestId('beta-excluded-notice');
      // Full-page wrapper contains the notice inside a centered container
      expect(notice.closest('.min-h-screen')).toBeInTheDocument();
    });
  });

  describe('Honest copy verification', () => {
    it('does not use "coming soon" language', () => {
      renderWithRouter(<BetaExcludedNotice />);

      const container = screen.getByTestId('beta-excluded-notice');
      expect(container.textContent).not.toMatch(/coming soon/i);
    });

    it('does not claim features are planned or temporary', () => {
      renderWithRouter(<BetaExcludedNotice />);

      const container = screen.getByTestId('beta-excluded-notice');
      expect(container.textContent).not.toMatch(/will be available/i);
      expect(container.textContent).not.toMatch(/check back/i);
    });
  });
});
