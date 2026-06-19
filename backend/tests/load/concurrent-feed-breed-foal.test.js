/**
 * 🐎 LOAD TEST: Concurrent Foaling Under Contention (foal-race double-create gate)
 *
 * SCOPE (narrowed 2026-06-19, Equoria-kv2gz + Equoria-qi1ns):
 * --------------------------------------------------------------------------
 * This harness now exercises EXACTLY ONE race class — the double-foal-creation
 * window — which it gates correctly and which CANNOT be reproduced reliably in a
 * dedicated Jest test the way the feed races can (the foaling cron-vs-mutation
 * window is the point):
 *
 *   Double-foal-creation — two parallel POST /horses/:id/foal-now on the same
 *   in-foal mare can both pass the `inFoalSinceDate` guard and both materialise a
 *   foal row (cron-vs-mutation conflict class — the bulk foaling job hits the same
 *   window). Gated by the cross-VU `foal_now_success` Counter (count<=1): proven
 *   RED at count=3 if the foalingService atomic claim (Equoria-wgw5k) is reverted.
 *
 * The TWO feed race classes this harness used to carry are NO LONGER exercised
 * here — they are now covered by dedicated real-DB Jest concurrency tests that
 * bypass the HTTP rate limiter (so the contention actually materialises) and run
 * the STRONG exact-conservation assertion the rate-limited k6 path could not:
 *
 *   1. Feed lost-update / torn atomic-triple (inventory -1 pairs with pregnancy
 *      counter +1 in ONE tx) — Equoria-kv2gz, now covered by
 *      backend/modules/horses/__tests__/feedLostUpdateConcurrent.test.mjs.
 *      RATIONALE: every k6 VU logs in as the SAME fixture user, so all /feed
 *      mutations shared ONE rl:mutation bucket (30/min) → the limiter 429'd most
 *      feeds → feeds SERIALIZED → the concurrent lost-update window barely opened
 *      (lost_update_* stayed 0 partly because contention never materialised, not
 *      solely because the code is correct). The Jest test calls feedHorse()
 *      directly — no limiter — so the real tx races against itself.
 *
 *   2. In-foal feed conservation, EXACT equality (units consumed == counter
 *      delta while in-foal) — Equoria-qi1ns, now covered by
 *      backend/modules/horses/__tests__/inFoalFeedConservation.test.mjs.
 *      RATIONALE: the atomic foal-now claim sets pregnancyFeedingsByTier:{} when
 *      the foal is created, so once foal_race fires (every run) the counter is
 *      RESET and the teardown's exact-equality check could only run on a no-foal
 *      run — i.e. almost never. The Jest test never foals the mare, so it runs
 *      the exact-equality assertion across the whole in-foal window.
 *
 * STRATEGY
 * --------
 * The double-create window only opens when the SAME mare row is hit by concurrent
 * foal-now transactions. So this harness provisions ONE user with ONE in-foal
 * mare, then drives a burst of parallel foal-now requests at that single mare.
 * The `foal_now_success` Counter (k6 aggregates it GLOBALLY at end-of-run, so it
 * is independent of the teardown VU isolate) must stay <= 1.
 *
 * REAL DB: this runs against the canonical Equoria DB per project policy.
 * It self-provisions a uniquely-named throwaway user (`loadfixture_…`) and
 * only ever touches rows it created. teardown() then ERASES that fixture via
 * the scoped, FK-ordered POST /api/v1/account/delete cascade (Equoria-f42cl) —
 * deleting the user and every horse it owns (stallion, mare, any foal) — so no
 * `loadfixture_*` rows accrete in the canonical DB. Never a bare deleteMany.
 *
 * Usage:
 *   # Backend must be running (npm run dev) against .env.test DB.
 *   k6 run backend/tests/load/concurrent-feed-breed-foal.test.js
 *
 * Smoke mode (CI-friendly, ~15s, lower concurrency):
 *   k6 run -e SMOKE=1 backend/tests/load/concurrent-feed-breed-foal.test.js
 *
 * Environment Variables:
 *   API_URL    Base URL of API            (default http://localhost:3000)
 *   SMOKE      "1" => low-concurrency CI smoke profile
 *
 * @module tests/load/concurrent-feed-breed-foal
 */

import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import crypto from 'k6/crypto';

const API_URL = __ENV.API_URL || 'http://localhost:3000';
const SMOKE = __ENV.SMOKE === '1';

// ── Custom metrics ────────────────────────────────────────────────────────
// Scope (Equoria-kv2gz/qi1ns): the feed lost-update + conservation arms moved to
// dedicated Jest tests; the only invariant this harness gates is the foal-now
// double-create window via the cross-VU foal_now_success Counter.
const foalSuccess = new Counter('foal_now_success'); // 201 from /foal-now — cross-VU double-create gate (count<=1)
const foalRejected = new Counter('foal_now_rejected'); // 400 "not in foal"

// One packs = 100 units (matches FEED_CATALOG). The setup still seeds + feeds
// the horses once to clear the critical-health gate so the pregnancy can start.
const PACKS_TO_BUY = SMOKE ? 1 : 3;
const FEED_TIER = 'basic';

export const options = {
  scenarios: {
    // Parallel foal-now burst against the single shared in-foal mare — exercises
    // the double-create window the bulk foaling cron shares. This is the ONLY
    // scenario now: the feed-contention arm moved to dedicated Jest concurrency
    // tests (Equoria-kv2gz/qi1ns — see header), where the HTTP rate limiter does
    // not serialise the burst and the strong exact-conservation check can run.
    foal_race: {
      executor: 'shared-iterations',
      vus: SMOKE ? 3 : 8,
      iterations: SMOKE ? 6 : 16,
      maxDuration: SMOKE ? '30s' : '2m',
      exec: 'foalRace',
    },
  },
  thresholds: {
    // foal_now_success is a cross-VU Counter that k6 aggregates GLOBALLY at
    // end-of-run, so it is independent of the teardown VU isolate and counts
    // EVERY /foal-now that returned 201. >1 success == a real double-create
    // race. This REPLACES the former `double_foal_count: ['value<=1']` gauge
    // threshold, which was a confirmed PLACEBO: teardown derived that gauge
    // from a stale, field-stripped cached horse-list read that never saw the
    // freshly-created foal, so it passed (value 0) even when 3 foals were
    // genuinely created (Equoria-xkccu, lc2 evidence: foal_now_success=3 yet
    // double_foal_count=0). The Counter goes RED at count=3 if the
    // foalingService atomic claim (Equoria-wgw5k) is reverted — a real
    // sentinel, not a placebo.
    //
    // The former lost_update_inventory_units / lost_update_pregnancy_count /
    // feed_error thresholds were REMOVED: the feed lost-update + in-foal
    // conservation invariants they gated are now covered by the dedicated Jest
    // tests cited in the header (Equoria-kv2gz/qi1ns). They could not be reliably
    // gated here anyway — the per-user rl:mutation bucket serialised the feed
    // burst, and foaling zeroed pregnancyFeedingsByTier before teardown could
    // read the conservation delta.
    foal_now_success: ['count<=1'],
  },
};

// ── Shared fixture state (set in setup(), read by VUs + teardown()) ────────

function jsonHeaders(csrfToken) {
  return { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
}

function mustOk(res, label) {
  if (res.status < 200 || res.status >= 300) {
    fail(`${label} failed: ${res.status} ${res.body}`);
  }
  return res;
}

/**
 * setup(): provision a scoped throwaway user, an in-foal mare, a stallion,
 * and a known feed inventory. Returns the IDs + auth material the VUs need.
 * Runs ONCE before any VU.
 */
export function setup() {
  // Collision-resistant fixture ID (Equoria-ip82 / Equoria-3gti rule:
  // never Date.now()+Math.random()). k6/crypto.randomBytes is k6's
  // CSPRNG; hexEncode gives a 16-char hex token.
  const stamp = crypto.hexEncode(crypto.randomBytes(8));
  const email = `loadfixture_${stamp}@example.com`;
  const username = `LoadFixture_${stamp}`.slice(0, 30);
  const password = 'Password123!';

  // 1. Register (cookie jar auto-captures accessToken/refreshToken cookies).
  const jar = http.cookieJar();
  let res = http.post(
    `${API_URL}/api/v1/auth/register`,
    JSON.stringify({
      email,
      username,
      password,
      firstName: 'Load',
      lastName: 'Fixture',
      // COPPA age gate (Equoria-iqzn) made dateOfBirth a REQUIRED register
      // field after this harness first landed (d5175d50d). Omitting it made
      // /auth/register return 400 ("Date of birth is required"), so the user
      // was never created and the follow-up login 401'd — the exact
      // setup()-login failure that has kept the Load Contention CI job red.
      // A fixed adult DOB clears the under-13 rejection deterministically.
      dateOfBirth: '1990-01-01',
    }),
    { headers: { 'Content-Type': 'application/json' }, jar },
  );
  // Some deployments require explicit login post-register.
  if (res.status !== 201 && res.status !== 200) {
    mustOk(
      http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({ email, password }), {
        headers: { 'Content-Type': 'application/json' },
        jar,
      }),
      'login',
    );
  }
  // Ensure a session exists regardless of register/login branch.
  http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
    jar,
  });

  // 2. CSRF token (required by csrfProtection on authRouter mutations).
  res = mustOk(http.get(`${API_URL}/api/v1/auth/csrf-token`, { jar }), 'csrf-token');
  const csrfBody = res.json();
  const csrfToken = (csrfBody && csrfBody.csrfToken) || (csrfBody && csrfBody.data && csrfBody.data.csrfToken) || '';
  if (!csrfToken || csrfToken.length < 20) {
    fail(`CSRF token missing/short: ${res.body}`);
  }
  const H = jsonHeaders(csrfToken);

  // 3. Pick a breed.
  // Equoria-4bs3s removed the unversioned /api/* mounts; /api/v1/* is the only
  // surface now. This harness predates that change and still pointed at the
  // removed /api/breeds (404 "Route not found"), which aborted setup() right
  // after the COPPA dateOfBirth fix (fefh2.42) let register/login through —
  // the residual Load Contention CI red. Versioned path matches app.mjs:295.
  res = mustOk(http.get(`${API_URL}/api/v1/breeds`, { jar }), 'GET /api/v1/breeds');
  const breeds = res.json();
  const breedList = breeds.data || breeds;
  const breedId = breedList[0].id;

  // 4. Create stallion + mare.
  res = mustOk(
    http.post(
      `${API_URL}/api/v1/horses`, // Equoria-4bs3s: versioned surface (authRouter @ /api/v1, /horses POST)
      JSON.stringify({ name: `LoadFixture Stallion ${stamp}`, breedId, age: 5, sex: 'stallion' }),
      { headers: H, jar },
    ),
    'create stallion',
  );
  const stallionId = res.json().data.id;

  res = mustOk(
    http.post(
      `${API_URL}/api/v1/horses`, // Equoria-4bs3s: versioned surface (authRouter @ /api/v1, /horses POST)
      JSON.stringify({ name: `LoadFixture Mare ${stamp}`, breedId, age: 5, sex: 'mare' }),
      { headers: H, jar },
    ),
    'create mare',
  );
  const mareId = res.json().data.id;

  // 5. Buy feed inventory.
  mustOk(
    http.post(`${API_URL}/api/v1/feed-shop/purchase`, JSON.stringify({ feedTier: FEED_TIER, packs: PACKS_TO_BUY }), {
      headers: H,
      jar,
    }),
    'feed-shop purchase',
  );

  // 6. Equip + feed both horses once so they pass the critical-health gate
  //    (newly-created horses have lastFedDate NULL => displayedHealth
  //    'critical' => cannot breed; see feed-system-phase-b.spec.ts).
  for (const hid of [stallionId, mareId]) {
    mustOk(
      http.post(`${API_URL}/api/v1/horses/${hid}/equip-feed`, JSON.stringify({ feedType: FEED_TIER }), {
        headers: H,
        jar,
      }),
      `equip-feed ${hid}`,
    );
    mustOk(http.post(`${API_URL}/api/v1/horses/${hid}/feed`, null, { headers: H, jar }), `seed feed ${hid}`);
  }

  // 7. Start the pregnancy so the mare is in-foal (inFoalSinceDate set =>
  //    feed action bumps pregnancyFeedingsByTier; foal-now becomes valid).
  mustOk(
    http.post(
      `${API_URL}/api/v1/horses/foals`,
      JSON.stringify({
        name: `LoadFixture Foal ${stamp}`,
        breedId,
        sireId: stallionId,
        damId: mareId,
      }),
      { headers: H, jar },
    ),
    'start pregnancy',
  );

  return {
    email,
    password,
    csrfToken,
    cookieHeader: jar.cookiesForURL(`${API_URL}/`),
    mareId,
    stallionId,
    breedId,
    stamp,
  };
}

// VU-scoped: each VU gets its own cookie jar but logs in as the SAME fixture
// user, so all foal-now mutations contend on the same mare row.
function vuSession(data) {
  const jar = http.cookieJar();
  http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({ email: data.email, password: data.password }), {
    headers: { 'Content-Type': 'application/json' },
    jar,
  });
  const res = http.get(`${API_URL}/api/v1/auth/csrf-token`, { jar });
  const b = res.json();
  const csrf = (b && b.csrfToken) || (b && b.data && b.data.csrfToken) || data.csrfToken;
  return { jar, headers: jsonHeaders(csrf) };
}

/**
 * foalRace(): hammer foal-now at the same in-foal mare. The first to commit
 * should materialise the foal and clear inFoalSinceDate; every later call
 * should 400 "not in foal". If >1 returns 201, the double-create window is
 * live.
 */
export function foalRace(data) {
  const { jar, headers } = vuSession(data);
  const res = http.post(`${API_URL}/api/v1/horses/${data.mareId}/foal-now`, null, {
    headers,
    jar,
  });
  if (res.status === 201) {
    foalSuccess.add(1);
  } else if (res.status === 400 && /not currently in foal|not in foal/i.test(res.body || '')) {
    foalRejected.add(1);
  }
  sleep(0.05);
}

/**
 * teardown(): read the mare's foaling ground-truth for the run-summary trace,
 * then erase the throwaway fixture.
 *
 * SCOPE (Equoria-kv2gz/qi1ns): the atomic-triple feed-conservation math that
 * used to live here was REMOVED. It depended on reading pregnancyFeedingsByTier
 * after the run, but the foal_race scenario (which fires every run) zeroes that
 * counter when the foal is created — so the exact-equality check could almost
 * never run, and the rate limiter had already serialised the feeds it was meant
 * to gate. Those invariants are now covered by the dedicated real-DB Jest tests
 * cited in the file header (feedLostUpdateConcurrent.test.mjs,
 * inFoalFeedConservation.test.mjs).
 *
 * The double-create invariant THIS harness exists for is gated by the
 * `foal_now_success` Counter (count<=1) threshold in options — a cross-VU
 * Counter k6 aggregates at end-of-run, independent of this teardown VU isolate.
 * No assertion is needed here for it.
 */
export function teardown(data) {
  const jar = http.cookieJar();
  http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({ email: data.email, password: data.password }), {
    headers: { 'Content-Type': 'application/json' },
    jar,
  });

  // Read mare ground-truth from the UNCACHED detail endpoint (GET /:id) purely
  // for the run-summary trace. inFoalSinceDate === null means a foal WAS created
  // this run (the atomic claim clears it). The detail route returns every column
  // off req.horse (ownership middleware does no `select`) and is not cache-wrapped.
  const mareRes = http.get(`${API_URL}/api/v1/horses/${data.mareId}`, { jar });
  const mare = (mareRes.status === 200 && (mareRes.json().data || mareRes.json())) || {};
  const foalsCreated = mare.inFoalSinceDate === null ? 1 : 0;

  // Equoria-326tg: k6 runtime supports console.warn — using it here keeps the
  // run-summary trace visible while avoiding the bare-console-log gate.
  console.warn(`[concurrent-feed-breed-foal] stamp=${data.stamp} foalsCreated=${foalsCreated}`);

  // ── Cleanup (Equoria-f42cl): erase the throwaway fixture so no loadfixture_*
  // rows accrete in the canonical DB. k6 cannot touch Prisma, so the API-native
  // scoped delete is POST /api/v1/account/delete — a single-transaction,
  // FK-ordered, strictly userId-scoped cascade that removes the fixture user
  // AND every horse it owns: the stallion, the mare, and any foal materialised
  // this run (foals inherit the dam's userId). This is the scoped,
  // non-bare-deleteMany cleanup CLAUDE.md §2 requires. Runs AFTER the
  // conservation reads above (which need the rows to still exist). Fail-loud:
  // assert the 200, and prove the cascade committed by confirming the fixture
  // user can no longer authenticate.
  const csrfRes = http.get(`${API_URL}/api/v1/auth/csrf-token`, { jar });
  const csrfBody = csrfRes.json();
  const teardownCsrf = (csrfBody && csrfBody.csrfToken) || (csrfBody && csrfBody.data && csrfBody.data.csrfToken) || '';
  const delRes = http.post(`${API_URL}/api/v1/account/delete`, JSON.stringify({ password: data.password }), {
    headers: jsonHeaders(teardownCsrf),
    jar,
  });
  const deleted = delRes.status === 200;

  // A login AFTER erasure must no longer yield an authenticated session — the
  // fixture user row (and its FK-cascaded horses) are gone. Fresh jar so the
  // now-stale session cookies cannot mask the result.
  const postDelLogin = http.post(
    `${API_URL}/api/v1/auth/login`,
    JSON.stringify({ email: data.email, password: data.password }),
    { headers: { 'Content-Type': 'application/json' }, jar: http.cookieJar() },
  );
  const userGone = postDelLogin.status >= 400;

  console.warn(
    `[concurrent-feed-breed-foal] cleanup stamp=${data.stamp} ` +
      `accountDelete=${delRes.status} postDeleteLogin=${postDelLogin.status} userGone=${userGone}`,
  );

  check(null, {
    'fixture erased: POST /account/delete -> 200': () => deleted,
    'fixture user no longer authenticates after erasure': () => userGone,
  });

  if (!deleted) {
    fail(`[concurrent-feed-breed-foal] fixture cleanup FAILED: account/delete ${delRes.status} ${delRes.body}`);
  }
}
