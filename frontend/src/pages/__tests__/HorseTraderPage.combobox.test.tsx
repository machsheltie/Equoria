/**
 * HorseTraderPage — the breed picker is an accessible combobox (Equoria-4yocc).
 *
 * The picker was a bare text input over a list of buttons: no combobox role, no
 * expanded state, no arrow-key movement, no Escape, and a list that stayed open
 * after a click elsewhere. These tests drive it the way a keyboard / screen
 * reader user does (RTL roles and keys), with the real page, hooks and
 * apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import HorseTraderPage from '../HorseTraderPage';

const BREEDS = [
  { id: 1, name: 'Thoroughbred', description: 'A fast breed' },
  { id: 2, name: 'Arabian', description: 'An endurance breed' },
  { id: 3, name: 'Warmblood', description: 'A sport breed' },
];

function renderPage() {
  server.use(
    http.get('*/api/v1/auth/profile', () =>
      HttpResponse.json({
        status: 'success',
        data: { user: { id: 1, username: 't', email: 't@e.com', role: 'user', money: 5000 } },
      })
    ),
    http.get('*/api/v1/breeds', () =>
      HttpResponse.json({ success: true, data: BREEDS, count: BREEDS.length })
    )
  );
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HorseTraderPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function readyCombobox() {
  const combobox = await screen.findByRole('combobox', { name: 'Breed' });
  await waitFor(() => expect(combobox).toBeEnabled());
  return combobox;
}

describe('HorseTraderPage breed combobox (Equoria-4yocc)', () => {
  it('announces itself as a combobox and reports whether its list is open', async () => {
    const user = userEvent.setup();
    renderPage();
    const combobox = await readyCombobox();

    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    await user.click(combobox);

    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(combobox).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Thoroughbred',
      'Arabian',
      'Warmblood',
    ]);
  });

  it('moves through the options with the arrow keys and picks one with Enter', async () => {
    const user = userEvent.setup();
    renderPage();
    const combobox = await readyCombobox();
    await user.click(combobox);

    await user.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(combobox).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(combobox).toHaveAttribute('aria-activedescendant', options[1].id);

    await user.keyboard('{Enter}');

    expect(combobox).toHaveValue('Arabian');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Selected:/)).toHaveTextContent('Arabian');
  });

  it('wraps the active option and closes on Escape without choosing', async () => {
    const user = userEvent.setup();
    renderPage();
    const combobox = await readyCombobox();
    await user.click(combobox);

    await user.keyboard('{ArrowUp}');
    const options = screen.getAllByRole('option');
    expect(combobox).toHaveAttribute('aria-activedescendant', options[2].id);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveValue('');
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
  });

  it('closes the list when the player clicks elsewhere', async () => {
    const user = userEvent.setup();
    renderPage();
    const combobox = await readyCombobox();
    await user.click(combobox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });
});
