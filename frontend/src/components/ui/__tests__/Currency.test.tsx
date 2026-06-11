/**
 * Currency component tests (Equoria-o5hub.14 / DECISIONS.md §9)
 *
 * Coverage:
 *  - standard variant formatting (grouping, truncation, small/large numbers)
 *  - compact variant threshold boundary: 9,999 renders full, 10,000 renders compact
 *  - signed variant: +/− prefix, success/danger class presence
 *  - balance variant: font-semibold, gold colour class, stat-size class token
 *  - icon presence/absence via showIcon prop
 *  - aria-label text (always "N coins" using full number)
 *  - non-finite guard: NaN, Infinity, -Infinity → em-dash + "unknown amount"
 *  - negative amounts in standard and compact
 *  - className forwarding
 *  - data-testid present on root span
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Currency from '../Currency';

// ---------------------------------------------------------------------------
// Standard variant
// ---------------------------------------------------------------------------
describe('Currency — standard variant', () => {
  it('formats zero correctly', () => {
    render(<Currency amount={0} />);
    expect(screen.getByTestId('currency')).toHaveTextContent('0');
    expect(screen.getByTestId('currency')).toHaveAttribute('aria-label', '0 coins');
  });

  it('formats a three-digit amount without comma', () => {
    render(<Currency amount={999} />);
    expect(screen.getByTestId('currency')).toHaveTextContent('999');
  });

  it('formats a four-digit amount with comma separator', () => {
    render(<Currency amount={1234} />);
    expect(screen.getByTestId('currency')).toHaveTextContent('1,234');
  });

  it('formats a large amount with multiple commas', () => {
    render(<Currency amount={1234567} />);
    expect(screen.getByTestId('currency')).toHaveTextContent('1,234,567');
    expect(screen.getByTestId('currency')).toHaveAttribute('aria-label', '1,234,567 coins');
  });

  it('truncates decimals (in-game currency is whole numbers)', () => {
    render(<Currency amount={12345.9} />);
    expect(screen.getByTestId('currency')).toHaveTextContent('12,345');
  });

  it('formats a negative amount with minus sign', () => {
    render(<Currency amount={-500} />);
    const text = screen.getByTestId('currency').textContent ?? '';
    expect(text).toContain('500');
    // Intl negative format includes a minus sign
    expect(text).toMatch(/-|−/);
  });

  it('defaults to standard variant when variant prop is omitted', () => {
    render(<Currency amount={5000} />);
    expect(screen.getByTestId('currency')).toHaveTextContent('5,000');
  });
});

// ---------------------------------------------------------------------------
// Compact variant — threshold boundary tests
// ---------------------------------------------------------------------------
describe('Currency — compact variant', () => {
  it('renders full digits for amount = 9,999 (below compact threshold)', () => {
    render(<Currency amount={9999} variant="compact" />);
    // Full formatting for < 10,000
    expect(screen.getByTestId('currency')).toHaveTextContent('9,999');
  });

  it('renders compact notation for amount = 10,000 (at compact threshold)', () => {
    render(<Currency amount={10000} variant="compact" />);
    // 10,000 should compact to "10K"
    const text = screen.getByTestId('currency').textContent ?? '';
    expect(text).toMatch(/10K|10k/i);
  });

  it('renders compact notation for amount = 12,345 (above compact threshold)', () => {
    render(<Currency amount={12345} variant="compact" />);
    const text = screen.getByTestId('currency').textContent ?? '';
    // Should be "12.3K" in en-US compact
    expect(text).toMatch(/12(\.|,)?3K|12K/i);
  });

  it('renders compact notation for a million', () => {
    render(<Currency amount={1_500_000} variant="compact" />);
    const text = screen.getByTestId('currency').textContent ?? '';
    expect(text).toMatch(/1(\.|,)?5M|1M/i);
  });

  it('aria-label always shows full standard number regardless of compact display', () => {
    render(<Currency amount={12345} variant="compact" />);
    expect(screen.getByTestId('currency')).toHaveAttribute('aria-label', '12,345 coins');
  });

  it('does not apply role-colour classes on compact variant', () => {
    render(<Currency amount={12345} variant="compact" />);
    const el = screen.getByTestId('currency');
    expect(el.className).not.toContain('role-success');
    expect(el.className).not.toContain('role-danger');
  });
});

// ---------------------------------------------------------------------------
// Signed variant — +/− and role colours
// ---------------------------------------------------------------------------
describe('Currency — signed variant', () => {
  it('positive amount gets + prefix and success colour class', () => {
    render(<Currency amount={500} variant="signed" />);
    const el = screen.getByTestId('currency');
    const text = el.textContent ?? '';
    expect(text).toContain('+');
    expect(text).toContain('500');
    // Success role colour via CSS variable class
    expect(el.className).toContain('role-success-text');
  });

  it('zero gets + prefix and success colour class', () => {
    render(<Currency amount={0} variant="signed" />);
    const el = screen.getByTestId('currency');
    expect(el.textContent).toContain('+');
    expect(el.className).toContain('role-success-text');
  });

  it('negative amount gets − sign and danger colour class (no extra − from prefix)', () => {
    render(<Currency amount={-250} variant="signed" />);
    const el = screen.getByTestId('currency');
    const text = el.textContent ?? '';
    // Should show a minus sign (from Intl) and the amount
    expect(text).toMatch(/-|−/);
    expect(text).toContain('250');
    // Danger role colour via CSS variable class
    expect(el.className).toContain('role-danger-text');
    // Must NOT have the success class
    expect(el.className).not.toContain('role-success-text');
  });

  it('signed variant does not add + prefix to negative (prefix is empty, Intl provides −)', () => {
    render(<Currency amount={-100} variant="signed" />);
    // The component sets prefix='' for negative; Intl.NumberFormat inserts −
    const text = screen.getByTestId('currency').textContent ?? '';
    // Should NOT have double-minus
    const minusCount = (text.match(/-/g) ?? []).length + (text.match(/−/g) ?? []).length;
    expect(minusCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Balance variant
// ---------------------------------------------------------------------------
describe('Currency — balance variant', () => {
  it('renders the amount with full standard formatting', () => {
    render(<Currency amount={7890} variant="balance" />);
    expect(screen.getByTestId('currency')).toHaveTextContent('7,890');
  });

  it('applies font-semibold class', () => {
    render(<Currency amount={7890} variant="balance" />);
    expect(screen.getByTestId('currency').className).toContain('font-semibold');
  });

  it('applies the gold-light colour class', () => {
    render(<Currency amount={7890} variant="balance" />);
    expect(screen.getByTestId('currency').className).toContain('gold-light');
  });

  it('applies the --text-stat size class', () => {
    render(<Currency amount={7890} variant="balance" />);
    expect(screen.getByTestId('currency').className).toContain('text-stat');
  });

  it('does not apply role success/danger colour classes', () => {
    render(<Currency amount={7890} variant="balance" />);
    const cls = screen.getByTestId('currency').className;
    expect(cls).not.toContain('role-success');
    expect(cls).not.toContain('role-danger');
  });
});

// ---------------------------------------------------------------------------
// Icon presence / absence
// ---------------------------------------------------------------------------
describe('Currency — showIcon prop', () => {
  it('renders an icon by default (showIcon defaults to true)', () => {
    render(<Currency amount={100} />);
    // lucide-react Coins renders an svg; check aria-hidden is present
    const svgs = screen.getByTestId('currency').querySelectorAll('svg');
    expect(svgs.length).toBe(1);
    expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('icon is aria-hidden (not exposed to screen reader — aria-label on root instead)', () => {
    render(<Currency amount={100} />);
    const svg = screen.getByTestId('currency').querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('does NOT render an icon when showIcon={false}', () => {
    render(<Currency amount={100} showIcon={false} />);
    const svgs = screen.getByTestId('currency').querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Accessibility — aria-label
// ---------------------------------------------------------------------------
describe('Currency — accessibility', () => {
  it('aria-label is always full standard number + "coins"', () => {
    render(<Currency amount={42000} variant="compact" />);
    // compact display might show "42K" but aria-label must read the full amount
    expect(screen.getByTestId('currency')).toHaveAttribute('aria-label', '42,000 coins');
  });

  it('aria-label for balance variant uses full standard formatting', () => {
    render(<Currency amount={1000} variant="balance" />);
    expect(screen.getByTestId('currency')).toHaveAttribute('aria-label', '1,000 coins');
  });

  it('root element is a span (inline, not a block element)', () => {
    render(<Currency amount={100} />);
    expect(screen.getByTestId('currency').tagName.toLowerCase()).toBe('span');
  });
});

// ---------------------------------------------------------------------------
// Non-finite guard
// ---------------------------------------------------------------------------
describe('Currency — non-finite input guard', () => {
  it('renders em-dash for NaN', () => {
    render(<Currency amount={NaN} />);
    const el = screen.getByTestId('currency');
    expect(el.textContent).toContain('—');
    expect(el).toHaveAttribute('aria-label', 'unknown amount');
  });

  it('renders em-dash for Infinity', () => {
    render(<Currency amount={Infinity} />);
    const el = screen.getByTestId('currency');
    expect(el.textContent).toContain('—');
    expect(el).toHaveAttribute('aria-label', 'unknown amount');
  });

  it('renders em-dash for -Infinity', () => {
    render(<Currency amount={-Infinity} />);
    const el = screen.getByTestId('currency');
    expect(el.textContent).toContain('—');
    expect(el).toHaveAttribute('aria-label', 'unknown amount');
  });

  it('still shows icon for NaN when showIcon is true (default)', () => {
    render(<Currency amount={NaN} />);
    const svgs = screen.getByTestId('currency').querySelectorAll('svg');
    expect(svgs.length).toBe(1);
  });

  it('hides icon for NaN when showIcon={false}', () => {
    render(<Currency amount={NaN} showIcon={false} />);
    const svgs = screen.getByTestId('currency').querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// className forwarding + data-testid
// ---------------------------------------------------------------------------
describe('Currency — className and testid', () => {
  it('merges additional className onto root span', () => {
    render(<Currency amount={100} className="mt-2 text-right" />);
    const el = screen.getByTestId('currency');
    expect(el.className).toContain('mt-2');
    expect(el.className).toContain('text-right');
  });

  it('data-testid is present on root span', () => {
    render(<Currency amount={100} />);
    expect(screen.getByTestId('currency')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// zeroLabel prop (Equoria-o5hub ratchet — replaces page-local Free-wrappers)
// ---------------------------------------------------------------------------
describe('Currency — zeroLabel prop', () => {
  it('renders the zeroLabel instead of icon + 0 when amount is 0', () => {
    render(<Currency amount={0} zeroLabel="Free" />);
    const el = screen.getByTestId('currency');
    expect(el).toHaveTextContent('Free');
    expect(el.textContent).not.toContain('0');
    // No coin icon in the zeroLabel branch
    expect(el.querySelectorAll('svg').length).toBe(0);
  });

  it('does not apply the zeroLabel for non-zero amounts', () => {
    render(<Currency amount={150} zeroLabel="Free" />);
    const el = screen.getByTestId('currency');
    expect(el).toHaveTextContent('150');
    expect(el.textContent).not.toContain('Free');
  });

  it('zero without zeroLabel renders icon + "0" unchanged (existing consumers)', () => {
    render(<Currency amount={0} />);
    const el = screen.getByTestId('currency');
    expect(el).toHaveTextContent('0');
    expect(el).toHaveAttribute('aria-label', '0 coins');
    expect(el.querySelectorAll('svg').length).toBe(1);
  });

  it('non-finite amounts still render the em-dash guard, not the zeroLabel', () => {
    render(<Currency amount={NaN} zeroLabel="Free" />);
    const el = screen.getByTestId('currency');
    expect(el).toHaveAttribute('aria-label', 'unknown amount');
    expect(el.textContent).not.toContain('Free');
  });

  it('forwards className in the zeroLabel branch', () => {
    render(<Currency amount={0} zeroLabel="Free" className="mt-1" />);
    expect(screen.getByTestId('currency').className).toContain('mt-1');
  });
});
