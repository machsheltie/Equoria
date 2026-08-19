# ADR-013: PostgreSQL Advisory Locks for Scheduled Jobs

**Status:** Accepted (updated to current implementation)
**Date:** 2026-06-13
**Scope:** Multi-replica cron execution

## Load rule

Load this ADR only when changing cron registration, scheduled-job execution, PostgreSQL advisory locks, lock keys, multi-replica deployment, or cron health reporting. Verify current behavior against both cron registries and the advisory-lock utility.

## Context

Every Railway replica starts the application's scheduled jobs. Without coordination, two healthy replicas can execute the same world mutation, settlement, or cleanup job at the same time. In-process flags cannot coordinate separate processes and must not be treated as distributed locks.

## Decision

Use PostgreSQL advisory locks to provide non-blocking, single-runner execution for jobs that may start on multiple replicas.

Current invariants:

- Scheduled jobs route through the shared advisory-lock helper (`withAdvisoryLock`) in both active cron registration paths.
- Each job has a stable, unique lock identity.
- A replica that cannot acquire a lock skips that run; it does not wait and create a backlog.
- Lock acquisition and release use the same database session/connection semantics required by PostgreSQL advisory locks.
- Release occurs in cleanup even when the job fails, and job failures remain observable.
- In-process overlap guards may supplement the database lock but never replace it.

## Consequences

- PostgreSQL is part of cron coordination as well as persistence.
- Long jobs need correct connection-pool and timeout behavior.
- Adding a scheduled mutation requires choosing and testing a lock identity.
- If scheduling moves to a single external worker or queue, supersede this ADR rather than silently bypassing the lock contract.
