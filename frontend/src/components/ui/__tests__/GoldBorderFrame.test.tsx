/**
 * GoldBorderFrame Component Tests
 *
 * Tests the decorative gold corner frame wrapper.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GoldBorderFrame } from '../GoldBorderFrame';

describe('GoldBorderFrame', () => {
  it('renders children inside the frame', () => {
    render(
      <GoldBorderFrame>
        <p>Hello World</p>
      </GoldBorderFrame>
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders 4 corner decorations with aria-hidden', () => {
    const { container } = render(
      <GoldBorderFrame>
        <p>Content</p>
      </GoldBorderFrame>
    );
    const corners = container.querySelectorAll('[aria-hidden="true"]');
    expect(corners).toHaveLength(4);
  });

  it('applies animated class when animated is true (default)', () => {
    const { container } = render(
      <GoldBorderFrame>
        <p>Content</p>
      </GoldBorderFrame>
    );
    const animatedCorners = container.querySelectorAll('.gold-corner-animate');
    expect(animatedCorners).toHaveLength(4);
  });

  it('does not apply animated class when animated is false', () => {
    const { container } = render(
      <GoldBorderFrame animated={false}>
        <p>Content</p>
      </GoldBorderFrame>
    );
    const animatedCorners = container.querySelectorAll('.gold-corner-animate');
    expect(animatedCorners).toHaveLength(0);
  });

  it('staggers animation delays across corners', () => {
    const { container } = render(
      <GoldBorderFrame>
        <p>Content</p>
      </GoldBorderFrame>
    );
    const corners = container.querySelectorAll('.gold-corner-animate');
    const delays = Array.from(corners).map(
      (c) => (c as HTMLElement).style.animationDelay
    );
    // Expect 4 staggered delays: 0ms, 80ms, 160ms, 240ms
    expect(delays).toEqual(['0ms', '80ms', '160ms', '240ms']);
  });

  it('applies custom className to wrapper', () => {
    const { container } = render(
      <GoldBorderFrame className="my-frame">
        <p>Content</p>
      </GoldBorderFrame>
    );
    expect(container.firstChild).toHaveClass('my-frame');
    expect(container.firstChild).toHaveClass('relative');
  });
});
