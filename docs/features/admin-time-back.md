# Outage Time-Back Contract

- **Status:** Active contract — implemented 2026-11-18 (Equoria-puj1e.5); the
  newer clocks move too since owner ruling q383 (2026-11-18)
- **Owner:** Project owner (Stacey)
- **Last verified:** 2026-11-20 (each career week given back at most once; apply
  and reverse lock rows in a show entry's order)
- **Load only when:** designing, planning, implementing, or reviewing the admin
  "give time back after an outage" operation, the durable nightly-job hold, or
  the overdue-only foaling control
- **Do not load for:** ordinary gameplay timers, player moderation tools, or
  scheduler changes unrelated to outage recovery
- **Live sources:** `packages/database/prisma/schema.prisma`,
  `backend/services/cronJobs.mjs`, `backend/services/jobs/`,
  `backend/services/cron-job-service-jobs/`, `backend/server.mjs`,
  `backend/utils/horseAge.mjs`, `backend/modules/admin/`
- **Retire when:** the feature is implemented (change the status to _Active
  contract_ in that change) or the owner withdraws it

**Build order:** fifth of five staff-tool projects (staff foundation, player
conduct, content moderation, identity and ban evasion, then this). It depends
on the staff foundation's admin role, Steward's Office page, and permanent
staff action log; it must not ship before them.

## Purpose

When Equoria is down, players lose time they could not use: horses age toward
retirement at 21, care lapses, cooldowns and deadlines run out. The owner can
give that time back. Owner ruling 2026-10-06: a **true pause** — every game
clock behaves as if the outage never happened. The admin set-age tool stays;
the 8-day world-wide foaling fast-forward does not.

## Invariants

1. Game time froze at the outage start `S` and resumes at the end `E`; the pause
   length is `N = E − S`.
2. Only the Owner can hold the jobs, apply or reverse a time-back (owner ruling
   q377, 2026-11-18; moderators and admins never see the tools). Apply and
   reverse each need one fresh emailed code at that moment (q378); no
   authenticator app.
3. A time-back applies only while nightly jobs are **held** (below).
4. Apply and its record are one transaction: the change set and the
   `staff action` entry cannot disagree. Nothing changes if apply fails.
5. Every field value the operation changes is recorded (table, row, field, old,
   new) so the operation can be reversed exactly once.
6. A window that overlaps an applied, un-reversed time-back is refused (no
   double compensation). `E` may not be in the future; windows over 30 days are
   refused.
7. Every schema `DateTime` field and every known JSON clock is classified in
   one rulebook registry. An unclassified field fails a sentinel test.

## Rulebook

Each row is updated by a database-side expression over its **current** value,
so a player action committing during apply is never overwritten or shifted
twice. Raw SQL must bind instants as UTC explicitly (non-UTC DB sessions shift
raw `Date` binds — Equoria-7uphu).

Apply and reverse lock the rows they change `FOR NO KEY UPDATE` (no moved
column is a key), so a player write that only references a row — a show entry
naming the horse — is not held up by it. They take player accounts first (owed
bank claims), then horses, shows, then grooms: the order a show entry takes its
account, its show and its groom, so the two never deadlock
(Equoria-puj1e.5.2).

| Rule                   | Applies to                                          | New value                                                                |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| **1 Past event**       | anchors whose elapsed time drives play              | `t ≤ S → t + N`; `S < t < E → E`; `t ≥ E → t`                            |
| **2 Pending deadline** | future unlock/close times                           | `t > S → t + N`; otherwise unchanged (nothing already finished re-locks) |
| **3 Job counter**      | integers a scheduled job advanced inside the window | give back the weeks the job recorded adding to each row in the window    |
| **4 Never moved**      | security, accounting, records, history displays     | unchanged                                                                |

`@db.Date` columns (`Horse.dateOfBirth`, `Horse.lastBredDate`,
`Horse.lastVettedDate`) move by the window's length on the Eastern clock rounded
to the nearest whole day (a 23- or 25-hour daylight-saving day is one game day).
Ages are counted in whole Eastern calendar days, so no precision is lost for
play.

The weekly-bucketed fields (`Groom.feeUnpaidSince`, `Rider.feeUnpaidSince`)
move by the window's whole game weeks: the most `k` for which `k` Eastern
calendar weeks after `S`, at the same Eastern clock time, is not after `E`. A
value moves `k` calendar weeks and keeps its Eastern clock time, so Sunday
midnight to Sunday midnight across spring-forward is one week though only 167
hours long (Codex r2 #5, 2026-11-19).

### Classification (2026-10-06 code survey)

**Rule 1 — past events:** `Horse.dateOfBirth` (only horses under 21 at `S`; a
horse that turned 21 inside the window returns to 20), `Horse.lastBredDate`,
`Horse.inFoalSinceDate`, `Horse.lastVettedDate`, `Horse.lastGroomed`,
`Horse.lastShod`, `Horse.lastFedDate`, `TrainingLog.trainedAt` (the
7-day `canTrain` gate — moves together with `Horse.trainingCooldown`),
`GroomAssignment.createdAt` and `startDate` (tenure gates), `GroomInteraction`
`timestamp` and `createdAt` for interactions inside the trailing care windows
(daily gates, 7/14/30/60-day windows, and DOB-relative developmental windows —
interactions must move with the birth date or a foal's care history shifts
earlier in its life), `StaffMarketplaceState.lastRefresh`.

**Rule 2 — pending deadlines:** `Horse.trainingCooldown`, `Show.closeDate` and
`Show.runDate` (status `open` only), `ClubElection.startsAt` / `endsAt` (status
not `closed`), `Groom.feeUnpaidSince` (bucketed by pay week — a pause under 7 days changes
nothing). `Show.openDate` is always the creation time, so it is never pending.

**Owner ruling q383 (2026-11-18): the clocks added after the survey get the
time back too, the same as every other game clock.**

- Rule 1: `Horse.hungerSince` (hunger), `Rider.freeAgentSince` (time in the
  riders-for-hire pool), `RiderRetirementSchedule.noticeSentAt` (a rider's
  retirement notice), `FoalDevelopment.finalDayEvaluatedAt` (a foal's final
  development day).
- Rule 2: `Rider.feeUnpaidSince` (a rider's unpaid pay week; like the groom's,
  moved in whole weeks only), `HallOfFameRound.startsAt` / `endsAt` (voting
  rounds and run-offs not yet decided, `closedAt` null).
- Never moved: `HallOfFameRound.weekStart` and `HallOfFameNomination.weekStart`
  are week names (00:00 Eastern Sunday), not clocks — a round's voting time is
  `startsAt`/`endsAt`, and `weekStart` is the one-round-per-week key, so moving
  it would let a second round open in the same week.
  `RiderRetirementSchedule.assignedAt` is when the hidden age was rolled, a
  record like `GroomRetirementSchedule.assignedAt`.

**Rule 3 — job counters:** `Groom.careerWeeks` (groomCareerProgression, Mon
09:45 UTC), `Rider.careerWeeks` and `Trainer.careerWeeks`
(weeklyRiderTrainerCareerWeeks, Mon 00:15 UTC), `FoalDevelopment.currentDay`
(dailyTraitEvaluation — clamp to the foal's new age, Equoria-3i34b).
`Horse.age` is recomputed from the shifted birth date in the same transaction.

Career weeks are given back from per-row evidence, never from the run log
(Codex r2 #2/#3, 2026-11-19). Every week a weekly pass adds is recorded in
`staff_career_ticks` (staff kind, staff id, when) in the same SQL statement as
the increment (`backend/utils/staffCareerTicks.mjs`), so a record exists exactly
when the week was added. A time-back takes from each groom, rider or trainer
exactly the weeks recorded for it inside the window: an inactive groom the pass
skipped, a groom whose own increment failed, and the trainers when their half
of the pass failed after the riders' half committed keep their weeks. A retired
staff member keeps its weeks (its retirement stands). The run log is no longer
evidence: it is written after the pass commits, a failed insert is swallowed,
and a rider/trainer pass that fails half-way logs `error`.

Each recorded week is given back at most once (Equoria-puj1e.5.1, 2026-11-20).
Apply marks every week it gives back with a `time_back_changes` row (table
`staff_career_ticks`, the week's id, field `givenBack`); a week marked by a
time-back that has not been undone is never given back again, by an overlapping
window or after an undo and re-apply, and the preview counts only weeks not yet
given back. Undo of a career count adds back exactly the weeks its apply took,
to whatever the count holds now (weeks worked since stay), instead of restoring
the old value only when the count is unchanged; once the time-back is undone its
weeks may be given back by a later, corrected time-back. Example: a groom ages
9 to 10 in the outage, T1 gives it back (9), Monday's pass ages it (10), undoing
T1 gives 11, and a corrected T2 over the outage gives 10: one outage week off,
never two.

The record is complete from the moment its migration ran
(`staff_career_tick_ledger.completeSince`; nothing before it was recorded). A
window that starts earlier cannot prove which staff aged, so apply leaves all
three career counts alone, the preview says so in words ("Can't be given back
for this outage, because the record of which staff aged is incomplete: grooms’
years, riders’ years, trainers’ years."), and the summary lists them as
`unprovableCounters`. The rest of the time-back applies as usual. Residual
risk: a weekly pass run by an older server still up during the deploy that
added the record, after the migration committed, would be unrecorded.

Run logs are kept at least 45 days (`CRON_RUN_LOG_RETENTION_DAYS` cannot go
lower), longer than the longest window, so the preview's list of jobs that ran
during an outage that ended recently is complete.

**Rule 4 — never moved:** login/refresh/verification/reset tokens,
`User.passwordChangedAt`, `User.emailVerifiedAt`, `User.dateOfBirth`,
`GroomSalaryPayment.paymentDate`, competition results, XP/trait/milestone
histories, sales, forum and club records, `Show.executedAt` and `claimedAt`,
run logs, display-only staff dates, `User.settings` milestones and crafted
timestamps, MFA recovery codes.

**Weekly bank claim — owner ruling 2026-10-12: players get a lost week back.**
`User.settings.lastWeeklyClaimDate` is a calendar-week marker, so no shift rule
restores a week that fell entirely inside an outage. Instead, the time-back
grants each player one owed claim for every bank week fully covered by the
window in which they had not already claimed. An owed claim is redeemed through
the normal weekly claim (same amount, ledger-recorded), on top of that week's
own claim; it is recorded per player in the change set so a reversal removes any
owed claim not yet redeemed.

Built 2026-11-18 (`backend/modules/staff/services/timeBackBankClaims.mjs`): a
bank week is Sunday 00:00 to Sunday 00:00 Eastern, fully covered when the window
begins at or before its start and ends at or after its end. A player had already
claimed it when the ledger holds a weekly reward for that week
(`metadata.weekStart`), when their claim marker falls inside it, or when an owed
claim for it is already waiting; accounts created after the week ended are owed
nothing. Owed claims wait in `User.settings.owedWeeklyClaims` as
`{ timeBackId, weekStart }` (server-written only; the players' settings writes
are allow-listed) and each grant is one `time_back_changes` row. One press of
the normal claim pays this week's reward if open plus every owed claim, each its
own ledger row (`metadata.owed: true`); the bank page puts the whole amount on
the button. Undo removes the owed claims still waiting; paid ones stand.

**Time zone — owner ruling (repeated 2026-10-09):** all game timing runs on
Eastern time, never UTC. The window `S`/`E`, calendar-day ages, bank weeks and
job schedules are read in Eastern; the UTC wording in the code survey above
describes the code as surveyed on 2026-10-06 and must be re-checked against the
Eastern migration before planning. Raw SQL must still bind instants with an
explicit zone.

## Fresh-code proof (STAFF-CR-06)

Built 2026-11-18 (`staffFreshCodeService.mjs`, `requireFreshStaffProof`). The
ordinary capability guard alone, which a device trusted for up to 30 days
satisfies, never authorizes apply or reverse:

- A purpose-bound, one-time, short-lived fresh check-in proof, consumed
  atomically by apply and by reverse. It is not interchangeable with the 30-day
  device cookie.
- Invalidated by a password change, a verified-email change, or a role change.
- A `requireFreshStaffProof` route guard in front of apply and reverse.

`scripts/doctrine-checks/check-staff-routes-guarded.mjs` allows the two
capabilities only in the staff routes, and requires `requireFreshStaffProof`
directly after the guard of every `time-back` write except the route that sends
the code. Holding the jobs needs only its capability (q378: a code at apply and
undo, nothing else). A code is purpose-bound (`timeBackApply`, `timeBackUndo`):
a browser check-in code or the other purpose's code never works.

Regressions this project must provide: a trusted 30-day device alone cannot
authorize apply or reverse; a fresh purpose-bound proof works once; replay,
expiry, password change, role change, and use for the wrong purpose all fail.

## Nightly-job hold

The in-memory scheduler stop does not survive a restart, and `server.mjs` starts
every scheduled job at boot in production, plus `showScheduler` every 10
minutes. A hold must therefore be durable:

- A single `GameControl` record (`jobsHeld`, `heldAt`, `heldById`, `reason`)
  is read before every run of **every** scheduled job — Registry A
  (`services/jobs`) and Registry B (`services/cron-job-service-jobs`) both run
  through `CronJobMonitor.runWithHeartbeat`, which reads it. A held job records
  `skipped-held` and does nothing. (`showScheduler` no longer exists: shows
  settle only in the nightly run.)
- The hold is a barrier, not only a flag (Codex r2 #1). Each run reads it after
  taking its own lock, inside that lock's transaction, holding the nightly-job
  barrier lock in shared mode until its body ends. Hold, release and time-back
  apply take the barrier exclusively first, so a hold never commits while a job
  body is mid-run, a job that has not yet read the hold waits and then skips,
  and no job runs during apply. If a job is still running after 10 seconds, the
  hold or apply is refused (409 `jobsRunning`) and nothing changes. Undo takes
  the same barrier first (it does not need the jobs held), so no job body runs
  while it restores (Codex r2, 2026-11-19).
- The show settlements that are not nightly jobs take the same barrier in
  shared mode before any row lock (Equoria-puj1e.5.3): the admin's run of every
  due show (`POST /api/v1/shows/execute`) for its whole run, and the Owner's
  Run Show and test run of a quarantined show. None of them settles a show
  while apply, undo or a hold change holds the barrier, and those wait for a
  settlement already running. They do not read the hold.
- Hold and release are admin actions recorded in the staff action log.
- Both registries write `CronRunLog` rows. The admin manual triggers ("deliver
  overdue foals now", the owner's "age every horse now" and the trait-evaluation
  trigger) run through the monitor under their scheduled job's name
  (`foaling`, `dailyHorseAging`, `dailyTraitEvaluation`) and advisory lock: each
  run is in the run log a time-back reads, and each is refused (409) while the
  jobs are held.

## Operation

1. **Hold jobs** (required; the panel offers it).
2. **Enter the window** (`S`, `E` in Eastern time). `N` is the real time that
   elapsed between them. A time the clocks skip (2:00–3:00 a.m. the night they
   spring forward) is refused in plain words, in the panel and by the server
   (`timeBackTimeSkipped`). A time they repeat (1:00–2:00 a.m. the night they
   go back) shows a small choice under that field, and only then: "first 1:xx
   (before clocks went back)" or "second 1:xx (after)". The request carries it
   as `startOccurrence` / `endOccurrence` (`first` | `second`); the server
   refuses a repeated time without it (`timeBackTimeAmbiguous`) and ignores it
   on any other time (Codex r2 #4, 2026-11-19).
3. **Preview** — a dry run with no writes: counts per field, horses that
   un-retire, worked examples, and every job run inside the window with its
   irreversible effects.
4. **Give back** — the Owner asks for an emailed code and types it; the
   operation recomputes everything inside the apply transaction. No confirm
   page and no receipt (owner ruling 2026-10-26): the list of time-backs
   changes on the page.
5. **Release jobs.**

**Reverse** adds back the career weeks the time-back took (rule 3) and restores
every other recorded old value only where the field still holds the value the
time-back wrote; values changed by play since then are left alone and
listed — every one the undo did not restore, including a value play set back to
exactly its pre-time-back value (Codex r2 #8). It needs its own fresh emailed code, is recorded and linked to the
original, and runs once.

**Irreversible effects** (named in the preview, never silently undone): shows
already completed and paid, elections already closed, foals already born,
grooms already released for unpaid fees, hoof condition already lowered,
traits already revealed, payroll already charged.

## Related controls in the same project

- **Deliver overdue foals now** replaces `POST /api/admin/foaling/trigger`'s
  8-day fast-forward: it runs the foaling job at real time, so only mares
  already past their due time foal. The fast-forward is removed.
- **Horse lookup** by id or name shows owner, birth date, age, retired or not,
  pregnancy and due time, and foal development day. Built 2026-11-18:
  `GET /api/v1/staff/horses/lookup?q=` behind `horse.admin` (the Owner and
  Admins; moderators are refused), at most 20 horses, ages read from the birth
  date on the Eastern calendar. It also shows the horse's traits by their
  authored names; hidden traits are named for the Owner alone
  (`traits.hidden.view`), everyone else sees how many are hidden.

## Fields not yet ruled on

A `DateTime` field added later that drives play goes in `unruledFields` in
`backend/modules/staff/services/timeBackClassification.mjs` until the owner
rules; it is not moved, and the preview names it as left alone. The list is
empty since owner ruling q383 (2026-11-18).

## Tests the implementation must provide

Real database and real admin HTTP path (role, CSRF, MFA); no mocks.

- Every rule with fields before, during, and after the window; day rounding;
  un-retirement at 21; passed deadlines stay passed; both training gates move.
- Preview writes nothing.
- Apply refuses without a hold, without MFA, for a non-admin, for an overlapping
  window, a future end, and a window over 30 days.
- A player action during apply is neither overwritten nor double-shifted.
- A show entry during apply over the same horse, show or account finishes and
  so does the apply (`staffTimeBackShowEntryLocks.integration.test.mjs`).
- Reverse restores, skips values changed by play, and cannot run twice; it
  waits for a running job body.
- Career weeks come back only where a pass recorded adding them: not for an
  inactive groom, a failed increment, or trainers after a half-failed pass; a
  pass with no run-log row still counts; a window before the record leaves the
  counts alone and names them; a week is never given back twice — not after an
  undo, a later pass and a re-apply over an overlapping window, nor by two
  overlapping give-backs (`staffTimeBackCareerWeeks.integration.test.mjs`).
- A held job skips after a simulated restart, including `showScheduler` and
  Registry B jobs.
- Overdue foaling foals only past-due mares; the fast-forward endpoint is gone.
- The classification sentinel fails on a planted unclassified `DateTime` field.
