/**
 * trainingApi.train — backend-contract normalization tests (Equoria-pw7d0)
 *
 * These tests exercise the REAL backend response shape produced by
 * backend/modules/training/controllers/trainingController.mjs#trainRouteHandler:
 *
 *   res.json({
 *     success, message, updatedScore,
 *     nextEligibleDate: <ISO string>,   // NOTE: NOT `nextEligible`
 *     traitEffects, temperamentEffects,
 *   });
 *
 * i.e. a FLAT body (no `data` envelope), using the deprecated `nextEligibleDate`
 * field and a flat `updatedScore` — and crucially NO `nextEligible` and NO
 * `updatedHorse`. The pre-existing useTraining.test.tsx / msw handlers return an
 * idealized `{ data: { nextEligible, updatedHorse } }` shape the real backend
 * never emits, which is exactly why the "Invalid Date" regression slipped
 * through (CLAUDE.md §3 — a green test built on a fictional contract).
 *
 * The normalizer must derive the canonical `nextEligible` from whichever field
 * the backend actually sends and must NEVER clobber a real date with ''.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import { trainingApi } from '../training';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

describe('trainingApi.train — real backend contract (Equoria-pw7d0)', () => {
  it('derives a valid next-eligible date from the real flat backend response', async () => {
    const realIso = '2026-06-17T12:00:00.000Z';

    // Mirror the ACTUAL trainRouteHandler response: flat, `nextEligibleDate`,
    // a flat `updatedScore`, and NO `nextEligible` / `updatedHorse`.
    server.use(
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({
          success: true,
          message: 'Thunder trained in Dressage. +5 added.',
          updatedScore: 45,
          nextEligibleDate: realIso,
          traitEffects: { appliedTraits: [], scoreModifier: 0, xpModifier: 0 },
          temperamentEffects: null,
        })
      )
    );

    const result = await trainingApi.train({ horseId: 1, discipline: 'Dressage' });

    // Canonical field consumed by TrainingTab + useTraining.onSuccess.
    expect(result.nextEligible).toBeTruthy();
    expect(Number.isNaN(new Date(result.nextEligible as string).getTime())).toBe(false);

    // Field consumed by TrainingResultsDisplay.formatDate() — the live player
    // path that rendered "Invalid Date". Must NOT be clobbered to ''.
    expect(result.nextEligibleDate).toBe(realIso);
    expect(Number.isNaN(new Date(result.nextEligibleDate as string).getTime())).toBe(false);

    // The real discipline score from the backend must survive, not be reset to 0.
    expect(result.updatedScore).toBe(45);
  });

  it('still honors the legacy `nextEligible` / `updatedHorse` shape (backward compat)', async () => {
    server.use(
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({
          data: {
            success: true,
            message: 'Training complete',
            updatedHorse: {
              id: 1,
              name: 'Thunder',
              discipline_scores: { Racing: 92 },
              userId: 'user-123',
            },
            nextEligible: '2026-02-06T10:00:00.000Z',
            statGain: { stat: 'speed', amount: 2, traitModified: false },
          },
        })
      )
    );

    const result = await trainingApi.train({ horseId: 1, discipline: 'Racing' });

    expect(result.nextEligible).toBe('2026-02-06T10:00:00.000Z');
    expect(result.nextEligibleDate).toBe('2026-02-06T10:00:00.000Z');
    expect(Number.isNaN(new Date(result.nextEligibleDate as string).getTime())).toBe(false);
    expect(result.updatedScore).toBe(92);
    expect(result.statGain?.stat).toBe('speed');
  });
});
