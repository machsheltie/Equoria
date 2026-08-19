# ADR-011: Server-Sent Events for Live Player Signals

**Status:** Accepted
**Date:** 2026-05-18
**Scope:** Server-to-browser live event signals

## Load rule

Load this ADR only when changing SSE transport, the event bus, the authenticated event-stream route, reconnect or polling fallback behavior, or multi-instance fan-out. Verify current behavior against `backend/services/eventBus.mjs`, `backend/modules/events/`, the frontend event-stream hook, and focused tests.

## Context

Equoria needs prompt server-to-browser notification signals, while the durable data remains in PostgreSQL and ordinary API reads. The beta requirement is predominantly one-way; it does not require a bidirectional socket protocol.

## Decision

Use authenticated Server-Sent Events (SSE) for live signals and retain ordinary API refetching as the durable data path.

Current invariants:

- The event-stream endpoint is authenticated under the versioned API.
- The stream carries a signal that prompts the frontend to invalidate/refetch authoritative data; the stream payload is not the durable record.
- Browser reconnect behavior is supported, and polling/refetch remains the graceful fallback when the stream is unavailable.
- Publishing a live signal is best-effort and must not roll back a successful notification/database write.
- Connection accounting and cleanup must prevent leaked listeners on disconnect.
- The current event bus is process-local. It does not deliver an event produced on one replica to a client connected to another replica.

## Rejected default

WebSockets add bidirectional protocol, heartbeat, reconnect, scaling, and security surface that the current one-way signal does not need. Adopt them only if a future, owner-approved requirement genuinely needs bidirectional low-latency communication.

## Consequences

- Multi-replica correctness requires either sticky routing or a shared fan-out layer. Do not claim cross-replica real-time delivery from the process-local bus.
- SSE is an accelerator over persisted data, not a replacement for notification retention, authorization, API reads, or domain records.
- Changing transport or adding shared fan-out requires an explicit architecture update and end-to-end failure/reconnect tests.
