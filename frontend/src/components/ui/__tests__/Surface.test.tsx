/**
 * Surface component tests (Equoria-o5hub.7 / DECISIONS.md §4)
 *
 * Covers:
 *  - variant → CSS class mapping for all 5 variants
 *  - default variant is 'panel'
 *  - `as` prop polymorphism (div default, button, a)
 *  - className merge via cn()
 *  - children render
 *  - data-testid default ('surface') and override
 *  - spread rest props forwarded to the rendered element
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Surface } from '../Surface';

describe('Surface — variant → class mapping', () => {
  it('page variant renders with no glass class', () => {
    render(<Surface variant="page">Content</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.className).not.toContain('glass-panel');
    expect(el.className.trim()).toBe('');
  });

  it('panel variant (default) renders glass-panel class', () => {
    render(<Surface>Content</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.className).toContain('glass-panel');
    expect(el.className).not.toContain('glass-panel-interactive');
  });

  it('subtle variant renders glass-panel-subtle class (no base glass-panel)', () => {
    render(<Surface variant="subtle">Content</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.className).toContain('glass-panel-subtle');
    // subtle must NOT have the blur-capable base class
    expect(el.className).not.toContain('glass-panel ');
    expect(el.className).not.toMatch(/^glass-panel$/);
  });

  it('interactive variant renders both glass-panel and glass-panel-interactive', () => {
    render(<Surface variant="interactive">Content</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.className).toContain('glass-panel');
    expect(el.className).toContain('glass-panel-interactive');
  });

  it('overlay variant renders glass-panel-heavy class', () => {
    render(<Surface variant="overlay">Content</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.className).toContain('glass-panel-heavy');
    expect(el.className).not.toContain('glass-panel-interactive');
  });

  it('panel is the default variant', () => {
    render(<Surface>Default</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.className).toContain('glass-panel');
    expect(el.className).not.toContain('glass-panel-heavy');
    expect(el.className).not.toContain('glass-panel-interactive');
  });
});

describe('Surface — `as` prop polymorphism', () => {
  it('renders as div by default', () => {
    render(<Surface>Hello</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.tagName.toLowerCase()).toBe('div');
  });

  it('renders as button when as="button"', () => {
    render(<Surface as="button">Click</Surface>);
    const el = screen.getByTestId('surface');
    expect(el.tagName.toLowerCase()).toBe('button');
  });

  it('renders as a when as="a"', () => {
    render(
      <Surface as="a" href="/horses">
        Link
      </Surface>
    );
    const el = screen.getByTestId('surface');
    expect(el.tagName.toLowerCase()).toBe('a');
    expect(el).toHaveAttribute('href', '/horses');
  });
});

describe('Surface — className merge', () => {
  it('merges additional className with variant classes', () => {
    render(
      <Surface variant="panel" className="custom-class p-4">
        Content
      </Surface>
    );
    const el = screen.getByTestId('surface');
    expect(el.className).toContain('glass-panel');
    expect(el.className).toContain('custom-class');
    expect(el.className).toContain('p-4');
  });

  it('page variant with className renders only the extra class', () => {
    render(
      <Surface variant="page" className="my-section">
        Content
      </Surface>
    );
    const el = screen.getByTestId('surface');
    expect(el.className).toBe('my-section');
  });
});

describe('Surface — children and testid', () => {
  it('renders children', () => {
    render(<Surface>Hello World</Surface>);
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('default data-testid is "surface"', () => {
    render(<Surface>Content</Surface>);
    expect(screen.getByTestId('surface')).toBeDefined();
  });

  it('custom data-testid overrides default', () => {
    render(<Surface data-testid="my-panel">Content</Surface>);
    expect(screen.getByTestId('my-panel')).toBeDefined();
    expect(() => screen.getByTestId('surface')).toThrow();
  });
});

describe('Surface — rest prop forwarding', () => {
  it('forwards aria-label to the rendered element', () => {
    render(<Surface aria-label="Horse panel">Content</Surface>);
    const el = screen.getByTestId('surface');
    expect(el).toHaveAttribute('aria-label', 'Horse panel');
  });

  it('forwards role prop', () => {
    render(
      <Surface variant="interactive" role="button" tabIndex={0}>
        Click
      </Surface>
    );
    const el = screen.getByTestId('surface');
    expect(el).toHaveAttribute('role', 'button');
    expect(el).toHaveAttribute('tabIndex', '0');
  });
});
