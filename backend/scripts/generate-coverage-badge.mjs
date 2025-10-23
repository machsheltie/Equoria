/**
 * Coverage Badge Generator for CI/CD Pipeline
 *
 * This script generates coverage badges for README and documentation including:
 * - SVG badge generation
 * - Shields.io compatible format
 * - Coverage percentage display
 * - Color coding based on coverage levels
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Badge configuration
const BADGE_CONFIG = {
  colors: {
    excellent: '#4c1',      // 90%+ coverage
    good: '#97ca00',        // 80-89% coverage
    fair: '#dfb317',        // 70-79% coverage
    poor: '#fe7d37',        // 60-69% coverage
    critical: '#e05d44',     // <60% coverage
  },
  thresholds: {
    excellent: 90,
    good: 80,
    fair: 70,
    poor: 60,
  },
  width: {
    label: 63,
    message: 47,
    total: 110,
  },
};

/**
 * Read coverage summary data
 */
async function readCoverageSummary() {
  try {
    const summaryPath = path.resolve(__dirname, '../coverage/coverage-summary.json');
    const summaryData = await fs.readFile(summaryPath, 'utf8');
    return JSON.parse(summaryData);
  } catch (error) {
    console.warn('⚠️ Coverage summary not found, using default values');
    return {
      total: {
        lines: { pct: 0 },
        statements: { pct: 0 },
        functions: { pct: 0 },
        branches: { pct: 0 },
      },
    };
  }
}

/**
 * Calculate overall coverage percentage
 */
function calculateOverallCoverage(coverageData) {
  const { total } = coverageData;

  if (!total) {
    return 0;
  }

  const metrics = [
    total.lines.pct,
    total.statements.pct,
    total.functions.pct,
    total.branches.pct,
  ];

  const validMetrics = metrics.filter(metric => typeof metric === 'number' && !isNaN(metric));

  if (validMetrics.length === 0) {
    return 0;
  }

  return validMetrics.reduce((sum, metric) => sum + metric, 0) / validMetrics.length;
}

/**
 * Get color based on coverage percentage
 */
function getCoverageColor(percentage) {
  if (percentage >= BADGE_CONFIG.thresholds.excellent) {
    return BADGE_CONFIG.colors.excellent;
  } else if (percentage >= BADGE_CONFIG.thresholds.good) {
    return BADGE_CONFIG.colors.good;
  } else if (percentage >= BADGE_CONFIG.thresholds.fair) {
    return BADGE_CONFIG.colors.fair;
  } else if (percentage >= BADGE_CONFIG.thresholds.poor) {
    return BADGE_CONFIG.colors.poor;
  } else {
    return BADGE_CONFIG.colors.critical;
  }
}

/**
 * Generate SVG badge
 */
function generateSvgBadge(label, message, color) {
  const labelWidth = BADGE_CONFIG.width.label;
  const messageWidth = BADGE_CONFIG.width.message;
  const totalWidth = BADGE_CONFIG.width.total;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelWidth / 2 * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(label.length * 6 + 10) * 10}">${label}</text>
    <text x="${labelWidth / 2 * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${(label.length * 6 + 10) * 10}">${label}</text>
    <text aria-hidden="true" x="${(labelWidth + messageWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(message.length * 6 + 10) * 10}">${message}</text>
    <text x="${(labelWidth + messageWidth / 2) * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${(message.length * 6 + 10) * 10}">${message}</text>
  </g>
</svg>`;
}

/**
 * Generate Shields.io URL
 */
function generateShieldsUrl(label, message, color) {
  const encodedLabel = encodeURIComponent(label);
  const encodedMessage = encodeURIComponent(message);
  const encodedColor = encodeURIComponent(color.replace('#', ''));

  return `https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${encodedColor}`;
}

/**
 * Generate coverage badge data
 */
function generateBadgeData(coveragePercentage) {
  const percentage = Math.round(coveragePercentage * 10) / 10; // Round to 1 decimal
  const message = `${percentage}%`;
  const color = getCoverageColor(percentage);

  return {
    label: 'coverage',
    message,
    color,
    percentage,
    svg: generateSvgBadge('coverage', message, color),
    shieldsUrl: generateShieldsUrl('coverage', message, color),
    grade: getCoverageGrade(percentage),
  };
}

/**
 * Get coverage grade
 */
function getCoverageGrade(percentage) {
  if (percentage >= 95) { return 'A+'; }
  if (percentage >= 90) { return 'A'; }
  if (percentage >= 85) { return 'B+'; }
  if (percentage >= 80) { return 'B'; }
  if (percentage >= 75) { return 'C+'; }
  if (percentage >= 70) { return 'C'; }
  if (percentage >= 65) { return 'D+'; }
  if (percentage >= 60) { return 'D'; }
  return 'F';
}

/**
 * Generate detailed coverage badges for all metrics
 */
function generateDetailedBadges(coverageData) {
  const { total } = coverageData;
  const badges = {};

  if (!total) {
    return badges;
  }

  const metrics = {
    lines: total.lines.pct,
    statements: total.statements.pct,
    functions: total.functions.pct,
    branches: total.branches.pct,
  };

  Object.entries(metrics).forEach(([metric, percentage]) => {
    if (typeof percentage === 'number' && !isNaN(percentage)) {
      badges[metric] = generateBadgeData(percentage);
      badges[metric].label = metric;
      badges[metric].svg = generateSvgBadge(metric, badges[metric].message, badges[metric].color);
      badges[metric].shieldsUrl = generateShieldsUrl(metric, badges[metric].message, badges[metric].color);
    }
  });

  return badges;
}

/**
 * Save badge files
 */
async function saveBadgeFiles(badgeData, detailedBadges) {
  const badgesDir = path.resolve(__dirname, '../coverage/badges');
  await fs.mkdir(badgesDir, { recursive: true });

  const savedFiles = [];

  // Save main coverage badge
  const mainBadgePath = path.join(badgesDir, 'coverage.svg');
  await fs.writeFile(mainBadgePath, badgeData.svg);
  savedFiles.push(mainBadgePath);

  // Save detailed metric badges
  for (const [metric, badge] of Object.entries(detailedBadges)) {
    const badgePath = path.join(badgesDir, `coverage-${metric}.svg`);
    await fs.writeFile(badgePath, badge.svg);
    savedFiles.push(badgePath);
  }

  // Save badge data as JSON
  const badgeDataPath = path.join(badgesDir, 'badge-data.json');
  await fs.writeFile(badgeDataPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    overall: badgeData,
    detailed: detailedBadges,
    urls: {
      overall: badgeData.shieldsUrl,
      detailed: Object.fromEntries(
        Object.entries(detailedBadges).map(([metric, badge]) => [metric, badge.shieldsUrl]),
      ),
    },
  }, null, 2));
  savedFiles.push(badgeDataPath);

  // Save README snippet
  const readmeSnippet = generateReadmeSnippet(badgeData, detailedBadges);
  const readmeSnippetPath = path.join(badgesDir, 'README-badges.md');
  await fs.writeFile(readmeSnippetPath, readmeSnippet);
  savedFiles.push(readmeSnippetPath);

  return savedFiles;
}

/**
 * Generate README snippet with badges
 */
function generateReadmeSnippet(badgeData, detailedBadges) {
  let snippet = '<!-- Coverage Badges -->\n';
  snippet += `![Coverage](${badgeData.shieldsUrl})\n`;

  if (Object.keys(detailedBadges).length > 0) {
    snippet += '\n<!-- Detailed Coverage Badges -->\n';
    Object.entries(detailedBadges).forEach(([metric, badge]) => {
      const capitalizedMetric = metric.charAt(0).toUpperCase() + metric.slice(1);
      snippet += `![${capitalizedMetric} Coverage](${badge.shieldsUrl})\n`;
    });
  }

  snippet += '\n<!-- End Coverage Badges -->\n';
  return snippet;
}

/**
 * Main badge generation function
 */
async function generateCoverageBadge() {
  try {
    console.log('🏷️ Generating coverage badges...');

    // Read coverage data
    const coverageData = await readCoverageSummary();

    // Calculate overall coverage
    const overallCoverage = calculateOverallCoverage(coverageData);

    // Generate main badge
    const badgeData = generateBadgeData(overallCoverage);

    // Generate detailed badges
    const detailedBadges = generateDetailedBadges(coverageData);

    // Save badge files
    const savedFiles = await saveBadgeFiles(badgeData, detailedBadges);

    // Display results
    console.log('\n🏷️ Coverage Badge Generation Results');
    console.log('====================================');
    console.log(`Overall Coverage: ${badgeData.percentage}% (Grade: ${badgeData.grade})`);
    console.log(`Badge Color: ${badgeData.color}`);
    console.log(`Shields.io URL: ${badgeData.shieldsUrl}`);

    if (Object.keys(detailedBadges).length > 0) {
      console.log('\nDetailed Metrics:');
      Object.entries(detailedBadges).forEach(([metric, badge]) => {
        console.log(`  ${metric}: ${badge.percentage}% (${badge.grade})`);
      });
    }

    console.log(`\n📁 Badge files saved (${savedFiles.length} files):`);
    savedFiles.forEach(file => {
      console.log(`   ${path.relative(process.cwd(), file)}`);
    });

    console.log('\n✅ Coverage badge generation completed successfully');

  } catch (error) {
    console.error('❌ Coverage badge generation failed:', error.message);
    process.exit(1);
  }
}

// Run badge generation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCoverageBadge();
}

export {
  generateCoverageBadge,
  generateBadgeData,
  generateDetailedBadges,
  generateSvgBadge,
  generateShieldsUrl,
};
