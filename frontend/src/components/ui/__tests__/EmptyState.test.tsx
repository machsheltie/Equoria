/**
 * EmptyState Component Tests
 *
 * Tests the 4 variant empty states with icons, titles, subtitles, and CTA.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock lucide-react to avoid missing icon issues
vi.mock('lucide-react', () => ({
  Horse: (props: any) => <svg data-testid="icon-horse" {...props} />,
  Trophy: (props: any) => <svg data-testid="icon-trophy" {...props} />,
  MessageSquare: (props: any) => <svg data-testid="icon-message" {...props} />,
  SearchX: (props: any) => <svg data-testid="icon-search" {...props} />,
}));

import { EmptyState, type EmptyVariant } from '../EmptyState';

describe('EmptyState', () => {
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

    it('renders no-results variant with default title', () => {
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

  describe('CTA button', () => {
    it('renders CTA button when action is provided', () => {
      const onClick = vi.fn();
      render(
        <EmptyState
          variant="no-horses"
          action={{ label: 'Browse Horses', onClick }}
        />
      );
      const button = screen.getByRole('button', { name: 'Browse Horses' });
      expect(button).toBeInTheDocument();
    });

    it('calls onClick when CTA is clicked', () => {
      const onClick = vi.fn();
      render(
        <EmptyState
          variant="no-horses"
          action={{ label: 'Browse Horses', onClick }}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Browse Horses' }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not render CTA when action is not provided', () => {
      render(<EmptyState variant="no-horses" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
