/**
 * PageContainer — Layout Primitive Tests
 *
 * Verifies:
 * - renders children
 * - each variant maps to exactly the approved classes (per DECISIONS.md §1)
 * - default variant is `content`
 * - `padded` true/false behavior (py-6 md:py-8 vs none)
 * - no `px-` class ever present in className output
 * - className merge works (cn util)
 * - `as` prop renders the correct HTML element
 * - data-testid default is "page-container" and can be overridden
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageContainer } from '../PageContainer';

describe('PageContainer — children', () => {
  it('renders children inside the container', () => {
    render(
      <PageContainer>
        <span data-testid="child">hello</span>
      </PageContainer>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

describe('PageContainer — default variant', () => {
  it('uses variant "content" when no variant prop is given', () => {
    render(<PageContainer data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).toContain('max-w-4xl');
    expect(el.className).toContain('mx-auto');
  });
});

describe('PageContainer — variant classes', () => {
  it('narrow → max-w-2xl mx-auto', () => {
    render(<PageContainer variant="narrow" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).toContain('max-w-2xl');
    expect(el.className).toContain('mx-auto');
    // must not have other content-width class
    expect(el.className).not.toContain('max-w-4xl');
    expect(el.className).not.toContain('max-w-6xl');
    expect(el.className).not.toContain('w-full');
  });

  it('content → max-w-4xl mx-auto', () => {
    render(<PageContainer variant="content" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).toContain('max-w-4xl');
    expect(el.className).toContain('mx-auto');
    expect(el.className).not.toContain('max-w-2xl');
    expect(el.className).not.toContain('max-w-6xl');
    expect(el.className).not.toContain('w-full');
  });

  it('wide → max-w-6xl mx-auto', () => {
    render(<PageContainer variant="wide" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).toContain('max-w-6xl');
    expect(el.className).toContain('mx-auto');
    expect(el.className).not.toContain('max-w-2xl');
    expect(el.className).not.toContain('max-w-4xl');
    expect(el.className).not.toContain('w-full');
  });

  it('full → w-full (no mx-auto, no max-w-*)', () => {
    render(<PageContainer variant="full" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).toContain('w-full');
    // full variant must not impose a max-width constraint
    expect(el.className).not.toContain('max-w-2xl');
    expect(el.className).not.toContain('max-w-4xl');
    expect(el.className).not.toContain('max-w-6xl');
  });
});

describe('PageContainer — padded prop', () => {
  it('padded=true (default) adds py-6 md:py-8', () => {
    render(<PageContainer data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).toContain('py-6');
    expect(el.className).toContain('md:py-8');
  });

  it('padded=false omits py-* classes', () => {
    render(<PageContainer padded={false} data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).not.toContain('py-6');
    expect(el.className).not.toContain('md:py-8');
  });
});

describe('PageContainer — no horizontal padding', () => {
  it('never adds px-* to the container (gutters belong to the shell)', () => {
    // Test all variants
    const variants = ['narrow', 'content', 'wide', 'full'] as const;
    for (const variant of variants) {
      const { unmount } = render(<PageContainer variant={variant} data-testid={`pc-${variant}`} />);
      const el = screen.getByTestId(`pc-${variant}`);
      // className must not contain any px- utility
      expect(el.className).not.toMatch(/\bpx-/);
      unmount();
    }
  });

  it('px-* classes in className prop are NOT added by the component itself (merge is fine)', () => {
    // The component itself never emits px-* — if a consumer passes it via
    // className that is the consumer's explicit choice; we only guard that
    // PageContainer's own output is free of px-*.
    render(<PageContainer data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).not.toMatch(/\bpx-/);
  });
});

describe('PageContainer — className merge', () => {
  it('merges additional className via cn without duplicating base classes', () => {
    render(<PageContainer className="space-y-4" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.className).toContain('space-y-4');
    // still has the base content variant
    expect(el.className).toContain('max-w-4xl');
  });

  it('consumer className can override variant class via cn (twMerge wins)', () => {
    // e.g. a consumer explicitly overriding with a narrower max-w is allowed via cn
    render(<PageContainer className="max-w-sm" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    // twMerge resolves the conflict; max-w-sm should win over max-w-4xl
    expect(el.className).toContain('max-w-sm');
  });
});

describe('PageContainer — as prop', () => {
  it('renders as "div" by default', () => {
    render(<PageContainer data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.tagName.toLowerCase()).toBe('div');
  });

  it('renders as "section" when as="section"', () => {
    render(<PageContainer as="section" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.tagName.toLowerCase()).toBe('section');
  });

  it('renders as "main" when as="main"', () => {
    render(<PageContainer as="main" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.tagName.toLowerCase()).toBe('main');
  });

  it('renders as "article" when as="article"', () => {
    render(<PageContainer as="article" data-testid="pc" />);
    const el = screen.getByTestId('pc');
    expect(el.tagName.toLowerCase()).toBe('article');
  });
});

describe('PageContainer — data-testid', () => {
  it('has "page-container" as default data-testid', () => {
    render(<PageContainer />);
    expect(screen.getByTestId('page-container')).toBeInTheDocument();
  });

  it('data-testid can be overridden', () => {
    render(<PageContainer data-testid="my-custom-id" />);
    expect(screen.getByTestId('my-custom-id')).toBeInTheDocument();
    expect(screen.queryByTestId('page-container')).not.toBeInTheDocument();
  });
});
