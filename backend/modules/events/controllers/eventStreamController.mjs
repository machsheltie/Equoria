// backend/modules/events/controllers/eventStreamController.mjs
//
// Server-Sent Events (SSE) endpoint controller — ADR-011 / Equoria-rgyv.
//
// Holds an open text/event-stream response per authenticated client and
// streams that user's real-time events (notifications / activity / foal
// lifecycle — FR-CN6/8/9) as they are produced.
//
// Auth: this controller runs AFTER the real `authenticateToken` middleware
// (it is mounted on authRouter in app.mjs). It never reads a token itself
// and never trusts a client-supplied user id — the recipient channel is
// derived from req.user.id (the verified JWT subject), so a user can only
// ever receive their own events. No token-in-query, no bypass header.

import logger from '../../../utils/logger.mjs';
import { subscribeUserEvents, userListenerCount } from '../../../services/eventBus.mjs';

// Heartbeat cadence. A comment-line keepalive every 25s keeps the
// connection alive through reverse proxies (Railway) that reap idle
// sockets, and lets a dead peer be detected. 25s is comfortably under the
// common 30–60s proxy idle timeout.
const HEARTBEAT_MS = 25_000;

/**
 * GET /api/v1/events/stream
 *
 * Opens an SSE stream scoped to the authenticated user.
 */
export function streamUserEvents(req, res) {
  // authenticateToken has already run (authRouter). Defensive guard: if
  // req.user is somehow absent, fail closed rather than open an
  // unauthenticated / unscoped stream.
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // SSE response headers.
  // - text/event-stream: the SSE content type.
  // - no-cache, no-transform: 'no-transform' deterministically opts this
  //   response OUT of the compression middleware (compression honors
  //   Cache-Control: no-transform), so events are flushed unbuffered.
  // - keep-alive + X-Accel-Buffering: no: defeat reverse-proxy response
  //   buffering so events arrive immediately, not in a flushed block.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  // Flush headers immediately so the client's EventSource `onopen` fires
  // before any event. Also makes res.headersSent true, which renders the
  // 30s requestTimeoutMiddleware 408 path inert for this long-lived
  // response (it only fires when !headersSent).
  res.flushHeaders();

  // Initial comment so intermediaries see bytes immediately and the client
  // transitions to OPEN promptly.
  res.write(': connected\n\n');

  /**
   * Serialize one event into SSE wire framing. Each event has a stable
   * `event:` name and JSON `data:`. A trailing blank line terminates the
   * SSE message.
   */
  const sendEvent = event => {
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.payload ?? {})}\n\n`);
    } catch (err) {
      // Write after socket close — cleanup will run via the 'close' handler.
      logger.warn(`[eventStream] write failed for user ${userId}: ${err.message}`);
    }
  };

  // Per-user subscription. The unsubscribe closure is the ONLY thing that
  // removes this listener; it must run on disconnect or the listener leaks.
  const unsubscribe = subscribeUserEvents(userId, sendEvent);

  // Heartbeat: SSE comment line. Comments (`:` prefix) are ignored by
  // EventSource but keep the TCP connection and any proxy path warm.
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (err) {
      logger.warn(`[eventStream] heartbeat write failed for user ${userId}: ${err.message}`);
    }
  }, HEARTBEAT_MS);
  // Don't keep the event loop alive solely for this timer (clean shutdown).
  if (typeof heartbeat.unref === 'function') {
    heartbeat.unref();
  }

  // Disconnect cleanup — client navigated away, closed tab, or dropped.
  // Removes the bus listener and clears the heartbeat: no listener or
  // timer leak.
  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    logger.info(
      `[eventStream] closed for user ${userId} (remaining listeners: ${userListenerCount(userId)})`,
    );
  };
  req.on('close', cleanup);
  res.on('error', cleanup);

  logger.info(`[eventStream] opened for user ${userId}`);
  // No return — the response stays open until the client disconnects.
}

export default { streamUserEvents };
