/**
 * 🐎 LOAD TEST: Concurrent Feed + Breed + Foaling Under Contention
 *
 * Surfaces the lost-update / double-create race classes documented in
 * Equoria-zvp4 (re-opened nsr7) and Equoria-k8t5:
 *
 *   1. Inventory lost-update — two parallel POST /horses/:id/feed for horses
 *      owned by the same user both read inventory quantity N, both write N-1.
 *      Net effect: one feed pack vanishes without a corresponding stat/feed.
 *   2. pregnancyFeedingsByTier lost-update — when the fed horse is in-foal,
 *      feedHorse() does a read-modify-write of the JSON counter object inside
 *      a READ COMMITTED transaction (horseFeedService.mjs:215-222). Two
 *      parallel feeds on the in-foal mare can lose one counter increment.
 *   3. Double-foal-creation — two parallel POST /horses/:id/foal-now on the
 *      same in-foal mare can both pass the `inFoalSinceDate` guard and both
 *      materialise a foal row (cron-vs-mutation conflict class — the bulk
 *      foaling job hits the same window).
 *
 * STRATEGY
 * --------
 * The lost-update window only opens when the SAME logical row is hit by
 * concurrent transactions. So this harness provisions ONE user with ONE
 * in-foal mare and a fixed feed inventory, then drives a burst of parallel
 * feed requests at that single mare, plus a parallel burst of foal-now
 * requests. After the run it reads back the ground-truth state via the API
 * and asserts the conservation invariants:
 *
 *   successful_feeds  ==  inventory_units_consumed   (no lost decrement)
 *   successful_feeds  ==  pregnancy_counter_total    (no lost increment)
 *   foals_materialised <= 1                          (no double-create)
 *
 * A violation of any invariant means the race is live on master and the
 * scenario has done its job (file the concrete bug per AC).
 *
 * REAL DB: this runs against the canonical Equoria DB per project policy.
 * It self-provisions a uniquely-named throwaway user (`LoadFixture-…`) and
 * only ever touches rows it created. No broad cleanup. The fixture user +
 * its horses remain after the run (scoped, named) for post-mortem; delete
 * with a name-scoped query if desired — never a bare deleteMany.
 *
 * Usage:
 *   # Backend must be running (npm run dev) against .env.test DB.
 *   k6 run backend/tests/load/concurrent-feed-breed-foal.test.js
 *
 *   # Tunables:
 *   k6 run -e API_URL=http://localhost:3000 \
 *          -e FEED_VUS=30 -e FEED_ITERS=200 \
 *          backend/tests/load/concurrent-feed-breed-foal.test.js
 *
 * Smoke mode (CI-friendly, ~15s, lower concurrency):
 *   k6 run -e SMOKE=1 backend/tests/load/concurrent-feed-breed-foal.test.js
 *
 * Environment Variables:
 *   API_URL    Base URL of API            (default http://localhost:3000)
 *   FEED_VUS   Parallel feed virtual users (default 25, smoke 5)
 *   FEED_ITERS Total feed iterations       (default 150, smoke 20)
 *   SMOKE      "1" => low-concurrency CI smoke profile
 *
 * @module tests/load/concurrent-feed-breed-foal
 */

import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Gauge } from 'k6/metrics';
import crypto from 'k6/crypto';

const API_URL = __ENV.API_URL || 'http://localhost:3000';
const SMOKE = __ENV.SMOKE === '1';

const FEED_VUS = parseInt(__ENV.FEED_VUS || (SMOKE ? '5' : '25'), 10);
const FEED_ITERS = parseInt(__ENV.FEED_ITERS || (SMOKE ? '20' : '150'), 10);

// ── Custom metrics ────────────────────────────────────────────────────────
const feedSuccess = new Counter('feed_success'); // 200 from /feed
const feedAlreadyFed = new Counter('feed_already_fed'); // 4xx "already fed today"
const feedError = new Counter('feed_error'); // unexpected non-2xx
const foalSuccess = new Counter('foal_now_success'); // 201 from /foal-now
const foalRejected = new Counter('foal_now_rejected'); // 400 "not in foal"
const lostUpdateInventory = new Gauge('lost_update_inventory_units');
const lostUpdatePregnancy = new Gauge('lost_update_pregnancy_count');
const doubleFoalCount = new Gauge('double_foal_count');

// One packs = 100 units (matches FEED_CATALOG). Buy enough head-room.
const PACKS_TO_BUY = SMOKE ? 1 : 3;
const FEED_TIER = 'basic';

export const options = {
  scenarios: {
    // Burst of parallel feeds at the single shared in-foal mare. This is the
    // contended path: every iteration POSTs /feed for the SAME horseId, with
    // a reset-last-fed beforehand so the same-day gate doesn't trivially
    // serialise everything into "already fed".
    feed_contention: {
      executor: 'shared-iterations',
      vus: FEED_VUS,
      iterations: FEED_ITERS,
      maxDuration: SMOKE ? '30s' : '3m',
      exec: 'feedContention',
    },
    // Parallel foal-now burst against the same in-foal mare — exercises the
    // double-create window the bulk foaling cron shares.
    foal_race: {
      executor: 'shared-iterations',
      vus: SMOKE ? 3 : 8,
      iterations: SMOKE ? 6 : 16,
      maxDuration: SMOKE ? '30s' : '2m',
      startTime: SMOKE ? '5s' : '20s', // fire mid-stream, after feeds warm up
      exec: 'foalRace',
    },
  },
  thresholds: {
    // The harness's job is to SURFACE races, not to be green by luck. These
    // thresholds make k6 exit non-zero if a conservation invariant breaks,
    // so this can gate CI once wired in.
    lost_update_inventory_units: ['value==0'],
    lost_update_pregnancy_count: ['value==0'],
    double_foal_count: ['value<=1'],
    feed_error: ['count==0'],
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
  res = mustOk(http.get(`${API_URL}/api/breeds`, { jar }), 'GET /api/breeds');
  const breeds = res.json();
  const breedList = breeds.data || breeds;
  const breedId = breedList[0].id;

  // 4. Create stallion + mare.
  res = mustOk(
    http.post(
      `${API_URL}/api/horses`,
      JSON.stringify({ name: `LoadFixture Stallion ${stamp}`, breedId, age: 5, sex: 'stallion' }),
      { headers: H, jar },
    ),
    'create stallion',
  );
  const stallionId = res.json().data.id;

  res = mustOk(
    http.post(
      `${API_URL}/api/horses`,
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

  // Read the mare's baseline state for post-run conservation math.
  res = mustOk(http.get(`${API_URL}/api/v1/horses`, { jar }), 'GET /api/v1/horses baseline');
  const horses = (res.json().data || res.json()).filter ? res.json().data || res.json() : [];
  const mare = (Array.isArray(horses) ? horses : []).find(h => h.id === mareId) || {};
  const baselinePregCount = sumCounters(mare.pregnancyFeedingsByTier);

  return {
    email,
    password,
    csrfToken,
    cookieHeader: jar.cookiesForURL(`${API_URL}/`),
    mareId,
    stallionId,
    breedId,
    stamp,
    baselinePregCount,
  };
}

function sumCounters(obj) {
  if (!obj || typeof obj !== 'object') {
    return 0;
  }
  return Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);
}

// VU-scoped: each VU gets its own cookie jar but logs in as the SAME fixture
// user, so all feed mutations contend on the same inventory + mare row.
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
 * feedContention(): the contended hot path. Reset the same-day gate, then
 * POST /feed at the shared mare. Many VUs do this in parallel against the
 * SAME horse — that is the lost-update window.
 */
export function feedContention(data) {
  const { jar, headers } = vuSession(data);

  // Rewind the same-day feed gate so the feed call isn't trivially rejected.
  // (Owner-scoped fixture endpoint, Equoria-4sqr.)
  http.post(`${API_URL}/api/v1/horses/${data.mareId}/reset-last-fed`, JSON.stringify({ days: 1 }), { headers, jar });

  const res = http.post(`${API_URL}/api/v1/horses/${data.mareId}/feed`, null, { headers, jar });

  if (res.status === 200 || res.status === 201) {
    feedSuccess.add(1);
  } else if (res.status >= 400 && res.status < 500 && /already fed|fed today/i.test(res.body || '')) {
    feedAlreadyFed.add(1);
  } else {
    feedError.add(1);
    check(res, { 'feed unexpected error logged': () => false });
  }
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
 * teardown(): read ground-truth state back and assert the conservation
 * invariants. This is where a live race becomes a hard failure.
 *
 * IMPORTANT k6 constraint: VU-side Counters cannot be read here, and module
 * state is NOT shared across VU isolates. So every invariant below is
 * derived PURELY from final API/DB state — no reliance on in-process
 * per-VU counters.
 *
 * THE ATOMIC-TRIPLE INVARIANT (the core check)
 * --------------------------------------------
 * feedHorse() commits exactly three writes per successful IN-FOAL feed,
 * inside ONE transaction (horseFeedService.mjs:224-231):
 *   (a) inventory[tier].quantity -= 1
 *   (b) pregnancyFeedingsByTier[tier] += 1   (only while inFoalSinceDate set)
 *   (c) lastFedDate = now
 * If (a) and (b) always commit together under contention, then for the
 * window the mare was in-foal:
 *
 *     inventory_units_consumed_while_in_foal  ==  pregnancy_counter_delta
 *
 * Both sides are read from the DB at the end — no cross-VU bookkeeping:
 *   • inventory_consumed       = bought - 2(setup seeds, pre-pregnancy) - remaining
 *   • pregnancy_counter_delta  = sum(pregnancyFeedingsByTier) - baseline
 *
 * The 2 setup seed-feeds run BEFORE the pregnancy starts (inFoalSinceDate
 * still NULL), so they consume inventory but do NOT bump the counter — that
 * is the constant -2 offset, fully accounted for.
 *
 * Once foal-now materialises the foal it clears inFoalSinceDate, so any
 * feed AFTER that consumes inventory but stops bumping the counter. Hence
 * the precise assertions:
 *   • foals == 0  →  consumed MUST EQUAL counter-delta exactly. A mismatch
 *                    is a torn triple (lost inventory decrement OR lost
 *                    counter increment) — the Equoria-zvp4 race, live.
 *   • foals >= 1  →  consumed MUST BE >= counter-delta (post-foaling feeds
 *                    add to consumed only). consumed < counter-delta is
 *                    impossible without a lost inventory decrement and is
 *                    still flagged.
 *   • foals  > 1  →  double-foal-creation race, live.
 */
export function teardown(data) {
  const jar = http.cookieJar();
  http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({ email: data.email, password: data.password }), {
    headers: { 'Content-Type': 'application/json' },
    jar,
  });

  const horsesRes = http.get(`${API_URL}/api/v1/horses`, { jar });
  const payload = horsesRes.json();
  const horses = Array.isArray(payload) ? payload : payload.data || [];
  const mareRows = horses.filter(h => h.id === data.mareId);
  const foalRows = horses.filter(h => h.name && h.name.indexOf(`LoadFixture Foal ${data.stamp}`) === 0);

  // ── Invariant 3: at most one foal materialised from this single pregnancy.
  const foalsCreated = foalRows.length;
  doubleFoalCount.add(foalsCreated);
  check(null, {
    'no double-foal-creation (<=1 foal row)': () => foalsCreated <= 1,
  });

  // ── pregnancy counter delta (DB ground truth).
  const mare = mareRows[0] || {};
  const pregDelta = sumCounters(mare.pregnancyFeedingsByTier) - data.baselinePregCount;

  // ── inventory remaining for the fed tier (DB ground truth via equippable).
  const eqRes = http.get(`${API_URL}/api/v1/horses/${data.mareId}/equippable`, { jar });
  let remainingUnits = null;
  if (eqRes.status === 200) {
    const eqBody = eqRes.json();
    const feeds = (eqBody.data && (eqBody.data.feeds || eqBody.data.feed)) || eqBody.feeds || [];
    const tierRow = (Array.isArray(feeds) ? feeds : []).find(
      f => f.tier === FEED_TIER || f.id === FEED_TIER || f.feedType === FEED_TIER,
    );
    if (tierRow) {
      remainingUnits = tierRow.quantity ?? tierRow.units ?? null;
    }
  }

  // ── Atomic-triple evaluation (pure DB math, no per-VU counters).
  const bought = PACKS_TO_BUY * 100;
  let inventoryConsumed = null;
  let tripleViolation = 0; // |consumed - pregDelta| under the foals==0 rule
  let pregLostIncrement = 0;
  if (remainingUnits !== null) {
    inventoryConsumed = bought - 2 - remainingUnits; // -2 = pre-pregnancy seed feeds
    if (foalsCreated === 0) {
      // Exact conservation required: each in-foal feed = 1 unit + 1 counter.
      tripleViolation = Math.abs(inventoryConsumed - pregDelta);
    } else {
      // Post-foaling feeds add to consumed only; consumed < pregDelta is
      // impossible without a lost inventory decrement.
      tripleViolation = inventoryConsumed < pregDelta ? pregDelta - inventoryConsumed : 0;
    }
    // A definite lost increment: inventory shows in-foal feeds happened
    // (consumed > 0 beyond the seed offset) yet the counter never moved.
    if (inventoryConsumed > 0 && pregDelta === 0 && foalsCreated === 0) {
      pregLostIncrement = 1;
    }
  }
  lostUpdateInventory.add(tripleViolation);
  lostUpdatePregnancy.add(pregLostIncrement);

  // Equoria-326tg: k6 runtime supports console.warn — using it here keeps the
  // run-summary trace visible while avoiding the bare-console-log gate.
  console.warn(
    `[concurrent-feed-breed-foal] stamp=${data.stamp} ` +
      `foalsCreated=${foalsCreated} pregDelta=${pregDelta} ` +
      `remainingUnits=${remainingUnits} inventoryConsumed=${inventoryConsumed} ` +
      `tripleViolation=${tripleViolation} pregLostIncrement=${pregLostIncrement}`,
  );

  check(null, {
    'atomic-triple holds (inventory-consumed == pregnancy-delta)': () => tripleViolation === 0,
    'no definite pregnancy lost-increment': () => pregLostIncrement === 0,
  });
}
