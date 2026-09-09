/**
 * Weekly groom career-progression + auto-retirement job descriptor
 * (Equoria-m9lz1).
 *
 * Registry entry consumed by CronJobService.start(). Delegates to the service's
 * `runGroomCareerProgression()` method, which forwards to the impl in
 * jobs/impl/groomCareerProgression.mjs.
 *
 * WHY THIS IS IN REGISTRY A, NOT THE FUNCTION-BASED cronJobService
 *   It was first written for backend/services/cron-job-service-jobs/ alongside
 *   `riderTrainerRetirement`, which it most resembles. That was the wrong call
 *   and it moved here, because THIS is the one job whose silent failure has no
 *   external symptom: if the pass stops, nothing errors, no player action fails,
 *   and no surface changes — grooms simply never age out, and the first signal is
 *   a player noticing a groom who has worked for three years. The function-based
 *   registry wraps handlers in `withAdvisoryLock` only: no `runWithHeartbeat`, no
 *   `CronRunLog` row, and invisible to `GET /api/admin/cron/health` (which reads
 *   only services/cronJobs.mjs). Registry A gives all three, and
 *   `weeklyRiderTrainerCareerWeeks` is the exact analogue already living here.
 *   Observability is worth a two-line method wrapper on the class.
 *
 * WHY MONDAY 09:45 UTC
 *   Unchanged from the original placement, and the ordering is the point:
 *     09:00  weeklySalaries (cronJobService)   — bills every groom ON STAFF
 *     09:30  riderTrainerRetirement            — sibling staff-retirement pass
 *     09:45  groomCareerProgression            — this job
 *   Running AFTER payroll is deliberate: `processWeeklySalaries` charges the
 *   weekly fee for every groom on a player's staff (Equoria-ypb7d.3 changed the
 *   basis from per-ACTIVE-ASSIGNMENT to per-engagement), and its staff read
 *   carries `retired: false`. Retiring a groom first therefore drops them out of
 *   that read and silently costs a groom who worked the week their final wage. It
 *   is that filter that excludes them, NOT the engagement closure (fix round 1,
 *   F10: the earlier wording named the wrong mechanism, and retirement does not
 *   clear `Groom.userId` either). Re-verified against BOTH registries when this moved: no job in
 *   backend/services/jobs/index.mjs or cron-job-service-jobs/index.mjs claims
 *   `45 9 * * 1`. One interval job does coincide: `electionStatusTransition` runs
 *   every 15 minutes, so it fires at :00/:15/:30/:45 and therefore shares this
 *   slot — inherent to an interval job, not contention this schedule introduces.
 *   (`showExecutionReaper` runs every 30 minutes, so it fires at :00 and :30 and
 *   never at :45; an earlier version of this comment wrongly listed it.)
 *
 * STALENESS BUDGET
 *   192h = the 168h weekly period plus 24h tolerance, matching
 *   `weeklyRiderTrainerCareerWeeks` and `weeklyFlagEvaluation`. This is the value
 *   that makes the health endpoint able to say "this pass has not run" — the
 *   whole reason the job lives in this registry.
 *
 * The advisory lock (`applyLock: true`, Equoria-dx65z) makes the pass run exactly
 * once cluster-wide, which matters more here than for most jobs because two
 * concurrent passes would each advance `careerWeeks`. Retirement itself is
 * additionally guarded inside `processRetirement` by a conditional update whose
 * affected-row count must be 1, so even a lock failure cannot produce two
 * retirements or two notifications for one groom.
 */

export default Object.freeze({
  jobName: 'groomCareerProgression',
  // Every Monday at 09:45 UTC, after payroll. See the header for why the order
  // is load-bearing.
  schedule: '45 9 * * 1',
  applyLock: true,
  // Weekly cadence → 192h budget (168h period + 24h tolerance).
  staleAfterMs: 192 * 60 * 60 * 1000,
  run: service => service.runGroomCareerProgression(),
});
