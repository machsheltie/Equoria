/**
 * FoalDevelopmentTracker — Activity Log with a real groom row (Equoria-fr2kg).
 *
 * After the player-run foal activities were removed, the only writer of
 * foal_activities is the groom interaction (POST /api/v1/grooms/interact).
 * This test feeds the tracker the exact GET /api/v1/foals/:foalId/activities
 * envelope the backend returns for such a row and drives the REAL component,
 * the REAL useFoalActivities hook and the REAL breedingApi / apiClient
 * envelope unwrap. Only the network boundary is stubbed (MSW).
 *
 * Row shape sources:
 *   - Row written by the groom path:
 *     backend/modules/grooms/controllers/groomInteractionController.mjs:333-347
 *     (tx.foalActivity.create: day = age in days, activityType =
 *     interactionType, outcome = effects.quality || 'good', bondingChange,
 *     description "Groom interaction (<type>) recorded via groom
 *     system", source groom_interaction).
 *   - Serialized by GET /activities:
 *     backend/modules/breeding/controllers/foalController.mjs:167-191
 *     ({ success, data: [{ id, day, activityType, activity (alias),
 *     outcome, bondingChange, description, createdAt }] }).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import { RewardToastProvider } from '@/components/feedback';
import FoalDevelopmentTracker from '../FoalDevelopmentTracker';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FOAL_ID = 77;
const foalPath = (suffix = '') => `${base}/api/v1/foals/${FOAL_ID}${suffix}`;
const dob = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

// One row exactly as GET /activities serializes a groom-written FoalActivity.
const groomRow = {
  id: 501,
  day: 2,
  activityType: 'early_touch',
  activity: 'early_touch',
  outcome: 'good',
  bondingChange: 2,
  description: 'Groom interaction (early_touch) recorded via groom system',
  createdAt: '2026-10-14T15:30:00.000Z',
};

describe('FoalDevelopmentTracker — Activity Log shows groom rows (Equoria-fr2kg)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    server.use(
      http.get(foalPath(), () =>
        HttpResponse.json({
          success: true,
          data: {
            id: FOAL_ID,
            name: 'TestFixture-Moonbeam',
            sex: 'Colt',
            dateOfBirth: dob,
            ageInDays: 2,
            sireId: 10,
            damId: 11,
            traits: [],
          },
        })
      ),
      http.get(foalPath('/development'), () =>
        HttpResponse.json({
          success: true,
          data: {
            foal: { id: FOAL_ID, name: 'TestFixture-Moonbeam' },
            development: { currentDay: 2, bondingLevel: 50, maxDay: 6 },
            activityHistory: [],
          },
        })
      ),
      http.get(foalPath('/activities'), () =>
        HttpResponse.json({ success: true, data: [groomRow] })
      )
    );
  });

  it('shows "Activity Log (1)" for one groom row and expands to show it', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <RewardToastProvider>
          <FoalDevelopmentTracker foalId={FOAL_ID} />
        </RewardToastProvider>
      </QueryClientProvider>
    );

    const toggle = await screen.findByRole('button', { name: /Activity Log \(1\)/ });
    expect(toggle).toBeInTheDocument();
    // Collapsed by default: the row is not rendered yet.
    expect(screen.queryByText('early_touch')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(await screen.findByText('early_touch')).toBeInTheDocument();
  });
});
