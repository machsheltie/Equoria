import os from 'os';

const parseBool = value => ['true', '1', 'yes'].includes(String(value || '').toLowerCase());

export const getWorkerCount = ({ env = process.env, cpuCount = os.cpus().length } = {}) => {
  const configured = Number.parseInt(env.WEB_CONCURRENCY || '', 10);
  const desired = Number.isFinite(configured) && configured > 0 ? configured : cpuCount;
  return Math.max(1, desired || 1);
};

export const shouldUseCluster = (env = process.env) => {
  if (env.NODE_ENV === 'test') {
    return false;
  }

  if (env.CLUSTER_ENABLED !== undefined) {
    return parseBool(env.CLUSTER_ENABLED);
  }

  if (env.NODE_ENV === 'production') {
    return getWorkerCount({ env }) > 1;
  }

  return false;
};

export default {
  getWorkerCount,
  shouldUseCluster,
};
