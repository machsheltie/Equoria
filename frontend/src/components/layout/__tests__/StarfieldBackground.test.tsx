/**
 * StarfieldBackground Component Tests
 *
 * Tests the pure-CSS starfield background with 3 parallax layers.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StarfieldBackground } from '../StarfieldBackground';

describe('StarfieldBackground', () => {
  it('renders with correct data-testid', () => {
    render(<StarfieldBackground />);
    expect(screen.getByTestId('starfield-background')).toBeInTheDocument();
  });

  it('has aria-hidden="true" for decorative content', () => {
    render(<StarfieldBackground />);
    expect(screen.getByTestId('starfield-background')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders 3 starfield layers (sm, md, lg)', () => {
    render(<StarfieldBackground />);
    const container = screen.getByTestId('starfield-background');
    const layers = container.querySelectorAll('.starfield-layer');
    expect(layers).toHaveLength(3);
  });

  it('has the correct layer size classes', () => {
    render(<StarfieldBackground />);
    const container = screen.getByTestId('starfield-background');
    expect(container.querySelector('.starfield-layer--sm')).toBeInTheDocument();
    expect(container.querySelector('.starfield-layer--md')).toBeInTheDocument();
    expect(container.querySelector('.starfield-layer--lg')).toBeInTheDocument();
  });

  it('has the starfield-bg wrapper class', () => {
    render(<StarfieldBackground />);
    expect(screen.getByTestId('starfield-background')).toHaveClass('starfield-bg');
  });
});
