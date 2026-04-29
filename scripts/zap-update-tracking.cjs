'use strict';
// Extracted "Update ZAP tracking issue" logic with IGNORE/WARN filtering.
//
// The inline workflow script reads raw riskcode values without checking
// .github/zap-rules.tsv, so suppressed alerts still appear in the tracking
// comment. This module filters them out first.
//
// To activate: in .github/workflows/security-scan.yml, replace the entire
// `script: |` block inside the "Update ZAP tracking issue" step with:
//
//   script: |
//     const script = require('./scripts/zap-update-tracking.cjs');
//     await script({ github, context, core });
//
// NOTE: .cjs extension is required because the root package.json has
// "type":"module" — a plain .js file would throw ERR_REQUIRE_ESM.

const fs = require('fs');

module.exports = async function updateZapTracking({ github, context, core }) {
  const reportPath = 'report_json.json';
  if (!fs.existsSync(reportPath)) {
    core.info('No ZAP report produced; skipping tracking issue update.');
    return;
  }

  // Build a set of plugin IDs that are IGNORE or WARN in zap-rules.tsv.
  // These are already triaged; suppress them from the tracking comment so
  // only genuinely new, unreviewed findings appear.
  const suppressedIds = new Set();
  try {
    const rulesTsv = fs.readFileSync('.github/zap-rules.tsv', 'utf8');
    for (const line of rulesTsv.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      const id = parts[0] && parts[0].trim();
      const threshold = parts[1] && parts[1].trim();
      if (id && (threshold === 'IGNORE' || threshold === 'WARN')) {
        suppressedIds.add(id);
      }
    }
    core.info(`ZAP rules loaded: suppressing ${suppressedIds.size} plugin IDs (IGNORE/WARN)`);
  } catch (err) {
    core.warning(`Could not read zap-rules.tsv: ${err.message}. Proceeding without filtering.`);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const allAlerts = (report.site && report.site[0] && report.site[0].alerts) || [];

  const alerts = allAlerts.filter((a) => !suppressedIds.has(String(a.pluginid)));
  const suppressedCount = allAlerts.length - alerts.length;

  const byRisk = (code) => alerts.filter((a) => a.riskcode === code);
  const high = byRisk('3');
  const medium = byRisk('2');
  const low = byRisk('1');
  const informational = byRisk('0');

  const trackingTitle = 'ZAP Security Tracking';
  const trackingLabel = 'zap-tracking';

  const { data: existing } = await github.rest.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    labels: trackingLabel,
    per_page: 10,
  });

  let issue = existing.find((i) => i.title === trackingTitle);

  if (!issue) {
    const created = await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: trackingTitle,
      labels: ['security', 'zap-scan', trackingLabel],
      body: [
        '## ZAP Security Tracking',
        '',
        'Single tracking issue for automated OWASP ZAP scan results.',
        'Each CI run posts a comment below with the latest findings.',
        'Alerts already marked IGNORE/WARN in `.github/zap-rules.tsv`',
        'are filtered before they reach this issue.',
        '',
        'Close this issue only if ZAP reporting itself is being',
        'redesigned — otherwise keep it open as the canonical thread.',
      ].join('\n'),
    });
    issue = created.data;
  }

  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const shortSha = context.sha.substring(0, 7);

  const formatGroup = (label, list) => {
    if (list.length === 0) return `- **${label}**: 0`;
    const names = [...new Set(list.map((a) => `${a.name} [${a.pluginid}]`))];
    return `- **${label}**: ${list.length} (${names.slice(0, 5).join('; ')}${names.length > 5 ? ', …' : ''})`;
  };

  const lines = [
    `### Run ${shortSha} — ${new Date().toISOString()}`,
    '',
    formatGroup('High', high),
    formatGroup('Medium', medium),
    formatGroup('Low', low),
    formatGroup('Informational', informational),
  ];

  if (suppressedCount > 0) {
    lines.push('', `> ${suppressedCount} alert(s) suppressed by \`.github/zap-rules.tsv\` (IGNORE/WARN).`);
  }

  lines.push('', `[View full report](${runUrl})`);

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issue.number,
    body: lines.join('\n'),
  });

  // Escalate high-severity findings with a dedicated issue on push events.
  if (high.length > 0 && context.eventName === 'push') {
    let body = '## 🚨 High Severity Security Vulnerabilities Detected\n\n';
    body += `OWASP ZAP scan found **${high.length} high severity issues**:\n\n`;
    high.forEach((alert, i) => {
      body += `### ${i + 1}. ${alert.name}\n`;
      body += `- **Risk**: ${alert.riskdesc}\n`;
      body += `- **Confidence**: ${alert.confidence}\n`;
      body += `- **Description**: ${alert.desc}\n`;
      body += `- **Solution**: ${alert.solution}\n`;
      body += `- **Reference**: ${alert.reference}\n\n`;
    });
    body += `\n---\nScan triggered by: ${shortSha}\nBranch: ${context.ref}\nTracking: #${issue.number}\n`;

    await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: `🚨 Security: ${high.length} High Severity Vulnerabilities (${shortSha})`,
      body,
      labels: ['security', 'high-priority', 'zap-scan'],
    });
  }
};
