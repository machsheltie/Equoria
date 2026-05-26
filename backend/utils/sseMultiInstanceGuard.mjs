// backend/utils/sseMultiInstanceGuard.mjs
//
// SSE multi-instance trigger monitor (Equoria-o3ync, ADR-011).
//
// ADR-011 ("Negative / accepted limitations" + "Multi-Instance Scaling Trigger
// Condition") records that the SSE event bus (services/eventBus.mjs) is
// PROCESS-LOCAL: with >1 backend process, a user connected to process A does
// NOT receive an event produced on process B over the SSE fast-path (the
// polling fallback still delivers it from the DB, so it degrades latency, not
// correctness). The cross-process fan-out (Redis pub/sub) is the documented
// next step — tracked as Equoria-03llw, deliberately NOT pre-built.
//
// The hazard this module addresses: that scaling moment can arrive silently. A
// Railway replica-count bump or enabling Node cluster mode spins up a second
// SSE-serving process with NO code change to this repo, and 03llw would simply
// be forgotten until users report "live updates only sometimes work".
//
// This module is the cheap, dependency-free trigger: it inspects the runtime
// configuration signals that mean MORE THAN ONE process is (or will be)
// serving SSE, and fires a loud, actionable alert at startup so 03llw is
// implemented at the moment its trigger condition becomes real.
//
// It does NOT count live sibling processes (that would need a shared store /
// schema change, out of scope here). It detects INTENDED multiplicity from
// configuration — which is exactly the operator action ("scale to N replicas"
// / "enable cluster") that the alert must catch.

import logger from './logger.mjs';
import { getWorkerCount, shouldUseCluster } from './clusterManager.mjs';

/**
 * Parse a positive integer from an env string; returns null when absent/invalid.
 */
function parsePositiveInt(value) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Inspect the runtime config for signals that more than one process serves
 * SSE. Pure (no I/O); env is injectable for testing.
 *
 * Signals (any one means the process-local SSE bus assumption is violated):
 *   1. Node cluster mode active with worker count > 1 — clusterManager forks
 *      one worker process per core/WEB_CONCURRENCY; each is a separate process
 *      with its own EventEmitter, so an event on worker 1 never reaches a
 *      client connected to worker 2.
 *   2. An explicit horizontal-replica count > 1 from the platform/env
 *      (RAILWAY_REPLICA_COUNT / NUM_REPLICAS / WEB_CONCURRENCY when not in
 *      cluster mode but used as a replica hint).
 *   3. Railway reports a replica IDENTITY var (RAILWAY_REPLICA_ID) AND a
 *      configured count > 1 — the presence of the id alone is not enough
 *      (a single-replica deploy still sets it), so it is paired with a count.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ multiInstance: boolean, reasons: string[], details: object }}
 */
export function detectMultiInstanceRisk(env = process.env) {
  const reasons = [];
  const details = {};

  // Signal 1 — Node cluster mode with >1 worker.
  const clusterOn = shouldUseCluster(env);
  const workerCount = getWorkerCount({ env });
  details.clusterEnabled = clusterOn;
  details.workerCount = workerCount;
  if (clusterOn && workerCount > 1) {
    reasons.push(
      `Node cluster mode is active with ${workerCount} workers — each worker is a separate process with its own process-local SSE event bus.`,
    );
  }

  // Signal 2 — explicit replica count from platform/env.
  const railwayReplicaCount = parsePositiveInt(env.RAILWAY_REPLICA_COUNT);
  const numReplicas = parsePositiveInt(env.NUM_REPLICAS);
  const replicaCount = railwayReplicaCount ?? numReplicas;
  details.replicaCount = replicaCount;
  if (replicaCount && replicaCount > 1) {
    reasons.push(
      `Configured horizontal replica count is ${replicaCount} (${railwayReplicaCount ? 'RAILWAY_REPLICA_COUNT' : 'NUM_REPLICAS'}) — multiple backend processes serve SSE independently.`,
    );
  }

  // Signal 3 — Railway replica identity present alongside a count > 1.
  // The id alone is NOT a trigger (single-replica deploys set it too); it is
  // only meaningful paired with a count, captured by Signal 2 above. Recorded
  // here for observability.
  details.railwayReplicaId = env.RAILWAY_REPLICA_ID ?? null;

  return {
    multiInstance: reasons.length > 0,
    reasons,
    details,
  };
}

// Memoized snapshot so the admin SSE-metrics endpoint can surface the risk
// without re-reading env on every request, and so the alert fires exactly once.
let _snapshot = null;

/**
 * Evaluate the multi-instance risk ONCE at startup, log a loud alert if the
 * trigger condition is met, and cache the result for observability.
 *
 * Logged at error level (not warn) because a live multi-instance deploy means
 * the SSE fast-path is silently partial for users until Equoria-03llw
 * (cross-process Redis pub/sub fan-out) is implemented — an operator MUST act.
 *
 * Idempotent: re-invocation returns the cached snapshot without re-logging.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ multiInstance: boolean, reasons: string[], details: object }}
 */
export function checkAndAlertMultiInstance(env = process.env) {
  if (_snapshot) {
    return _snapshot;
  }
  const result = detectMultiInstanceRisk(env);
  _snapshot = result;

  if (result.multiInstance) {
    logger.error(
      '[sseMultiInstanceGuard] MULTI-INSTANCE DETECTED — the SSE event bus is ' +
        'process-local (ADR-011). Live SSE delivery is now PARTIAL across ' +
        'processes (polling fallback still delivers from the DB, so correctness ' +
        'holds; latency does not). IMPLEMENT cross-process fan-out (Redis pub/sub) ' +
        'now — Equoria-03llw. Reasons: ' +
        result.reasons.join(' | '),
    );
  } else {
    logger.info(
      '[sseMultiInstanceGuard] Single-instance SSE confirmed (process-local bus ' +
        'is correct). Equoria-03llw cross-process fan-out not yet required.',
    );
  }

  return result;
}

/**
 * Observability accessor: the cached startup snapshot, or a fresh evaluation if
 * checkAndAlertMultiInstance has not run yet. Surfaced on GET /api/admin/sse/metrics.
 *
 * @returns {{ multiInstance: boolean, reasons: string[], details: object }}
 */
export function getMultiInstanceStatus() {
  return _snapshot ?? detectMultiInstanceRisk();
}

/** Test-only: reset the memoized snapshot so a suite can re-evaluate. */
export function _resetForTest() {
  _snapshot = null;
}

export default {
  detectMultiInstanceRisk,
  checkAndAlertMultiInstance,
  getMultiInstanceStatus,
};
