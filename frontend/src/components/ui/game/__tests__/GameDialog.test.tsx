/**
 * GameDialog — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import {
  GameDialog,
  GameDialogTrigger,
  GameDialogContent,
  GameDialogTitle,
  GameDialogDescription,
} from '../GameDialog';

describe('GameDialog', () => {
  it('(a) dialog content has glass-panel-heavy class when open', async () => {
    const user = userEvent.setup();
    render(
      <GameDialog>
        <GameDialogTrigger>Open</GameDialogTrigger>
        <GameDialogContent data-testid="dlg-content">
          <GameDialogTitle>Dialog Title</GameDialogTitle>
          <GameDialogDescription>Description</GameDialogDescription>
        </GameDialogContent>
      </GameDialog>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('dlg-content').className).toContain('glass-panel-heavy');
  });

  it('(c) dialog is open after trigger click', async () => {
    const user = userEvent.setup();
    render(
      <GameDialog>
        <GameDialogTrigger>Open</GameDialogTrigger>
        <GameDialogContent>
          <GameDialogTitle>My Dialog</GameDialogTitle>
          <GameDialogDescription>Info</GameDialogDescription>
        </GameDialogContent>
      </GameDialog>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('(b) Escape key closes the dialog', async () => {
    const user = userEvent.setup();
    render(
      <GameDialog>
        <GameDialogTrigger>Open</GameDialogTrigger>
        <GameDialogContent>
          <GameDialogTitle>My Dialog</GameDialogTitle>
          <GameDialogDescription>Info</GameDialogDescription>
        </GameDialogContent>
      </GameDialog>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
