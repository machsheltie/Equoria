/**
 * MSW Handler Path Registry (AI-8-1)
 *
 * SINGLE SOURCE OF TRUTH for all API paths mocked in tests.
 * When adding or changing a path in api-client.ts, update the matching
 * handler here AND update this registry comment. This prevents the silent
 * drift that caused 3/6 Epic 8 stories to have URL mismatches.
 *
 * (Equoria-urqic.1) This file is now a BARREL. The handler implementations
 * live in per-domain modules under ./handlers/. They are composed below in
 * the EXACT registration order they had when this file was monolithic —
 * MSW matches first-registered-wins, so the order of the spreads is
 * load-bearing and must not be reordered.
 *
 * FORMAT: METHOD /api/path  →  handler description
 *
 * ── Auth ─────────────────────────────────────────────────────────────────
 * POST   /api/v1/auth/login                          login with email/password
 * POST   /api/v1/auth/register                       register new user
 * POST   /api/v1/auth/logout                         logout
 * POST   /api/v1/auth/refresh-token                  refresh JWT
 * GET    /api/v1/auth/profile                        get current user profile
 * GET    /api/v1/auth/me                             alias for profile
 * POST   /api/v1/auth/forgot-password                send reset email
 * POST   /api/v1/auth/reset-password                 reset with token
 * GET    /api/v1/auth/verification-status            email verification status
 *
 * ── Users ────────────────────────────────────────────────────────────────
 * (Equoria-0fw18) Every path below is VERSIONED /api/v1/... to match the real
 * api-client surface (frontend/src/lib/api/*.ts). Dead unversioned /api/...
 * handlers were deleted/versioned in Equoria-0fw18.
 * GET    /api/v1/users/:id                          get user by id
 * GET    /api/v1/users/:id/progress                 user XP/level progress
 * GET    /api/v1/users/:id/activity                 recent activity feed
 * GET    /api/v1/users/:id/competition-stats        competition statistics
 * GET    /api/v1/users/:userId/prize-history        prize history (paginated)
 * GET    /api/v1/users/dashboard/:id                dashboard summary
 * GET    /api/v1/users/me/game-notifications      in-game stat-gain notifications (Equoria-sqyb)
 * PATCH  /api/v1/users/me/game-notifications/read-all  mark all notifications read
 *
 * ── Horses ───────────────────────────────────────────────────────────────
 * GET    /api/v1/horses                             list all user horses
 * GET    /api/v1/horses/:id                         horse detail
 * GET    /api/v1/horses/:id/training-history        training log
 * GET    /api/v1/horses/:id/environmental-analysis  epigenetic environment
 * GET    /api/v1/horses/:id/trait-interactions      trait synergy analysis
 * GET    /api/v1/horses/:id/developmental-timeline  foal milestone timeline
 * GET    /api/v1/horses/:id/forecast                genetic potential forecast
 * GET    /api/v1/horses/:id/breeding-data           breeding stats
 * GET    /api/v1/horses/:id/competition-history     show results history
 * GET    /api/v1/horses/:horseId/prize-summary      prize earnings summary
 * GET    /api/v1/horses/:horseId/xp-history         XP gain history
 * POST   /api/v1/horses/foals                       create foal / start pregnancy
 * GET    /api/v1/horses/user/eligible               horses eligible for competition
 * GET    /api/v1/horses/:id/conformation            conformation scores (8 regions)
 * GET    /api/v1/breeds/:id/conformation-averages   breed average conformation scores
 * (deleted dead: /level-info, /add-xp — no api-client call, no test ref)
 *
 * ── Training ─────────────────────────────────────────────────────────────
 * POST   /api/v1/training/check-eligibility         eligibility check
 * POST   /api/v1/training/train                     execute training session
 * GET    /api/v1/training/status/:horseId           all disciplines status
 * GET    /api/v1/training/status/:horseId/:discipline  single discipline status
 * GET    /api/v1/training/trainable/:userId         trainable horses list
 *
 * ── Competitions ─────────────────────────────────────────────────────────
 * GET    /api/v1/competition                        show list (singular)
 * GET    /api/v1/competition/disciplines            available disciplines
 * GET    /api/v1/competition/eligibility/:horseId/:discipline  eligibility
 * POST   /api/v1/competition/enter                  enter show (singular)
 * GET    /api/v1/competitions                       paginated competition list
 * GET    /api/v1/competitions/:id                   competition detail
 * GET    /api/v1/competitions/:id/entries           competition entries
 * GET    /api/v1/competitions/:id/results           competition results
 * GET    /api/v1/competitions/:compId/eligibility/:userId  user eligibility
 * POST   /api/v1/competitions/enter                 enter competition (bulk)
 * (Equoria-o3try) removed claim-prizes POST handler — frontend claim concept deleted
 *
 * ── Breeding ─────────────────────────────────────────────────────────────
 * GET    /api/v1/foals/:id                          foal detail
 * GET    /api/v1/foals/:id/development              development status
 * GET    /api/v1/foals/:id/activities              available activities
 * POST   /api/v1/foals/:id/activity                 record activity
 * POST   /api/v1/foals/:id/enrich                   enrichment interaction
 * POST   /api/v1/foals/:id/reveal-traits           reveal hidden traits
 * PUT    /api/v1/foals/:id/develop                  apply development milestone
 * POST   /api/v1/genetics/inbreeding-analysis       inbreeding coefficient
 * POST   /api/v1/genetics/breeding-compatibility    compatibility score
 * GET    /api/v1/breeding/lineage-analysis/:stallionId/:mareId  lineage tree
 * POST   /api/v1/breeding/genetic-probability       genetic probability calc
 * (deleted dead: /api/foals/breeding/breed — no api-client call, no test ref)
 *
 * ── Grooms ───────────────────────────────────────────────────────────────
 * GET    /api/v1/grooms/user/:userId                grooms for user
 * GET    /api/v1/groom-assignments                  active assignments
 * GET    /api/v1/groom-salaries/summary             salary summary
 * POST   /api/v1/groom-assignments                  create assignment
 * GET    /api/v1/groom-marketplace                  available grooms to hire
 * POST   /api/v1/groom-marketplace/hire             hire a groom
 * POST   /api/v1/groom-marketplace/refresh          refresh marketplace
 *
 * ── Leaderboards ─────────────────────────────────────────────────────────
 * GET    /api/v1/leaderboards/:category             leaderboard by category
 * GET    /api/v1/leaderboards/user-summary/:userId  user rank summary
 * GET    /api/v1/leaderboards/horse/:horseId        leaderboard horse profile
 *
 * ── Forum (19B-1) ────────────────────────────────────────────────────────
 * GET    /api/v1/forum/threads                    paginated thread list
 * GET    /api/v1/forum/threads/:id                thread detail with posts
 * POST   /api/v1/forum/threads                    create thread
 * POST   /api/v1/forum/threads/:id/posts          add post to thread
 * POST   /api/v1/forum/threads/:id/view           increment view count
 * PATCH  /api/v1/forum/threads/:id/pin            pin/unpin thread (admin)
 *
 * ── Messages (19B-2) ─────────────────────────────────────────────────────
 * GET    /api/v1/messages/inbox                   inbox messages
 * GET    /api/v1/messages/sent                    sent messages
 * GET    /api/v1/messages/unread-count            unread count
 * GET    /api/v1/messages/:id                     message detail
 * POST   /api/v1/messages                         send message
 * PATCH  /api/v1/messages/:id/read                mark as read
 *
 * ── Marketplace / Horse Trader (Equoria-m1ck) ────────────────────────────
 * GET    /api/v1/breeds                           breed catalog (combobox)
 * POST   /api/v1/marketplace/store/buy            buy 3-year-old store horse
 *
 * ── Clubs (19B-3) ────────────────────────────────────────────────────────
 * GET    /api/v1/clubs                            club list (filterable)
 * GET    /api/v1/clubs/mine                       my memberships
 * GET    /api/v1/clubs/:id                        club detail with members
 * POST   /api/v1/clubs                            create club
 * POST   /api/v1/clubs/:id/join                   join club
 * DELETE /api/v1/clubs/:id/leave                  leave club
 * PATCH  /api/v1/clubs/:id/transfer-leadership    transfer presidency
 * GET    /api/v1/clubs/:id/elections              club elections
 * POST   /api/v1/clubs/:id/elections              create election
 * GET    /api/v1/clubs/elections/:id/results      election results
 * POST   /api/v1/clubs/elections/:id/nominate     nominate self
 * POST   /api/v1/clubs/elections/:id/vote         cast vote
 *
 * ─────────────────────────────────────────────────────────────────────────
 * To add a new handler: add the path above, then add http.verb() to the
 * matching per-domain module under ./handlers/. Register a NEW domain array
 * in the spread below at the correct first-match-wins position.
 * Keep in sync with: frontend/src/lib/api-client.ts
 */

import { authHandlers } from './handlers/auth';
import { horseHandlers } from './handlers/horses';
import { breedingHandlers } from './handlers/breeding';
import { groomHandlers } from './handlers/grooms';
import { userHandlers } from './handlers/user';
import { competitionHandlers } from './handlers/competition';
import { competitionResultsHandlers } from './handlers/competition-results';
import { prizeHandlers } from './handlers/prizes';
import { leaderboardHandlers } from './handlers/leaderboards';
import { catalogHandlers } from './handlers/catalog';
import { v1MirrorHandlers } from './handlers/v1-mirrors';
import { forumHandlers } from './handlers/forum';
import { messageHandlers } from './handlers/messages';
import { clubHandlers } from './handlers/clubs';
import { v1TrailingMirrorHandlers } from './handlers/v1-trailing-mirrors';

/**
 * v1-migration mirror — Epic 20 moved api-client to /api/v1/... while these
 * handlers still register /api/... Adding aliases at the end of the array
 * keeps both shapes mocked. When a legacy /api/... route is no longer
 * called by any production code or test, drop it AND its v1 mirror.
 *
 * ORDER IS LOAD-BEARING: MSW resolves first-registered-wins, so the spread
 * order below reproduces the exact registration order of the former
 * monolithic array. Do not reorder these spreads.
 */
export const handlers = [
  ...authHandlers,
  ...horseHandlers,
  ...breedingHandlers,
  ...groomHandlers,
  ...userHandlers,
  ...competitionHandlers,
  ...competitionResultsHandlers,
  ...prizeHandlers,
  ...leaderboardHandlers,
  ...catalogHandlers,
  ...v1MirrorHandlers,
  ...forumHandlers,
  ...messageHandlers,
  ...clubHandlers,
  ...v1TrailingMirrorHandlers,
];
