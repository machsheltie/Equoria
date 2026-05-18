// backend/services/eventBus.mjs
//
// Process-local real-time event bus for the SSE transport (ADR-011,
// Equoria-rgyv). Producers (notificationService.createNotification) publish
// per-user events; the SSE endpoint (modules/events) subscribes per
// authenticated user and streams them to that user's browser.
//
// Per-user channels are the isolation boundary: a subscriber registered for
// userId A can NEVER receive an event published for userId B, because the
// emit and the listener are keyed on a per-user event name derived from the
// userId. There is intentionally no global broadcast channel.
//
// Scope (ADR-011 "Negative / accepted limitations"): this bus is
// process-local. With >1 backend instance a cross-process pub/sub (Redis)
// is required — tracked as a follow-up, not pre-built. The DB Notification
// row remains the source of truth; this bus is a low-latency nudge, so a
// cross-instance miss degrades latency (next poll still delivers), not
// correctness.

import { EventEmitter } from 'node:events';
import logger from '../utils/logger.mjs';

// A single shared emitter. maxListeners is raised because each connected
// SSE client adds one listener; the default cap of 10 would warn under
// normal multi-user load. This is bounded by concurrent SSE connections,
// which is monitored separately as a future concern (ADR-011).
const emitter = new EventEmitter();
emitter.setMaxListeners(0); // 0 = unlimited; connection count is the real bound

/**
 * Derive the per-user channel name. Keeping this in one place guarantees
 * publish and subscribe always agree, so cross-user leakage is impossible
 * by construction (a B-channel listener never matches an A-channel emit).
 *
 * @param {string} userId
 * @returns {string}
 */
function userChannel(userId) {
  return `user:${userId}`;
}

/**
 * Publish a real-time event for a single user. Fire-and-forget by design:
 * callers (notificationService) must not have their primary path (the DB
 * write) coupled to bus delivery. Never throws.
 *
 * @param {string} userId - recipient user id (the token subject server-side)
 * @param {string} type   - event type, e.g. 'stat_gain', 'foal_born'
 * @param {object} payload - serializable event payload
 */
export function publishUserEvent(userId, type, payload) {
  try {
    if (!userId || typeof userId !== 'string') {
      return;
    }
    emitter.emit(userChannel(userId), { type, payload, ts: Date.now() });
  } catch (err) {
    // Bus delivery is best-effort; a failure here must never propagate to
    // the caller's primary path. The DB row is the source of truth.
    logger.error(`[eventBus] publish failed: ${err.message}`);
  }
}

/**
 * Subscribe to a user's real-time event channel. Returns an unsubscribe
 * function that MUST be called on client disconnect to avoid a listener
 * leak (the SSE endpoint calls it from req.on('close')).
 *
 * @param {string} userId
 * @param {(event: {type: string, payload: object, ts: number}) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeUserEvents(userId, listener) {
  const channel = userChannel(userId);
  emitter.on(channel, listener);
  return () => {
    emitter.off(channel, listener);
  };
}

/**
 * Test/diagnostic helper: number of active listeners on a user's channel.
 * Used by the disconnect-cleanup integration assertion.
 *
 * @param {string} userId
 * @returns {number}
 */
export function userListenerCount(userId) {
  return emitter.listenerCount(userChannel(userId));
}

export default { publishUserEvent, subscribeUserEvents, userListenerCount };
