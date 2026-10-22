/**
 * A pending Button keeps its accessible name (Equoria-4yocc, acceptance:
 * "Pending buttons retain accessible labels"; FRONTEND_ASYNC_STATE_DOCTRINE
 * section 5).
 *
 * While pending, the visible label is kept in the DOM only to preserve the
 * button's size and is hidden with the `invisible` class (visibility: hidden).
 * Content hidden that way is left out of the accessible-name computation in
 * real browsers, so a screen reader announced a busy button with no name.
 * jsdom does not apply the stylesheet, so the name looks fine there; the
 * contract pinned here is that the name is also carried as an explicit
 * aria-label, which survives the hidden span.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

describe('Button pending keeps its accessible name (Equoria-4yocc)', () => {
  it('carries a string label as aria-label while pending', () => {
    render(<Button pending>Save changes</Button>);

    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute(
      'aria-label',
      'Save changes'
    );
  });

  it('collects the text of an icon-and-label child list', () => {
    render(
      <Button pending>
        <svg aria-hidden="true" />
        Buy 100 units
      </Button>
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Buy 100 units');
  });

  it('does not override a name the caller already gave', () => {
    render(
      <Button pending aria-label="Unequip Stardust saddle">
        Unequip
      </Button>
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Unequip Stardust saddle');
  });

  it('adds no aria-label when the button is not pending', () => {
    render(<Button>Save changes</Button>);

    expect(screen.getByRole('button')).not.toHaveAttribute('aria-label');
  });
});
