/**
 * The owner's server memory and speed panel (Equoria-brh8c, owner ruling q158).
 *
 * Owner only (server.health.view), behind the emailed staff check-in. Reads the
 * same in-process sources as the admin endpoints /api/v1/memory and
 * /api/v1/optimization (the memory manager's report, the response optimisation
 * metrics) plus the per-route answer times the performance middleware keeps
 * (utils/routeTimings.mjs), and says them in plain words, with a report to copy.
 *
 * No new service and no external telemetry: everything is this server's own
 * memory, read on request. The report names no setting, address or account; the
 * routes are path patterns, never what a player typed.
 */

import { getMemoryManager } from '../../../services/memoryResourceManagementService.mjs';
import { getPerformanceMetrics } from '../../../services/apiResponseOptimizationService.mjs';
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';
import { redactSecrets } from '../../../utils/diagnosticReport.mjs';
import { routeTimingTotals, slowestRoutes } from '../../../utils/routeTimings.mjs';

const mb = bytes => Math.round((bytes / (1024 * 1024)) * 10) / 10;

function plainDuration(seconds) {
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}, ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** A memory warning in plain words (the manager names a threshold or a leak). */
function alertLabel(type) {
  const text = String(type ?? '').toLowerCase();
  if (text.includes('leak')) {
    return 'Memory kept growing (a possible leak)';
  }
  if (text.includes('threshold')) {
    return 'Memory use passed its warning line';
  }
  return 'Memory warning';
}

function readMemory() {
  const report = getMemoryManager().getReport();
  const current = report.memory.current;
  const usedMb = mb(current.heapUsed);
  const reservedMb = mb(current.heapTotal);
  const percent = Math.round(current.heapUtilization * 100);
  const trendSlope = report.memory.trend?.slope ?? null;
  return {
    totalMb: mb(current.rss),
    usedMb,
    reservedMb,
    percentUsed: percent,
    outsideMb: mb(current.external),
    growing:
      trendSlope === null
        ? null
        : trendSlope > 1024 * 1024 && report.memory.trend.correlation > 0.8,
    watching: report.monitoring.isActive,
    warnings: (report.memory.alerts ?? []).map(alert => ({
      at: new Date(alert.timestamp).toISOString(),
      serious: alert.severity === 'critical',
      what: alertLabel(alert.type),
    })),
    openTimers: (report.resources.counts?.timers ?? 0) + (report.resources.counts?.intervals ?? 0),
  };
}

function readSpeed() {
  const performance = getPerformanceMetrics();
  const samples = Object.values(performance.serializationTime ?? {}).filter(Number.isFinite);
  const totals = routeTimingTotals();
  return {
    since: totals.since.toISOString(),
    requests: totals.requests,
    overOneSecond: totals.overOneSecond,
    slowestRoutes: slowestRoutes(10),
    cachedAnswersPercent: Math.round((performance.cacheHitRate ?? 0) * 100),
    averagePackingMs:
      samples.length > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null,
  };
}

function buildReport({ memory, speed, uptimeSeconds, commitSha }) {
  const lines = [
    '# Equoria: server memory and speed',
    '',
    "Made by the Steward's Office for the owner to hand to Claude Code or Codex. It holds no emails, passwords, tokens, IP addresses or server settings.",
    '',
    `- Commit running: ${commitSha ?? 'not known (RAILWAY_GIT_COMMIT_SHA is not set)'}`,
    `- Report made: ${new Date().toISOString()}`,
    `- Up for: ${plainDuration(uptimeSeconds)}`,
    '',
    '## Memory',
    `- The server process is using ${memory.totalMb} MB in all.`,
    `- The game's working memory: ${memory.usedMb} MB used of ${memory.reservedMb} MB set aside (${memory.percentUsed}%).`,
    `- Memory held outside that (buffers, files): ${memory.outsideMb} MB.`,
    `- Growing steadily: ${memory.growing === null ? 'not enough readings yet' : memory.growing ? 'yes' : 'no'}.`,
    `- Timers and repeating jobs open: ${memory.openTimers}.`,
    ...(memory.warnings.length > 0
      ? memory.warnings.map(w => `- ${w.at}: ${w.what}${w.serious ? ' (serious)' : ''}`)
      : ['- No memory warnings.']),
    '',
    '## Speed',
    `- Requests answered since ${speed.since}: ${speed.requests}; ${speed.overOneSecond} took over a second.`,
    `- Answers served from the cache: ${speed.cachedAnswersPercent}%.`,
    `- Average time to package an answer: ${speed.averagePackingMs === null ? 'no readings yet' : `${speed.averagePackingMs} ms`}.`,
    '',
    '### Slowest routes (average answer time)',
    ...(speed.slowestRoutes.length > 0
      ? speed.slowestRoutes.map(
          r =>
            `- ${r.route}: ${r.averageMs} ms on average, slowest ${r.slowestMs} ms, ${r.requests} requests, ${r.overOneSecond} over a second`,
        )
      : ['- No requests timed yet.']),
    '',
  ];
  return redactSecrets(lines.join('\n'));
}

/** The panel's data and its copyable report. */
export function readServerHealth() {
  const memory = readMemory();
  const speed = readSpeed();
  const uptimeSeconds = process.uptime();
  const commitSha = deployedCommitSha();
  return {
    commitSha,
    uptime: plainDuration(uptimeSeconds),
    memory,
    speed,
    report: buildReport({ memory, speed, uptimeSeconds, commitSha }),
  };
}
