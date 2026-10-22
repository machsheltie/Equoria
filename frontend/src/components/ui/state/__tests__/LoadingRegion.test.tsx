/**
 * LoadingRegion — the live-region wrapper for a component's own placeholder
 * (Equoria-2fzcy).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingRegion } from '../LoadingRegion';

describe('LoadingRegion', () => {
  it('is one busy, named status region around the placeholder it wraps', () => {
    render(
      <LoadingRegion label="Loading horses" className="grid" data-testid="region">
        <div data-testid="block" />
      </LoadingRegion>
    );

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveAccessibleName('Loading horses');
    expect(region).toHaveClass('grid');
    expect(region).toContainElement(screen.getByTestId('block'));
    expect(screen.getByText('Loading horses')).toHaveClass('sr-only');
  });

  it('announces on its own when there is nothing to wrap (e.g. beside table rows)', () => {
    render(<LoadingRegion label="Loading results" />);

    expect(screen.getByRole('status')).toHaveAccessibleName('Loading results');
    expect(screen.getByText('Loading results')).toHaveClass('sr-only');
  });

  it('can leave out the hidden copy when the region already shows the same words', () => {
    render(
      <LoadingRegion label="Loading competitions" announceText={false}>
        <p>Loading competitions...</p>
      </LoadingRegion>
    );

    expect(screen.getAllByText(/loading competitions/i)).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading competitions');
  });
});
