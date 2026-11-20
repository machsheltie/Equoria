/**
 * Exit 1 with a plain message when an E2E port is already held; exit 0 when
 * both are free. scripts/check-beta-readiness.sh runs this before the
 * Playwright beta-readiness suite. It only looks: it never stops a process.
 */
import { describeBusyE2ePorts, findBusyE2ePorts } from './e2eTestStack.mjs';

const busy = await findBusyE2ePorts();
if (busy.length > 0) {
  console.error(describeBusyE2ePorts(busy));
  process.exit(1);
}
