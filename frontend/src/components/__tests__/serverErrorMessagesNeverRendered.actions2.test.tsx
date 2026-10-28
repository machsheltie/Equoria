/**
 * Raw server error text is never rendered on a refused action, third group
 * (Equoria-mr1kq, FRONTEND_ASYNC_STATE_DOCTRINE §4).
 *
 * Training, show entry and conformation entry printed the thrown error's
 * `.message` verbatim, and the api-client puts the server body's `message` on
 * that error. A refusal or fault whose body carries internals (here a sentinel)
 * therefore reached the player. The REAL components, hooks and api-client run;
 * only the network is stubbed (MSW).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import { userMessageFor } from '@/lib/http/userMessage';
import TrainingSessionModal from '@/components/training/TrainingSessionModal';
import TrainingTab from '@/pages/horse-detail/TrainingTab';
import CompetitionBrowserPage from '@/pages/CompetitionBrowserPage';
import ConformationEntryModal from '@/components/competition/ConformationEntryModal';
import type { TrainableHorse } from '@/lib/api-client';
import type { Horse } from '@/pages/horse-detail/HorseDetailPageTypes';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const sentinel = 'internal detail: connection reset by 10.0.0.7:5432, relation "horses"';
const serverFaultCopy = userMessageFor({ statusCode: 500 }).message;

const refuse = (status: number) =>
  HttpResponse.json({ success: false, message: sentinel }, { status });

const noSentinel = () =>
  expect(screen.queryByText(/connection reset by 10\.0\.0\.7/)).not.toBeInTheDocument();

function renderWith(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

const trainableHorse: TrainableHorse = {
  id: 1,
  name: 'Thunder',
  level: 5,
  gender: 'Stallion',
  age: 5,
  canTrain: true,
  bestDisciplines: ['Barrel Racing'],
};

describe('TrainingSessionModal — failed training (Equoria-mr1kq)', () => {
  const train = async () => {
    const user = userEvent.setup();
    renderWith(<TrainingSessionModal horse={trainableHorse} onClose={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: /start training/i }));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.post(`${base}/api/v1/training/train`, () => refuse(500)));
    await train();

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.post(`${base}/api/v1/training/train`, () => refuse(400)));
    await train();

    expect(
      await screen.findByText(
        "That training session couldn't go ahead. The horse may be on cooldown, too young or in poor health."
      )
    ).toBeInTheDocument();
    noSentinel();
  });
});

describe('TrainingTab — failed training (Equoria-mr1kq)', () => {
  const horse: Horse = {
    id: 1,
    name: 'TestFixture-Comet',
    breed: 'Thoroughbred',
    age: 5,
    gender: 'Mare',
    dateOfBirth: '2021-01-01T00:00:00Z',
    healthStatus: 'Good',
    stats: {
      precision: 50,
      strength: 50,
      speed: 50,
      agility: 50,
      endurance: 50,
      intelligence: 50,
      stamina: 50,
      balance: 50,
      boldness: 50,
      flexibility: 50,
      obedience: 50,
      focus: 50,
    },
    disciplineScores: { Dressage: 10 },
    traits: [],
  };

  const confirm = async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({ success: true, data: [] })
      ),
      // Owner ruling 2026-10-26 (q81, Equoria-r8a6h): a trainer is required to
      // train; a horse with none is offered "Assign Trainer" instead of the
      // discipline picker. This horse is otherwise eligible, so it has a
      // fee-free fixture trainer.
      http.get(`${base}/api/v1/trainers/assignments`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 1,
              trainerId: 1,
              horseId: horse.id,
              horseName: horse.name,
              trainerName: 'TestFixture-Trainer',
              trainerPersonality: 'focused',
              trainerSessionRate: 0,
              startDate: '2026-01-01T00:00:00Z',
              isActive: true,
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    renderWith(<TrainingTab horse={horse} />);
    await user.click(await screen.findByRole('button', { name: /select dressage discipline/i }));
    // Owner ruling q163 (2026-10-28, Equoria-tjh8k): picking the discipline only
    // selects it; one "Train — <fee>" button trains. Old contract: a Confirm
    // Training dialog.
    await user.click(await screen.findByTestId('train-button'));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.post(`${base}/api/v1/training/train`, () => refuse(500)));
    await confirm();

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.post(`${base}/api/v1/training/train`, () => refuse(400)));
    await confirm();

    expect(
      await screen.findByText(
        "That training session couldn't go ahead. The horse may be on cooldown, too young or in poor health."
      )
    ).toBeInTheDocument();
    noSentinel();
  });
});

describe('CompetitionBrowserPage — failed entry (Equoria-mr1kq)', () => {
  const enter = async () => {
    server.use(
      http.get(`${base}/api/v1/competition`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 2,
              name: 'Silverbrook Dressage Cup',
              discipline: 'Dressage',
              showType: 'ridden',
              date: '2026-10-30T12:00:00.000Z',
              runDate: '2026-10-30T12:00:00.000Z',
              closeDate: '2026-10-30T12:00:00.000Z',
              prizePool: 100,
              entryFee: 0,
              status: 'open',
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    renderWith(<CompetitionBrowserPage />);
    await user.click(await screen.findByTestId('competition-card'));
    await user.click(await screen.findByRole('button', { name: /enter competition/i }));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.post(`${base}/api/v1/competition/enter`, () => refuse(500)));
    await enter();

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.post(`${base}/api/v1/competition/enter`, () => refuse(400)));
    await enter();

    expect(
      await screen.findByText("That horse can't be entered in this show right now.")
    ).toBeInTheDocument();
    noSentinel();
  });
});

describe('ConformationEntryModal — failed entry (Equoria-mr1kq)', () => {
  const enter = async () => {
    server.use(
      http.get(`${base}/api/v1/competition/conformation/eligibility/7`, () =>
        HttpResponse.json({
          success: true,
          data: {
            horseId: 7,
            horseName: 'Starlight',
            eligible: true,
            errors: [],
            warnings: [],
            ageClass: 'Mature',
            groomAssigned: true,
          },
        })
      ),
      http.get(`${base}/api/v1/grooms/user/:userId`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 3,
              name: 'Mara Quill',
              firstName: 'Mara',
              lastName: 'Quill',
              skillLevel: 'expert',
              specialty: 'foalCare',
              personality: 'gentle',
              experience: 8,
              sessionRate: 100,
              isActive: true,
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    renderWith(
      <ConformationEntryModal
        isOpen
        onClose={() => undefined}
        show={{ id: 101, name: 'Moonlit Classic', entryFee: 0 }}
        horse={{ id: 7, name: 'Starlight', sex: 'Mare' }}
      />
    );
    const select = await screen.findByTestId('conformation-groom-select');
    await screen.findByRole('option', { name: /mara quill/i });
    await user.selectOptions(select, '3');
    await user.click(screen.getByTestId('conformation-entry-submit'));
  };

  it('shows mapped copy for a server fault', async () => {
    server.use(http.post(`${base}/api/v1/competition/conformation/enter`, () => refuse(500)));
    await enter();

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    noSentinel();
  });

  it('shows mapped copy for a refusal', async () => {
    server.use(http.post(`${base}/api/v1/competition/conformation/enter`, () => refuse(400)));
    await enter();

    expect(
      await screen.findByText("That horse can't be entered in this show right now.")
    ).toBeInTheDocument();
    noSentinel();
  });
});
