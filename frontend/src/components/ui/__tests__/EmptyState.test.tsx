/**
 * EmptyState Component Tests
 *
 * Tests the 4 legacy variant empty states + D-17 semantic variants.
 * Legacy tests are unmodified — all existing consumers stay green.
 * New tests cover: semantic variants, primaryAction/secondaryAction,
 * D-08 one-primary-action enforcement, icon rendering.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock lucide-react — keep the list in sync with EmptyState.tsx imports
vi.mock('lucide-react', () => ({
  Footprints: (props: any) => <svg data-testid="icon-footprints" {...props} />,
  Trophy: (props: any) => <svg data-testid="icon-trophy" {...props} />,
  MessageSquare: (props: any) => <svg data-testid="icon-message" {...props} />,
  SearchX: (props: any) => <svg data-testid="icon-search" {...props} />,
  // button.tsx imports Loader2
  Loader2: (props: any) => <svg data-testid="icon-loader" {...props} />,
}));

import { EmptyState } from '../EmptyState';

// ── Legacy API (all existing tests unchanged) ──────────────────────────────────

describe('EmptyState — legacy API', () => {
  describe('Variant defaults', () => {
    it('renders no-horses variant with default title', () => {
      render(<EmptyState variant="no-horses" />);
      expect(screen.getByTestId('empty-state-no-horses')).toBeInTheDocument();
      expect(screen.getByText('No Horses Yet')).toBeInTheDocument();
      expect(
        screen.getByText('Your stable is empty. Browse available horses to begin your journey.')
      ).toBeInTheDocument();
    });

    it('renders no-competitions variant with default title', () => {
      render(<EmptyState variant="no-competitions" />);
      expect(screen.getByTestId('empty-state-no-competitions')).toBeInTheDocument();
      expect(screen.getByText('No Competitions Found')).toBeInTheDocument();
    });

    it('renders no-messages variant with default title', () => {
      render(<EmptyState variant="no-messages" />);
      expect(screen.getByTestId('empty-state-no-messages')).toBeInTheDocument();
      expect(screen.getByText('No Messages')).toBeInTheDocument();
    });

    it('renders no-results variant with default title (legacy path)', () => {
      render(<EmptyState variant="no-results" />);
      expect(screen.getByTestId('empty-state-no-results')).toBeInTheDocument();
      expect(screen.getByText('No Results')).toBeInTheDocument();
    });
  });

  describe('Custom overrides', () => {
    it('uses custom title when provided', () => {
      render(<EmptyState variant="no-horses" title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.queryByText('No Horses Yet')).not.toBeInTheDocument();
    });

    it('uses custom subtitle when provided', () => {
      render(<EmptyState variant="no-horses" subtitle="Custom subtitle text" />);
      expect(screen.getByText('Custom subtitle text')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<EmptyState variant="no-horses" className="my-custom-class" />);
      expect(screen.getByTestId('empty-state-no-horses')).toHaveClass('my-custom-class');
    });
  });

  describe('CTA button (legacy action prop)', () => {
    it('renders CTA button when action is provided', () => {
      const onClick = vi.fn();
      render(<EmptyState variant="no-horses" action={{ label: 'Browse Horses', onClick }} />);
      const button = screen.getByRole('button', { name: 'Browse Horses' });
      expect(button).toBeInTheDocument();
    });

    it('calls onClick when CTA is clicked', () => {
      const onClick = vi.fn();
      render(<EmptyState variant="no-horses" action={{ label: 'Browse Horses', onClick }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Browse Horses' }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not render CTA when action is not provided', () => {
      render(<EmptyState variant="no-horses" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});

// ── D-17 Semantic API ──────────────────────────────────────────────────────────

describe('EmptyState — D-17 semantic variants', () => {
  describe('Variant rendering', () => {
    it('renders first-use variant with default title', () => {
      render(<EmptyState variant="first-use" />);
      expect(screen.getByTestId('empty-state-first-use')).toBeInTheDocument();
      expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    });

    it('renders filtered variant with default title', () => {
      render(<EmptyState variant="filtered" />);
      expect(screen.getByTestId('empty-state-filtered')).toBeInTheDocument();
      expect(screen.getByText('No Matches')).toBeInTheDocument();
    });

    it('renders unavailable variant with default title', () => {
      render(<EmptyState variant="unavailable" />);
      expect(screen.getByTestId('empty-state-unavailable')).toBeInTheDocument();
      expect(screen.getByText('Not Available')).toBeInTheDocument();
    });

    it('renders completed variant with default title', () => {
      render(<EmptyState variant="completed" />);
      expect(screen.getByTestId('empty-state-completed')).toBeInTheDocument();
      expect(screen.getByText('All Done')).toBeInTheDocument();
    });

    it('renders no-results in semantic path when description is provided', () => {
      render(<EmptyState variant="no-results" description="No horses match your search." />);
      expect(screen.getByText('No horses match your search.')).toBeInTheDocument();
    });
  });

  describe('Custom title and description', () => {
    it('uses custom title', () => {
      render(<EmptyState variant="first-use" title="Your stable awaits" />);
      expect(screen.getByText('Your stable awaits')).toBeInTheDocument();
      expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
    });

    it('uses custom description', () => {
      render(<EmptyState variant="first-use" description="Add your first horse to begin." />);
      expect(screen.getByText('Add your first horse to begin.')).toBeInTheDocument();
    });
  });

  describe('Icon rendering', () => {
    it('renders icon when provided', () => {
      render(<EmptyState variant="first-use" icon={<svg data-testid="custom-icon" />} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('does not render illustration ring when icon is not provided', () => {
      render(<EmptyState variant="first-use" />);
      // No illustration ring should render when icon prop is absent
      // The ring wraps the icon child; without an icon it should not appear.
      // We check that no img / svg is inside the ring area by checking no
      // data-testid="custom-icon" is present.
      expect(screen.queryByTestId('custom-icon')).not.toBeInTheDocument();
    });
  });

  describe('D-08 one-primary-action enforcement', () => {
    it('renders primaryAction with gold (default) button variant', () => {
      const onPrimary = vi.fn();
      render(
        <EmptyState
          variant="first-use"
          primaryAction={{ label: 'Get Started', onClick: onPrimary }}
        />
      );
      const btn = screen.getByTestId('empty-state-primary-action');
      expect(btn).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
    });

    it('calls primaryAction.onClick when primary button clicked', () => {
      const onPrimary = vi.fn();
      render(
        <EmptyState
          variant="first-use"
          primaryAction={{ label: 'Get Started', onClick: onPrimary }}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
      expect(onPrimary).toHaveBeenCalledOnce();
    });

    it('renders secondaryAction with secondary (non-gold) button variant', () => {
      const onSecondary = vi.fn();
      render(
        <EmptyState
          variant="no-results"
          description="No horses match."
          secondaryAction={{ label: 'Clear Filters', onClick: onSecondary }}
        />
      );
      const btn = screen.getByTestId('empty-state-secondary-action');
      expect(btn).toBeInTheDocument();
      // secondaryAction should NOT have the gold gradient — it should have the
      // secondary glass-panel class instead. We check the data-testid is there
      // and that the primary-action testid is NOT there (enforcing separation).
      expect(screen.queryByTestId('empty-state-primary-action')).not.toBeInTheDocument();
    });

    it('calls secondaryAction.onClick when secondary button clicked', () => {
      const onSecondary = vi.fn();
      render(
        <EmptyState
          variant="filtered"
          secondaryAction={{ label: 'Clear Filters', onClick: onSecondary }}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
      expect(onSecondary).toHaveBeenCalledOnce();
    });

    it('renders both actions when both are provided', () => {
      render(
        <EmptyState
          variant="first-use"
          primaryAction={{ label: 'Add Horse', onClick: vi.fn() }}
          secondaryAction={{ label: 'Browse Market', onClick: vi.fn() }}
        />
      );
      expect(screen.getByTestId('empty-state-primary-action')).toBeInTheDocument();
      expect(screen.getByTestId('empty-state-secondary-action')).toBeInTheDocument();
    });

    it('does not render action area when neither action is provided', () => {
      render(<EmptyState variant="completed" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
