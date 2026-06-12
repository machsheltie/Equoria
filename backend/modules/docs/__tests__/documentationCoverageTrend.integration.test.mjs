/**
 * 🧪 Documentation Coverage Trend — Real-DB Integration (Equoria-zr9kl)
 *
 * Proves the persisted-snapshot coverage-trend feature end-to-end against the
 * REAL database (no mocks):
 *
 *   1. recordCoverageSnapshot() persists a real row to doc_coverage_snapshots
 *      and the row is readable back via getCoverageHistory().
 *   2. deriveCoverageTrend() classifies a >=2-snapshot history as
 *      improving / declining / stable (the REAL trend), and reports the honest
 *      not-tracked shape for a <2-snapshot history.
 *   3. The /api/docs/analytics route reports tracked:true with a real direction
 *      once >=2 recent snapshots are persisted.
 *
 * Cleanup is id-scoped (CLAUDE.md §2): only the snapshot ids this suite creates
 * are deleted — never a bare deleteMany().
 */

import { describe, it, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import documentationRoutes from '../../../routes/documentationRoutes.mjs';
import { responseHandler } from '../../../utils/apiResponse.mjs';
import {
  getApiDocumentationService,
  recordCoverageSnapshot,
  getDocumentationCoverageTrend,
  deriveCoverageTrend,
} from '../../../services/apiDocumentationService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

describe('Documentation Coverage Trend (Equoria-zr9kl)', () => {
  const createdSnapshotIds = [];
  let testApp;
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        username: `TestFixture-zr9kl-${Math.random().toString(16).slice(2, 10)}`,
        email: `testfixture-zr9kl-${Math.random().toString(16).slice(2, 10)}@test.com`,
        password: 'testPassword123',
        firstName: 'Trend',
        lastName: 'Test',
      },
    });

    authToken = jwt.sign(
      { id: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    testApp = express();
    testApp.use(express.json());
    testApp.use(responseHandler);
    testApp.use('/api/docs', documentationRoutes);
  }, 120000);

  afterAll(async () => {
    // Scoped cleanup — only the snapshot rows this suite created.
    if (createdSnapshotIds.length > 0) {
      await prisma.docCoverageSnapshot.deleteMany({
        where: { id: { in: createdSnapshotIds } },
      });
    }
    if (testUser?.id) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  // Helper: seed a snapshot with explicit values + capturedAt so the trend is
  // deterministic regardless of any pre-existing rows. Records the id for
  // scoped cleanup.
  async function seedSnapshot({ coveragePct, qualityScore, capturedAt }) {
    const row = await prisma.docCoverageSnapshot.create({
      data: {
        coveragePct,
        qualityScore,
        totalEndpoints: 100,
        documentedEndpoints: Math.round(coveragePct),
        capturedAt,
      },
    });
    createdSnapshotIds.push(row.id);
    return row;
  }

  describe('recordCoverageSnapshot() — real persistence', () => {
    test('persists a real snapshot row that is readable back', async () => {
      const snapshot = await recordCoverageSnapshot();
      createdSnapshotIds.push(snapshot.id);

      expect(snapshot.id).toBeGreaterThan(0);
      expect(typeof snapshot.coveragePct).toBe('number');
      expect(typeof snapshot.qualityScore).toBe('number');

      const fetched = await prisma.docCoverageSnapshot.findUnique({
        where: { id: snapshot.id },
      });
      expect(fetched).not.toBeNull();
      expect(fetched.coveragePct).toBeCloseTo(snapshot.coveragePct, 5);
      expect(fetched.qualityScore).toBe(snapshot.qualityScore);
    });
  });

  describe('deriveCoverageTrend() — pure classification', () => {
    test('<2 snapshots → honest not-tracked', () => {
      const none = deriveCoverageTrend([]);
      expect(none.tracked).toBe(false);
      expect(none.coverageTrend).toBeNull();
      expect(none.qualityTrend).toBeNull();
      expect(none.sampleSize).toBe(0);

      const one = deriveCoverageTrend([{ coveragePct: 50, qualityScore: 40 }]);
      expect(one.tracked).toBe(false);
      expect(one.coverageTrend).toBeNull();
      expect(one.qualityTrend).toBeNull();
      expect(one.sampleSize).toBe(1);
    });

    test('improving series (newest-first input) → improving', () => {
      // getCoverageHistory returns newest-first; newest has higher coverage.
      const history = [
        { coveragePct: 80, qualityScore: 70 }, // newest
        { coveragePct: 60, qualityScore: 50 },
        { coveragePct: 40, qualityScore: 30 }, // oldest
      ];
      const trend = deriveCoverageTrend(history);
      expect(trend.tracked).toBe(true);
      expect(trend.coverageTrend).toBe('improving');
      expect(trend.qualityTrend).toBe('improving');
      expect(trend.sampleSize).toBe(3);
    });

    test('declining series → declining', () => {
      const history = [
        { coveragePct: 30, qualityScore: 20 }, // newest
        { coveragePct: 70, qualityScore: 60 }, // oldest
      ];
      const trend = deriveCoverageTrend(history);
      expect(trend.coverageTrend).toBe('declining');
      expect(trend.qualityTrend).toBe('declining');
    });

    test('within dead-band → stable', () => {
      const history = [
        { coveragePct: 50.2, qualityScore: 40 }, // newest
        { coveragePct: 50.0, qualityScore: 40 }, // oldest
      ];
      const trend = deriveCoverageTrend(history);
      expect(trend.coverageTrend).toBe('stable');
      expect(trend.qualityTrend).toBe('stable');
    });
  });

  describe('getDocumentationCoverageTrend() — over real persisted rows', () => {
    test('reads back a real improving trend from >=2 freshly persisted snapshots', async () => {
      // Seed two snapshots that are the NEWEST in the table (future-ish
      // capturedAt) so the top-N window the service reads is dominated by ours,
      // making the derived direction deterministic.
      const base = Date.now();
      await seedSnapshot({
        coveragePct: 42,
        qualityScore: 30,
        capturedAt: new Date(base + 60_000),
      });
      await seedSnapshot({
        coveragePct: 88,
        qualityScore: 75,
        capturedAt: new Date(base + 120_000),
      });

      // limit=2 → only our two newest rows participate.
      const trend = await getDocumentationCoverageTrend(2);
      expect(trend.tracked).toBe(true);
      expect(trend.sampleSize).toBe(2);
      expect(trend.coverageTrend).toBe('improving');
      expect(trend.qualityTrend).toBe('improving');
    });
  });

  describe('GET /api/docs/analytics — route reflects persisted trend', () => {
    test('reports tracked:true with a real direction once >=2 snapshots exist', async () => {
      // Ensure two newest snapshots dominate the default window read by the route.
      const base = Date.now();
      await seedSnapshot({
        coveragePct: 30,
        qualityScore: 25,
        capturedAt: new Date(base + 600_000),
      });
      await seedSnapshot({
        coveragePct: 95,
        qualityScore: 85,
        capturedAt: new Date(base + 1_200_000),
      });

      const response = await request(testApp)
        .get('/api/docs/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { trends } = response.body.data;
      expect(trends.tracked).toBe(true);
      // The two dominant newest rows are improving; with the default window the
      // direction may include earlier seeded rows, but a real non-null direction
      // MUST be present (the not-tracked placeholder is gone for >=2 snapshots).
      expect(['improving', 'declining', 'stable']).toContain(trends.coverageTrend);
      expect(['improving', 'declining', 'stable']).toContain(trends.qualityTrend);
      expect(trends.coverageTrend).not.toBeNull();
    });
  });
});
