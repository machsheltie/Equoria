/**
 * PageHeader — layout primitive tests (DECISIONS.md §2, D-01).
 *
 * Verifies:
 * - renders h1 with correct title
 * - optional slots (subtitle, icon, actions, metadata, breadcrumbs) render
 *   when provided and are absent when omitted
 * - h1 uses var(--font-heading) and var(--text-3xl) family/size tokens
 * - root element has no px-* or max-w-* class (no own padding/width — inside PageContainer)
 * - icon renders WITHOUT a glow container (no border-[rgba], no shadow, no gradient bg)
 * - data-testid="page-header" present on root
 * - className prop merges correctly
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageHeader } from '../PageHeader';

describe('PageHeader — h1 semantics', () => {
  it('renders title as an h1', () => {
    render(<PageHeader title="My Page" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'My Page' });
    expect(h1).toBeInTheDocument();
  });

  it('h1 text content matches title prop', () => {
    render(<PageHeader title="Stables" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Stables');
  });

  it('h1 typography comes from the .type-page-title role class (Equoria-o5hub.8)', () => {
    render(<PageHeader title="Test" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    // Role class owns font-family/size/weight/color (maps to --font-heading,
    // --text-3xl in index.css); no inline style or per-component recipe.
    expect(h1.className).toMatch(/\btype-page-title\b/);
    expect(h1).not.toHaveAttribute('style');
  });
});

describe('PageHeader — subtitle slot', () => {
  it('renders subtitle when provided', () => {
    render(<PageHeader title="Settings" subtitle="Manage your account." />);
    expect(screen.getByText('Manage your account.')).toBeInTheDocument();
  });

  it('does not render subtitle element when omitted', () => {
    const { container } = render(<PageHeader title="Settings" />);
    // No <p> subtitle element
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('PageHeader — icon slot', () => {
  it('renders icon when provided', () => {
    render(<PageHeader title="Test" icon={<span data-testid="my-icon">★</span>} />);
    expect(screen.getByTestId('my-icon')).toBeInTheDocument();
  });

  it('does not render icon wrapper when icon is omitted', () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.querySelector('[data-testid="page-header-icon"]')).toBeNull();
  });

  it('icon wrapper has NO border or shadow glow class (no glow container)', () => {
    render(<PageHeader title="Test" icon={<span data-testid="icon">★</span>} />);
    const iconWrapper = screen.getByTestId('page-header-icon');
    // Must not have the glow-container classes from the old PageHero icon
    expect(iconWrapper.className).not.toContain('border-[rgba');
    expect(iconWrapper.className).not.toContain('shadow-[');
    expect(iconWrapper.className).not.toContain('rounded-2xl');
  });
});

describe('PageHeader — actions slot', () => {
  it('renders actions when provided', () => {
    render(<PageHeader title="Test" actions={<button data-testid="action-btn">Save</button>} />);
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('does not render actions wrapper when omitted', () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.querySelector('[data-testid="page-header-actions"]')).toBeNull();
  });
});

describe('PageHeader — metadata slot', () => {
  it('renders metadata when provided', () => {
    render(<PageHeader title="Test" metadata={<span data-testid="meta">3 horses</span>} />);
    expect(screen.getByTestId('meta')).toBeInTheDocument();
  });

  it('does not render metadata wrapper when omitted', () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.querySelector('[data-testid="page-header-metadata"]')).toBeNull();
  });
});

describe('PageHeader — breadcrumbs slot', () => {
  it('renders breadcrumbs when provided', () => {
    render(
      <PageHeader
        title="Test"
        breadcrumbs={
          <nav aria-label="breadcrumb" data-testid="bc">
            Home &gt; Test
          </nav>
        }
      />
    );
    expect(screen.getByTestId('bc')).toBeInTheDocument();
  });

  it('does not render breadcrumbs wrapper when omitted', () => {
    const { container } = render(<PageHeader title="Test" />);
    expect(container.querySelector('[data-testid="page-header-breadcrumbs"]')).toBeNull();
  });
});

describe('PageHeader — root element constraints', () => {
  it('has data-testid="page-header" on root', () => {
    render(<PageHeader title="Test" />);
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('root element has NO px-* class (gutters belong to shell)', () => {
    render(<PageHeader title="Test" />);
    const root = screen.getByTestId('page-header');
    expect(root.className).not.toMatch(/\bpx-/);
  });

  it('root element has NO max-w-* class (width constraint belongs to PageContainer)', () => {
    render(<PageHeader title="Test" />);
    const root = screen.getByTestId('page-header');
    expect(root.className).not.toMatch(/\bmax-w-/);
  });

  it('merges className prop via cn', () => {
    render(<PageHeader title="Test" className="custom-class" />);
    const root = screen.getByTestId('page-header');
    expect(root.className).toContain('custom-class');
  });
});

describe('PageHeader — long-title wrapping (handoff §6.2, Equoria-o5hub.29)', () => {
  it('h1 does NOT truncate (no silent ellipsis on long titles)', () => {
    render(<PageHeader title="A Very Long Operational Page Title That Must Wrap" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.className).not.toMatch(/\btruncate\b/);
  });

  it('h1 uses break-words so long unbroken strings wrap', () => {
    render(<PageHeader title={'Supercalifragilisticexpialidocious'.repeat(3)} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.className).toMatch(/\bbreak-words\b/);
  });

  it('long title with two actions keeps both actions rendered', () => {
    render(
      <PageHeader
        title={'Thoroughbred Champion Of The Northern Meadowlands Stable '.repeat(2)}
        actions={
          <>
            <button type="button">Primary</button>
            <button type="button">Secondary</button>
          </>
        }
      />
    );
    expect(screen.getByRole('button', { name: 'Primary' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeVisible();
    // Full title text remains in the document (not clipped from the DOM)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Thoroughbred Champion'
    );
  });
});
