/**
 * Global teardown for the main Playwright profile (Equoria-oye1a follow-up).
 *
 * Two jobs, both about the shared-session keep-alive started in global-setup:
 *
 *  1. STOP THE TIMER. Without this the renewal keeps logging in for the whole
 *     of teardown and reporting. The timer is unref'd so it never blocks exit,
 *     but leaving it running is pointless work against the real backend.
 *
 *  2. FAIL THE RUN IF ANY RENEWAL FAILED. The renewal runs in the main process
 *     on a timer; a failure there used to be one console.error deep in the log
 *     while every plain-page spec silently reverted to the original bug
 *     (a storageState whose accessToken expired mid-run, presenting as
 *     "element(s) not found"). Throwing here makes that outcome a red run with
 *     the real reason attached. `createAuthedSession()` performs the same check
 *     per context, so API specs still fail at the point of use; this is the net
 *     that covers the specs which only use the plain `page` fixture.
 *
 * A thrown error in globalTeardown fails the Playwright run.
 */

import type { FullConfig } from '@playwright/test';
import { readStatus, statusPathFor } from './helpers/sessionKeepAlive';
import { stopGlobalSessionKeepAlive } from './global-setup';

async function globalTeardown(config: FullConfig) {
  stopGlobalSessionKeepAlive();

  const { storageState } = config.projects[0].use;
  if (typeof storageState !== 'string') {
    return;
  }

  const status = readStatus(storageState);
  if (!status) {
    throw new Error(
      `[session-keep-alive] no renewal status at ${statusPathFor(storageState)} after the run. ` +
        'global-setup.ts publishes it before any worker starts, so its absence means the shared ' +
        'session was never verified — treat this run as inconclusive, not green.'
    );
  }

  if (status.consecutiveFailures > 0) {
    throw new Error(
      `[session-keep-alive] ${status.consecutiveFailures} consecutive renewal failure(s) during ` +
        'this run: storageState.json was carrying a possibly-expired accessToken, so any spec ' +
        'that ran on the plain page fixture after that point was exercising a logged-out app. ' +
        `Last error: ${status.lastError}`
    );
  }

  const ageSeconds = Math.round((Date.now() - status.lastSuccessAt) / 1000);
  console.log(
    `[session-keep-alive] final status OK — last renewal ${ageSeconds}s before teardown.`
  );
}

export default globalTeardown;
