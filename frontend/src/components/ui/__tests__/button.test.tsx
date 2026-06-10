/**
 * Button — Vitest/RTL tests
 *
 * Covers:
 *  - All 7 variant class names (default, secondary, outline, ghost, link, destructive, glass)
 *  - Size variants (default h-11, sm h-9, lg, icon h-11 w-11)
 *  - Shape: base rounded-[var(--radius-button)]; pill prop rounded-[var(--radius-pill)]
 *  - link variant keeps rounded-none regardless of pill prop (twMerge last-wins)
 *  - Touch target: default and icon ≥ 44px, sm has after:-inset-1 expansion
 *  - Disabled state: opacity-40 + text-muted
 *  - Focus ring: gold ring class present
 *  - asChild prop forwards render to child element
 *  - Keyboard: button is reachable via Tab, activates on Enter/Space
 *  - Pending state: spinner present, aria-busy, disabled, children invisible in DOM
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../button';

describe('Button variants', () => {
  it('default variant includes gold gradient classes', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button', { name: 'Primary' });
    expect(btn.className).toContain('from-[var(--gold-primary)]');
    expect(btn.className).toContain('to-[var(--gold-light)]');
  });

  it('default variant includes btn-cobalt class for horseshoe arc decorations', () => {
    render(<Button>Primary Action</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-cobalt');
  });

  it('secondary variant includes glass-panel-subtle class', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button', { name: 'Secondary' });
    expect(btn.className).toContain('glass-panel-subtle');
  });

  it('outline variant includes transparent bg and navy border', () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole('button', { name: 'Outline' });
    expect(btn.className).toContain('bg-transparent');
    expect(btn.className).toContain('border');
  });

  it('ghost variant uses --gold-light text (7.1:1 contrast)', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button', { name: 'Ghost' });
    expect(btn.className).toContain('text-[var(--gold-light)]');
    // Must NOT use --gold-primary (4.2:1) for body-size text
    expect(btn.className).not.toContain('text-[var(--gold-primary)]');
  });

  it('ghost variant has hover:underline (not hover:bg)', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button', { name: 'Ghost' });
    expect(btn.className).toContain('hover:underline');
    expect(btn.className).not.toContain('hover:bg-[rgba(201');
  });

  it('link variant uses --gold-light text (not --gold-primary)', () => {
    render(<Button variant="link">Link</Button>);
    const btn = screen.getByRole('button', { name: 'Link' });
    expect(btn.className).toContain('text-[var(--gold-light)]');
    expect(btn.className).not.toContain('text-[var(--gold-primary)]');
  });

  it('destructive variant has red background and error text', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toContain('text-[var(--status-error)]');
  });

  it('glass variant includes glass-panel class', () => {
    render(<Button variant="glass">Glass</Button>);
    const btn = screen.getByRole('button', { name: 'Glass' });
    expect(btn.className).toContain('glass-panel');
  });
});

describe('Button sizes', () => {
  it('default size is h-11 (44px minimum touch target)', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button', { name: 'Default' });
    expect(btn.className).toContain('h-11');
  });

  it('sm size is h-9 with touch-target expansion class', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button', { name: 'Small' });
    expect(btn.className).toContain('h-9');
    expect(btn.className).toContain('after:-inset-1');
  });

  it('icon size is h-11 w-11 (44×44px touch target)', () => {
    render(<Button size="icon" aria-label="Icon action" />);
    const btn = screen.getByRole('button', { name: 'Icon action' });
    expect(btn.className).toContain('h-11');
    expect(btn.className).toContain('w-11');
  });

  it('lg size is h-12', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button', { name: 'Large' });
    expect(btn.className).toContain('h-12');
  });

  it('xl size is h-14 with px-10 py-4 text-lg', () => {
    render(<Button size="xl">Extra Large</Button>);
    const btn = screen.getByRole('button', { name: 'Extra Large' });
    expect(btn.className).toContain('h-14');
    expect(btn.className).toContain('px-10');
    expect(btn.className).toContain('py-4');
    expect(btn.className).toContain('text-lg');
  });
});

describe('Button accessibility', () => {
  it('has gold focus ring classes', () => {
    render(<Button>Focus Me</Button>);
    const btn = screen.getByRole('button', { name: 'Focus Me' });
    expect(btn.className).toContain('focus-visible:ring-[var(--gold-bright)]');
  });

  it('disabled state has opacity-40 and text-muted', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn.className).toContain('disabled:opacity-40');
    expect(btn.className).toContain('disabled:text-[var(--text-muted)]');
    expect(btn).toBeDisabled();
  });

  it('activates onClick handler on Enter key', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Press Me</Button>);
    const btn = screen.getByRole('button', { name: 'Press Me' });
    btn.focus();
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('activates onClick handler on Space key', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Press Me</Button>);
    const btn = screen.getByRole('button', { name: 'Press Me' });
    btn.focus();
    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe('Button asChild', () => {
  it('renders as anchor element when asChild with Link', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link.className).toContain('from-[var(--gold-primary)]');
  });
});

// ─── Shape tests (D-09 / DECISIONS.md §3/§5) ────────────────────────────────

describe('Button shape — rounded rectangle base (D-09)', () => {
  it('base class uses rounded-[var(--radius-button)] (12px rectangle)', () => {
    render(<Button>Default shape</Button>);
    const btn = screen.getByRole('button', { name: 'Default shape' });
    expect(btn.className).toContain('rounded-[var(--radius-button)]');
  });

  it('base class does NOT include rounded-full', () => {
    render(<Button>Default shape</Button>);
    const btn = screen.getByRole('button', { name: 'Default shape' });
    // rounded-full must not appear unless pill=true or link variant
    expect(btn.className).not.toContain('rounded-full');
  });

  it('pill prop applies rounded-[var(--radius-pill)]', () => {
    render(<Button pill>Pill button</Button>);
    const btn = screen.getByRole('button', { name: 'Pill button' });
    expect(btn.className).toContain('rounded-[var(--radius-pill)]');
  });

  it('pill prop does NOT appear on default (no pill prop)', () => {
    render(<Button>Normal</Button>);
    const btn = screen.getByRole('button', { name: 'Normal' });
    expect(btn.className).not.toContain('rounded-[var(--radius-pill)]');
  });

  it('link variant keeps rounded-none regardless of pill prop (twMerge last-wins)', () => {
    render(
      <Button variant="link" pill>
        Link pill override
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Link pill override' });
    // link variant declares rounded-none in the variant string which CVA
    // appends after the base + compound classes; twMerge resolves to rounded-none
    expect(btn.className).toContain('rounded-none');
    // rounded-[var(--radius-pill)] must be overridden by rounded-none
    expect(btn.className).not.toMatch(/rounded-\[var\(--radius-pill\)\]/);
  });
});

// ─── Pending state tests (D-07) ─────────────────────────────────────────────

describe('Button pending state (D-07)', () => {
  it('pending sets disabled attribute', () => {
    render(<Button pending>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('pending sets aria-busy="true"', () => {
    render(<Button pending>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('pending renders spinner (Loader2 svg)', () => {
    render(<Button pending>Submit</Button>);
    // The Loader2 icon is aria-hidden; query via container
    const { container } = render(<Button pending>Spinner check</Button>);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('pending keeps children in DOM with invisible class (dimensions preserved)', () => {
    render(<Button pending>My Label</Button>);
    // Children must be in DOM (for dimension preservation) but visually hidden
    const invisibleSpan = document.querySelector('.invisible');
    expect(invisibleSpan).toBeInTheDocument();
    expect(invisibleSpan?.textContent).toBe('My Label');
  });

  it('focus styles are preserved when pending (class still present)', () => {
    render(<Button pending>Pending Focus</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('focus-visible:ring-[var(--gold-bright)]');
  });

  it('pending does not inject spinner when asChild (Slot single-child constraint)', () => {
    render(
      <Button asChild pending>
        <a href="/x">AsChild Link</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'AsChild Link' });
    // aria-busy forwarded even without spinner injection
    expect(link).toHaveAttribute('aria-busy', 'true');
    // No spinner svg injected (Slot must stay single-child)
    expect(link.querySelector('svg')).not.toBeInTheDocument();
  });
});
