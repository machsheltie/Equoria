# Outage Time-Back Contract

- **Status:** Planned — owner-approved design (2026-10-06), not implemented
- **Owner:** Project owner (Stacey)
- **Last verified:** 2026-10-06
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
2. Only the admin can apply or reverse a time-back, and only with MFA enrolled
   and verified.
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

| Rule                   | Applies to                                          | New value                                                                |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| **1 Past event**       | anchors whose elapsed time drives play              | `t ≤ S → t + N`; `S < t < E → E`; `t ≥ E → t`                            |
| **2 Pending deadline** | future unlock/close times                           | `t > S → t + N`; otherwise unchanged (nothing already finished re-locks) |
| **3 Job counter**      | integers a scheduled job advanced inside the window | reverse the ticks that ran inside the window (from the run log)          |
| **4 Never moved**      | security, accounting, records, history displays     | unchanged                                                                |

`@db.Date` columns (`Horse.dateOfBirth`, `Horse.lastBredDate`,
`Horse.lastVettedDate`) move by `N` rounded to the nearest whole day. Ages are
counted in whole UTC calendar days (`getHorseAgeDays`), so no precision is lost
for play.

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

**Rule 3 — job counters:** `Groom.careerWeeks` (groomCareerProgression, Mon
09:45 UTC), `Rider.careerWeeks` and `Trainer.careerWeeks`
(weeklyRiderTrainerCareerWeeks, Mon 00:15 UTC), `FoalDevelopment.currentDay`
(dailyTraitEvaluation — clamp to the foal's new age, Equoria-3i34b).
`Horse.age` is recomputed from the shifted birth date in the same transaction.

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

**Time zone — owner ruling (repeated 2026-10-09):** all game timing runs on
Eastern time, never UTC. The window `S`/`E`, calendar-day ages, bank weeks and
job schedules are read in Eastern; the UTC wording in the code survey above
describes the code as surveyed on 2026-10-06 and must be re-checked against the
Eastern migration before planning. Raw SQL must still bind instants with an
explicit zone.

## Blocking dependency: fresh-code proof (STAFF-CR-06)

The staff foundation has no fresh-code proof. Its only primitive for `time-back`
is the ordinary capability guard, which a device trusted for up to 30 days
satisfies, so an apply or reverse endpoint built on it would accept a month-old
check-in. This project must build the proof before any apply or reverse route
exists:

- A purpose-bound, one-time, short-lived fresh check-in proof, consumed
  atomically by apply and by reverse. It is not interchangeable with the 30-day
  device cookie.
- Invalidated by a password change, a verified-email change, or a role change.
- A `requireFreshStaffProof` route guard in front of apply and reverse.

Until it exists, the `time-back` and `jobs.hold` capabilities must not be
mounted: `scripts/doctrine-checks/check-staff-routes-guarded.mjs` refuses any
staff route guarded by either. Once the guard exists, relax that rule to "must
be preceded by `requireFreshStaffProof`".

Regressions this project must provide: a trusted 30-day device alone cannot
authorize apply or reverse; a fresh purpose-bound proof works once; replay,
expiry, password change, role change, and use for the wrong purpose all fail.

## Nightly-job hold

The in-memory scheduler stop does not survive a restart, and `server.mjs` starts
every scheduled job at boot in production, plus `showScheduler` every 10
minutes. A hold must therefore be durable:

- A single `GameControl` record (`jobsHeld`, `heldAt`, `heldBy`, `reason`) is
  read at boot and before every run of **every** scheduled job — Registry A
  (`services/jobs`), Registry B (`services/cron-job-service-jobs`) and
  `showScheduler`. A held job records `skipped-held` and does nothing.
- Hold and release are admin actions recorded in the staff action log.
- Registry B jobs, `showScheduler` and admin manual triggers must write
  `CronRunLog` rows (today they do not), so the preview can name every run that
  happened inside a window.

## Operation

1. **Hold jobs** (required; the panel offers it).
2. **Enter the window** (`S`, `E` in Eastern time).
3. **Preview** — a dry run with no writes: counts per field, horses that
   un-retire, worked examples, and every job run inside the window with its
   irreversible effects.
4. **Confirm** — the admin types the pause length and an MFA code; the
   operation recomputes everything inside the apply transaction.
5. **Release jobs.**

**Reverse** restores recorded old values only where the field still holds the
value the time-back wrote; values changed by play since then are left alone and
listed. It needs MFA, is recorded and linked to the original, and runs once.

**Irreversible effects** (named in the preview, never silently undone): shows
already completed and paid, elections already closed, foals already born,
grooms already released for unpaid fees, hoof condition already lowered,
traits already revealed, payroll already charged.

## Related controls in the same project

- **Deliver overdue foals now** replaces `POST /api/admin/foaling/trigger`'s
  8-day fast-forward: it runs the foaling job at real time, so only mares
  already past their due time foal. The fast-forward is removed.
- **Horse lookup** by id or name shows owner, birth date, age, retired or not,
  pregnancy and due time, and foal development day.

## Tests the implementation must provide

Real database and real admin HTTP path (role, CSRF, MFA); no mocks.

- Every rule with fields before, during, and after the window; day rounding;
  un-retirement at 21; passed deadlines stay passed; both training gates move.
- Preview writes nothing.
- Apply refuses without a hold, without MFA, for a non-admin, for an overlapping
  window, a future end, and a window over 30 days.
- A player action during apply is neither overwritten nor double-shifted.
- Reverse restores, skips values changed by play, and cannot run twice.
- A held job skips after a simulated restart, including `showScheduler` and
  Registry B jobs.
- Overdue foaling foals only past-due mares; the fast-forward endpoint is gone.
- The classification sentinel fails on a planted unclassified `DateTime` field.
