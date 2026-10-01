/**
 * sseMultiInstanceGuard.test.mjs (Equoria-o3ync, ADR-011)
 *
 * Sentinel-positive coverage (OPTIMAL_FIX_DISCIPLINE §2) for the SSE
 * multi-instance trigger detector. Proves detectMultiInstanceRisk FIRES on
 * each real multi-process configuration (the trigger condition for
 * Equoria-03llw cross-process fan-out) and stays quiet for genuine
 * single-process configs.
 *
 * Pure unit test: detectMultiInstanceRisk takes an injected `env`, performs no
 * I/O, and logs nothing — no DB, no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { detectMultiInstanceRisk } from '../utils/sseMultiInstanceGuard.mjs';

describe('detectMultiInstanceRisk (Equoria-o3ync)', () => {
  it('does NOT trigger for a single dev instance', () => {
    const r = detectMultiInstanceRisk({ NODE_ENV: 'development' });
    expect(r.multiInstance).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it('does NOT trigger in production with cluster off and a single worker', () => {
    const r = detectMultiInstanceRisk({
      NODE_ENV: 'production',
      CLUSTER_ENABLED: 'false',
      WEB_CONCURRENCY: '1',
    });
    expect(r.multiInstance).toBe(false);
  });

  it('does NOT trigger in the test environment regardless of worker count', () => {
    const r = detectMultiInstanceRisk({ NODE_ENV: 'test', WEB_CONCURRENCY: '8' });
    expect(r.multiInstance).toBe(false);
  });

  // Regression (Equoria-6q7cf rollout, 2026-10-01): the production Railway
  // deploy sets NODE_ENV=production and neither CLUSTER_ENABLED nor
  // WEB_CONCURRENCY. Nothing in server.mjs forks cluster workers, yet the guard
  // logged "cluster mode is active with 48 workers" on every deploy because the
  // cluster predicate defaulted to the host's CPU count. Cluster mode is only a
  // fact when it has been configured explicitly.
  it('does NOT infer cluster mode from the host CPU count when nothing configures it', () => {
    const r = detectMultiInstanceRisk({ NODE_ENV: 'production' });
    expect(r.multiInstance).toBe(false);
    expect(r.reasons).toEqual([]);
    expect(r.details.clusterEnabled).toBe(false);
  });

  it('FIRES when Node cluster mode is enabled with more than one worker', () => {
    const r = detectMultiInstanceRisk({
      NODE_ENV: 'production',
      CLUSTER_ENABLED: 'true',
      WEB_CONCURRENCY: '4',
    });
    expect(r.multiInstance).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/cluster mode is active with 4 workers/i);
    expect(r.details.workerCount).toBe(4);
  });

  it('FIRES when RAILWAY_REPLICA_COUNT is greater than one', () => {
    const r = detectMultiInstanceRisk({
      NODE_ENV: 'production',
      CLUSTER_ENABLED: 'false',
      WEB_CONCURRENCY: '1',
      RAILWAY_REPLICA_COUNT: '3',
    });
    expect(r.multiInstance).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/replica count is 3/i);
    expect(r.details.replicaCount).toBe(3);
  });

  it('FIRES when NUM_REPLICAS is greater than one', () => {
    const r = detectMultiInstanceRisk({
      NODE_ENV: 'production',
      CLUSTER_ENABLED: 'false',
      WEB_CONCURRENCY: '1',
      NUM_REPLICAS: '2',
    });
    expect(r.multiInstance).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/replica count is 2/i);
  });

  it('does NOT trigger on a Railway replica IDENTITY var alone with count 1', () => {
    // A single-replica deploy still sets RAILWAY_REPLICA_ID — the id alone must
    // not be a trigger; only a count > 1 is.
    const r = detectMultiInstanceRisk({
      NODE_ENV: 'production',
      CLUSTER_ENABLED: 'false',
      WEB_CONCURRENCY: '1',
      RAILWAY_REPLICA_ID: 'replica-abc',
      RAILWAY_REPLICA_COUNT: '1',
    });
    expect(r.multiInstance).toBe(false);
    expect(r.details.railwayReplicaId).toBe('replica-abc');
  });
});
