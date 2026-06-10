/**
 * EntityHeader — layout primitive tests (DECISIONS.md §2, D-01).
 *
 * Verifies:
 * - renders name as h1
 * - back-link renders with ArrowLeft + label and links to correct href
 * - image slot: string src renders <img> with --radius-lg rounding; ReactNode renders as-is
 * - metadata slot renders when provided, absent when omitted
 * - actions slot renders when provided, absent when omitted
 * - root element has NO px-* or max-w-* class
 * - data-testid="entity-header" present on root
 * - className prop merges correctly
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { EntityHeader } from '../EntityHeader';

// EntityHeader uses react-router Link — wrap in MemoryRouter
function renderWith(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('EntityHeader — h1 semantics', () => {
  it('renders name as an h1', () => {
    renderWith(<EntityHeader name="Starfire" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Starfire' });
    expect(h1).toBeInTheDocument();
  });

  it('h1 text matches name prop', () => {
    renderWith(<EntityHeader name="Thunder" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Thunder');
  });

  it('uses var(--font-heading) on h1', () => {
    renderWith(<EntityHeader name="Test" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveStyle({ fontFamily: 'var(--font-heading)' });
  });
});

describe('EntityHeader — back-link slot', () => {
  it('renders back link with label text', () => {
    renderWith(
      <EntityHeader name="Foal" backLink={{ to: '/my-stable', label: 'Back to stable' }} />
    );
    expect(screen.getByText('Back to stable')).toBeInTheDocument();
  });

  it('back link points to the correct route', () => {
    renderWith(
      <EntityHeader name="Foal" backLink={{ to: '/my-stable', label: 'Back to stable' }} />
    );
    const link = screen.getByTestId('entity-header-back-link');
    expect(link).toHaveAttribute('href', '/my-stable');
  });

  it('does not render back link when omitted', () => {
    const { container } = renderWith(<EntityHeader name="Foal" />);
    expect(container.querySelector('[data-testid="entity-header-back-link"]')).toBeNull();
  });
});

describe('EntityHeader — image slot (string src)', () => {
  it('renders an <img> when image is a string', () => {
    renderWith(<EntityHeader name="Horse" image="/img/horse.png" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/img/horse.png');
  });

  it('img uses --radius-lg rounding class', () => {
    renderWith(<EntityHeader name="Horse" image="/img/horse.png" />);
    const img = screen.getByRole('img');
    expect(img.className).toContain('rounded-[var(--radius-lg)]');
  });

  it('img alt defaults to entity name when imageAlt is not given', () => {
    renderWith(<EntityHeader name="Starfire" image="/img/star.png" />);
    expect(screen.getByAltText('Starfire')).toBeInTheDocument();
  });

  it('img alt uses imageAlt prop when provided', () => {
    renderWith(<EntityHeader name="Starfire" image="/img/star.png" imageAlt="Custom alt" />);
    expect(screen.getByAltText('Custom alt')).toBeInTheDocument();
  });
});

describe('EntityHeader — image slot (ReactNode)', () => {
  it('renders custom ReactNode image as-is', () => {
    renderWith(<EntityHeader name="Horse" image={<div data-testid="custom-avatar">Avatar</div>} />);
    expect(screen.getByTestId('custom-avatar')).toBeInTheDocument();
    // No <img> element when ReactNode is used
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('EntityHeader — metadata slot', () => {
  it('renders metadata when provided', () => {
    renderWith(<EntityHeader name="Test" metadata={<span data-testid="meta-badge">Mare</span>} />);
    expect(screen.getByTestId('meta-badge')).toBeInTheDocument();
  });

  it('does not render metadata wrapper when omitted', () => {
    const { container } = renderWith(<EntityHeader name="Test" />);
    expect(container.querySelector('[data-testid="entity-header-metadata"]')).toBeNull();
  });
});

describe('EntityHeader — actions slot', () => {
  it('renders actions when provided', () => {
    renderWith(<EntityHeader name="Test" actions={<button data-testid="edit-btn">Edit</button>} />);
    expect(screen.getByTestId('edit-btn')).toBeInTheDocument();
  });

  it('does not render actions wrapper when omitted', () => {
    const { container } = renderWith(<EntityHeader name="Test" />);
    expect(container.querySelector('[data-testid="entity-header-actions"]')).toBeNull();
  });
});

describe('EntityHeader — root element constraints', () => {
  it('has data-testid="entity-header" on root', () => {
    renderWith(<EntityHeader name="Test" />);
    expect(screen.getByTestId('entity-header')).toBeInTheDocument();
  });

  it('root element has NO px-* class (gutters belong to shell)', () => {
    renderWith(<EntityHeader name="Test" />);
    const root = screen.getByTestId('entity-header');
    expect(root.className).not.toMatch(/\bpx-/);
  });

  it('root element has NO max-w-* class (width constraint belongs to PageContainer)', () => {
    renderWith(<EntityHeader name="Test" />);
    const root = screen.getByTestId('entity-header');
    expect(root.className).not.toMatch(/\bmax-w-/);
  });

  it('merges className prop via cn', () => {
    renderWith(<EntityHeader name="Test" className="my-custom" />);
    const root = screen.getByTestId('entity-header');
    expect(root.className).toContain('my-custom');
  });
});
