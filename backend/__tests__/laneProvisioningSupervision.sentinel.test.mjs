/**
 * Supervised-provisioning sentinel (Equoria-hqrqk; Codex review 2026-09-16
 * round 2, item 4).
 *
 * test-lane-db.mjs used to provision lanes with execFileSync — synchronous,
 * untimed, and invisible to cancellation: a hung `prisma migrate deploy` or
 * seed left the runner unable to handle a signal at all, and "await the
 * provisioning promise" could never resolve that. Provisioning steps are now
 * SUPERVISED async spawns: registered while alive, bounded by a deadline, and
 * stoppable through the same owned-children path as Jest shards.
 *
 * Proven here with real child processes and no database:
 *   1. a hung step is killed at its deadline, rejects with a message that says
 *      so, and is deregistered — nothing is left running;
 *   2. a live step is visible to cancellation (stopOwnedChildren) and is gone
 *      and deregistered before the caller proceeds;
 *   3. a healthy step resolves with its output and deregisters.
 *
 * Every spawned child is bounded by its own deadline and drained in afterEach.
 */
import { afterEach, describe, expect, test } from '@jest/globals';
import { stopOwnedChildren } from '../scripts/gate-lock.mjs';
import {
  activeProvisioningChildren,
  createLaneDatabase,
  PROVISIONING_CANCELLED,
  runSupervisedStep,
} from '../scripts/test-lane-db.mjs';

const HANG = 'setInterval(() => {}, 1000);';

afterEach(async () => {
  // Unconditional: kill and await anything a failed assertion left registered.
  const leftovers = [...activeProvisioningChildren];
  await stopOwnedChildren(leftovers, { escalateAfterMs: 2000 });
  activeProvisioningChildren.clear();
});

describe('lane provisioning supervision', () => {
  test('a hung provisioning step is killed at its deadline and deregistered', async () => {
    const started = Date.now();
    const step = runSupervisedStep({
      args: ['-e', HANG],
      cwd: process.cwd(),
      env: process.env,
      label: 'hung migrate',
      timeoutMs: 800,
    });

    // While it hangs it is visible to cancellation.
    await new Promise(r => setTimeout(r, 150));
    expect(activeProvisioningChildren.size).toBe(1);

    await expect(step).rejects.toThrow(/hung migrate was killed by SIGKILL/);
    await expect(step).rejects.toThrow(/deadline 800 ms/);

    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(750);
    expect(elapsed).toBeLessThan(10000);
    expect(activeProvisioningChildren.size).toBe(0); // deregistered on exit
  }, 20000);

  test('a live provisioning step is stopped by cancellation before the caller proceeds', async () => {
    const step = runSupervisedStep({
      args: ['-e', HANG],
      cwd: process.cwd(),
      env: process.env,
      label: 'live seed',
      timeoutMs: 20000,
    });
    await new Promise(r => setTimeout(r, 150));
    const [child] = [...activeProvisioningChildren];
    expect(child).toBeDefined();

    // The runner's owned-children step does exactly this before destroying a
    // database: stop, then AWAIT the exit.
    const { stopped, failed } = await stopOwnedChildren([child], { escalateAfterMs: 2000 });
    expect(failed).toEqual([]);
    expect(stopped).toEqual([child.pid]);
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);

    await expect(step).rejects.toThrow(/live seed was killed by/);
    expect(activeProvisioningChildren.size).toBe(0);
  }, 20000);

  test('a healthy provisioning step resolves with its output and deregisters', async () => {
    const out = await runSupervisedStep({
      args: ['-e', "process.stdout.write('migrated ok')"],
      cwd: process.cwd(),
      env: process.env,
      label: 'healthy step',
      timeoutMs: 20000,
    });
    expect(out).toBe('migrated ok');
    expect(activeProvisioningChildren.size).toBe(0);
  }, 20000);

  test('a failing provisioning step rejects with its exit code and stderr', async () => {
    await expect(
      runSupervisedStep({
        args: ['-e', "process.stderr.write('P1001: cannot reach database'); process.exit(3)"],
        cwd: process.cwd(),
        env: process.env,
        label: 'failing migrate',
        timeoutMs: 20000,
      }),
    ).rejects.toThrow(/failing migrate exited with code 3: P1001: cannot reach database/);
    expect(activeProvisioningChildren.size).toBe(0);
  }, 20000);

  /**
   * Codex round 3, P2 — barrier-driven regression. Cancellation lands while
   * createLaneDatabase() is awaiting the database, i.e. BEFORE the first
   * provisioning child exists. The runner's cleanup snapshot cannot see a child
   * that has not been launched, so the orchestration itself must refuse to
   * launch one once cancelled — and must drop the database it just created.
   *
   * The Postgres admin boundary (CREATE / DROP DATABASE) is modelled with a
   * barrier through the injectable `databaseOps`; every provisioning step is
   * the real code path. If the bug is present, the real `prisma migrate deploy`
   * launches (registering a child) and fails for want of a database — the
   * rejection would then NOT carry PROVISIONING_CANCELLED.
   */
  test('cancellation during the database wait launches no provisioning subprocess and drops the created database', async () => {
    const controller = new AbortController();
    let releaseCreate;
    const createBarrier = new Promise(r => {
      releaseCreate = r;
    });
    let createStarted;
    const started = new Promise(r => {
      createStarted = r;
    });
    const dropped = [];
    let maxChildrenSeen = 0;
    const sampler = setInterval(() => {
      maxChildrenSeen = Math.max(maxChildrenSeen, activeProvisioningChildren.size);
    }, 5);

    const provisioning = createLaneDatabase({
      runId: 'r3cancel',
      lane: 1,
      log: () => {},
      signal: controller.signal,
      databaseOps: {
        create: async () => {
          createStarted();
          await createBarrier; // the "database wait"
        },
        drop: async name => {
          dropped.push(name);
        },
      },
    });

    try {
      await started;
      controller.abort(new Error('signal SIGTERM')); // arrives DURING the wait
      releaseCreate(); // creation completes after cancellation

      await expect(provisioning).rejects.toMatchObject({ code: PROVISIONING_CANCELLED });
      await expect(provisioning).rejects.toThrow(/after creating/);
    } finally {
      clearInterval(sampler);
    }

    // No migration or seed was ever launched.
    expect(maxChildrenSeen).toBe(0);
    expect(activeProvisioningChildren.size).toBe(0);
    // The database that creation left behind was cleaned up.
    expect(dropped).toEqual(['equoria_lane_r3cancel_1']);
  }, 20000);

  test('cancellation before creation begins launches nothing and creates nothing', async () => {
    const controller = new AbortController();
    controller.abort(new Error('signal SIGINT'));
    let created = false;
    const dropped = [];

    await expect(
      createLaneDatabase({
        runId: 'r3early',
        lane: 2,
        log: () => {},
        signal: controller.signal,
        databaseOps: {
          create: async () => {
            created = true;
          },
          drop: async name => {
            dropped.push(name);
          },
        },
      }),
    ).rejects.toMatchObject({ code: PROVISIONING_CANCELLED });

    expect(created).toBe(false);
    expect(dropped).toEqual([]); // nothing was created, so nothing to drop
    expect(activeProvisioningChildren.size).toBe(0);
  }, 20000);

  test('cancellation mid-step terminates the running subprocess and reports it as cancelled', async () => {
    const controller = new AbortController();
    const step = runSupervisedStep({
      args: ['-e', HANG],
      cwd: process.cwd(),
      env: process.env,
      label: 'running migrate',
      timeoutMs: 20000,
      signal: controller.signal,
    });
    await new Promise(r => setTimeout(r, 150));
    const [child] = [...activeProvisioningChildren];
    expect(child).toBeDefined();

    controller.abort(new Error('signal SIGTERM'));

    await expect(step).rejects.toMatchObject({ code: PROVISIONING_CANCELLED });
    await expect(step).rejects.toThrow(/running migrate was running; it was terminated/);
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    expect(activeProvisioningChildren.size).toBe(0);
  }, 20000);

  test('an already-cancelled signal refuses to launch a step at all', async () => {
    const controller = new AbortController();
    controller.abort(new Error('signal SIGTERM'));
    await expect(
      runSupervisedStep({
        args: ['-e', HANG],
        cwd: process.cwd(),
        env: process.env,
        label: 'late seed',
        timeoutMs: 20000,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled before launching late seed/);
    expect(activeProvisioningChildren.size).toBe(0);
  }, 20000);
});
