/**
 * StaffHorseLookup: find a horse by number or name in the Steward's Office
 * (Equoria-puj1e.5). The real hook over the real apiClient; MSW stubs the HTTP
 * boundary only.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffHorseLookup from '../StaffHorseLookup';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const LOOKUP = `${base}/api/v1/staff/horses/lookup`;

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mare = {
  id: 42,
  name: 'Moonlit Comet',
  sex: 'Mare',
  ownerUsername: 'starrider',
  dateOfBirth: '2026-10-11',
  age: 5,
  retired: false,
  pregnancy: {
    since: '2026-11-16T15:00:00.000Z',
    dueDay: '2026-11-23T05:00:00.000Z',
    sireName: 'Silver Gale',
  },
  foalDevelopmentDay: null,
  epigeneticModifiers: { positive: ['brave'], negative: [], hiddenCount: 1 },
  traitLabels: { brave: 'Brave' },
};

describe('StaffHorseLookup', () => {
  let queries: string[];
  let reply: unknown;

  beforeEach(() => {
    queries = [];
    reply = { horses: [mare] };
    server.use(
      http.get(LOOKUP, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({ success: true, data: reply });
      })
    );
  });

  it('looks a horse up and shows its owner, age, pregnancy and traits in words', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffHorseLookup onCheckinRequired={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Find' })).toBeDisabled();
    await user.type(screen.getByLabelText('Horse number or name'), ' moonlit ');
    await user.click(screen.getByRole('button', { name: 'Find' }));

    const list = await screen.findByRole('list', { name: 'Horses found' });
    expect(within(list).getByText('Moonlit Comet')).toBeInTheDocument();
    const facts = within(list).getByText(/Owned by starrider\./);
    expect(facts).toHaveTextContent('5 years old');
    expect(facts).toHaveTextContent('In foal to Silver Gale since');
    expect(facts).toHaveTextContent('Traits: Brave.');
    expect(facts).toHaveTextContent('1 hidden trait.');
    expect(facts).not.toHaveTextContent('Hidden (only you see these)');
    expect(facts).not.toHaveTextContent('brave');
    expect(queries).toEqual(['moonlit']);
  });

  it('names hidden traits when the server sends them (the Owner), by their authored names', async () => {
    reply = {
      horses: [
        {
          ...mare,
          pregnancy: null,
          retired: true,
          age: 22,
          epigeneticModifiers: {
            positive: ['brave'],
            negative: [],
            hiddenCount: 1,
            hidden: ['resilient'],
          },
          traitLabels: { brave: 'Brave', resilient: 'Resilient' },
        },
      ],
    };
    const user = userEvent.setup();
    renderWithClient(<StaffHorseLookup onCheckinRequired={() => undefined} />);

    await user.type(screen.getByLabelText('Horse number or name'), '42');
    await user.click(screen.getByRole('button', { name: 'Find' }));

    const facts = await screen.findByText(/Owned by starrider\./);
    expect(facts).toHaveTextContent('22 years old, retired.');
    expect(facts).toHaveTextContent('Hidden (only you see these): Resilient.');
    expect(facts).not.toHaveTextContent('resilient');
  });

  it('says when nothing matches', async () => {
    reply = { horses: [] };
    const user = userEvent.setup();
    renderWithClient(<StaffHorseLookup onCheckinRequired={() => undefined} />);

    await user.type(screen.getByLabelText('Horse number or name'), 'nobody');
    await user.click(screen.getByRole('button', { name: 'Find' }));

    expect(await screen.findByText('No horse matches that.')).toBeInTheDocument();
  });

  it('shows the refusal in words, never the server’s', async () => {
    server.use(
      http.get(LOOKUP, () =>
        HttpResponse.json(
          { success: false, code: 'staffCapabilityRequired', message: 'server words never shown' },
          { status: 403 }
        )
      )
    );
    const user = userEvent.setup();
    renderWithClient(<StaffHorseLookup onCheckinRequired={() => undefined} />);

    await user.type(screen.getByLabelText('Horse number or name'), '42');
    await user.click(screen.getByRole('button', { name: 'Find' }));

    expect(
      await screen.findByText('Only the Owner and Admins can look horses up.')
    ).toBeInTheDocument();
    expect(screen.queryByText('server words never shown')).not.toBeInTheDocument();
  });

  it('returns to check-in when the trust ran out', async () => {
    server.use(
      http.get(LOOKUP, () =>
        HttpResponse.json(
          { success: false, code: 'staffCheckinRequired', message: 'Check in first.' },
          { status: 403 }
        )
      )
    );
    let lapsed = 0;
    const user = userEvent.setup();
    renderWithClient(<StaffHorseLookup onCheckinRequired={() => (lapsed += 1)} />);

    await user.type(screen.getByLabelText('Horse number or name'), '42');
    await user.click(screen.getByRole('button', { name: 'Find' }));

    await waitFor(() => expect(lapsed).toBeGreaterThan(0));
  });
});
