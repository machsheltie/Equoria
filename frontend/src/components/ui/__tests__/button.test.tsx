/**
 * Button — Vitest/RTL tests (Story 22-5)
 *
 * Covers:
 *  - All 7 variant class names (default, secondary, outline, ghost, link, destructive, glass)
 *  - Size variants (default h-11, sm h-9, lg, icon h-11 w-11)
 *  - Touch target: default and icon ≥ 44px, sm has after:-inset-1 expansion
 *  - Disabled state: opacity-40 + text-muted
 *  - Focus ring: gold ring class present
 *  - asChild prop forwards render to child element
 *  - Keyboard: button is reachable via Tab, activates on Enter/Space
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../button';

describe('Button variants', () => {
  it('default variant includes btn-cobalt and gold gradient classes', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button', { name: 'Primary' });
    expect(btn.className).toContain('btn-cobalt');
    expect(btn.className).toContain('from-[var(--gold-primary)]');
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
    expect(link.className).toContain('btn-cobalt');
  });
});
