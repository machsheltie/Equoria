import { getWorkerCount, shouldUseCluster } from '../../utils/clusterManager.mjs';

describe('clusterManager', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('disables clustering by default in test env', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CLUSTER_ENABLED;

    expect(shouldUseCluster()).toBe(false);
  });

  it('enables clustering when explicitly enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.CLUSTER_ENABLED = 'true';

    expect(shouldUseCluster()).toBe(true);
  });

  it('uses WEB_CONCURRENCY when set', () => {
    process.env.WEB_CONCURRENCY = '4';

    expect(getWorkerCount({ cpuCount: 8 })).toBe(4);
  });

  it('defaults to CPU count when WEB_CONCURRENCY is not set', () => {
    delete process.env.WEB_CONCURRENCY;

    expect(getWorkerCount({ cpuCount: 6 })).toBe(6);
  });

  it('clamps invalid worker counts to 1', () => {
    process.env.WEB_CONCURRENCY = '0';

    expect(getWorkerCount({ cpuCount: 0 })).toBe(1);
  });
});
