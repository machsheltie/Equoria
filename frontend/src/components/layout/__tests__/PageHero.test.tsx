/**
 * PageHero — location header tests (DECISIONS.md §2, D-20 split ruling,
 * Equoria-ds4c9).
 *
 * Verifies the restored ceremonial treatment and the parts that stay removed:
 * - gilt icon container renders with the ruling's treatment classes
 *   (46px, 45% gold border, 14% gold fill, resting --glow-gold, --radius-md,
 *   icon in --gold-light) and is absent when no icon is passed
 * - gold gradient divider renders beneath the title block and consumes
 *   --gradient-gold-divider (NOT --gradient-gold-accent, which stays
 *   reserved for buttons/badges)
 * - ambient mood orbs stay removed: no orb elements in the DOM
 * - deprecated `mood` prop remains accepted as a no-op
 * - title/subtitle/children/backgroundImage behavior unchanged for consumers
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageHero from '../PageHero';

describe('PageHero — title and subtitle', () => {
  it('renders title as an h1', () => {
    render(<PageHero title="The Farrier" />);
    expect(screen.getByRole('heading', { level: 1, name: 'The Farrier' })).toBeInTheDocument();
  });

  it('renders subtitle when provided and omits it otherwise', () => {
    const { rerender, container } = render(
      <PageHero title="Vet Clinic" subtitle="Health checks for your horses" />
    );
    expect(screen.getByText('Health checks for your horses')).toBeInTheDocument();
    rerender(<PageHero title="Vet Clinic" />);
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('PageHero — gilt icon container (D-20 split ruling)', () => {
  it('renders the icon inside the gilt container with the ruling treatment', () => {
    render(<PageHero title="Tack Shop" icon={<span data-testid="my-icon">★</span>} />);
    const iconBox = screen.getByTestId('page-hero-icon');
    expect(iconBox).toContainElement(screen.getByTestId('my-icon'));
    // 46px square
    expect(iconBox.className).toContain('w-[46px]');
    expect(iconBox.className).toContain('h-[46px]');
    // gold border at 45% — 0.45 has no exact token (0.40 is --btn-gold-border)
    expect(iconBox.className).toContain('border-[rgba(200,168,78,0.45)]');
    // 14% gold fill
    expect(iconBox.className).toContain('bg-[rgba(200,168,78,0.14)]');
    // resting gold glow
    expect(iconBox.className).toContain('shadow-[var(--glow-gold)]');
    // --radius-md
    expect(iconBox.className).toContain('rounded-[var(--radius-md)]');
    // icon rendered in --gold-light
    expect(iconBox.className).toContain('text-[var(--gold-light)]');
  });

  it('is decorative (aria-hidden) and absent when no icon is passed', () => {
    const { rerender } = render(<PageHero title="Tack Shop" icon={<span>★</span>} />);
    expect(screen.getByTestId('page-hero-icon')).toHaveAttribute('aria-hidden', 'true');
    rerender(<PageHero title="Tack Shop" />);
    expect(screen.queryByTestId('page-hero-icon')).toBeNull();
  });
});

describe('PageHero — gold gradient divider (D-20 split ruling)', () => {
  it('renders a 2px divider beneath the title block', () => {
    render(<PageHero title="Feed Shop" />);
    const divider = screen.getByTestId('page-hero-divider');
    expect(divider.className).toContain('h-[2px]');
    expect(divider).toHaveAttribute('aria-hidden', 'true');
  });

  it('consumes --gradient-gold-divider, not the reserved --gradient-gold-accent', () => {
    render(<PageHero title="Feed Shop" />);
    const divider = screen.getByTestId('page-hero-divider');
    expect(divider.style.background).toContain('var(--gradient-gold-divider)');
    expect(divider.style.background).not.toContain('var(--gradient-gold-accent)');
  });
});

describe('PageHero — ambient mood orbs stay removed', () => {
  it('renders no orb elements (no radial-gradient decoration layers) in the DOM', () => {
    const { container } = render(
      <PageHero title="World" subtitle="Explore" icon={<span>★</span>} mood="golden" />
    );
    const inlineStyled = Array.from(container.querySelectorAll<HTMLElement>('[style]'));
    for (const el of inlineStyled) {
      expect(el.getAttribute('style') ?? '').not.toContain('radial-gradient');
    }
  });

  it('accepts the deprecated mood prop as a no-op — identical markup for every mood', () => {
    const moods = ['default', 'golden', 'mystic', 'competitive', 'nature'] as const;
    const { container: base } = render(<PageHero title="Hub" icon={<span>★</span>} />);
    for (const mood of moods) {
      const { container } = render(<PageHero title="Hub" icon={<span>★</span>} mood={mood} />);
      expect(container.innerHTML).toBe(base.innerHTML);
    }
  });
});

describe('PageHero — backgroundImage scrim (contrast backing unchanged)', () => {
  it('renders the image layer and the darkening scrim when backgroundImage is set', () => {
    const { container } = render(
      <PageHero title="The Farrier" subtitle="Hoof care" backgroundImage="/images/farriershop.webp" />
    );
    const inlineStyled = Array.from(container.querySelectorAll<HTMLElement>('[style]'));
    const imageLayer = inlineStyled.find((el) =>
      (el.getAttribute('style') ?? '').includes('farriershop.webp')
    );
    expect(imageLayer).toBeDefined();
    // jsdom serializes rgba with spaces — match both forms
    const scrim = inlineStyled.find((el) =>
      /rgba\(5,\s*12,\s*30,\s*0\.85\)/.test(el.getAttribute('style') ?? '')
    );
    expect(scrim).toBeDefined();
  });

  it('renders no image layer or scrim without backgroundImage', () => {
    const { container } = render(<PageHero title="The Farrier" />);
    const styles = Array.from(container.querySelectorAll<HTMLElement>('[style]')).map(
      (el) => el.getAttribute('style') ?? ''
    );
    expect(styles.some((s) => s.includes('url('))).toBe(false);
    expect(styles.some((s) => /rgba\(5,\s*12,\s*30/.test(s))).toBe(false);
  });
});

describe('PageHero — children slot', () => {
  it('renders children (e.g. breadcrumbs) below the divider', () => {
    render(
      <PageHero title="Vet Clinic">
        <nav aria-label="Breadcrumb">World</nav>
      </PageHero>
    );
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
    // Divider precedes children in document order
    const divider = screen.getByTestId('page-hero-divider');
    const crumbs = screen.getByLabelText('Breadcrumb');
    expect(divider.compareDocumentPosition(crumbs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
