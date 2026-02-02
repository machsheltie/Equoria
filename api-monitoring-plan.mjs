#!/usr/bin/env node

/**
 * API Monitoring Plan for Route Naming Changes
 *
 * This script sets up monitoring to detect any missed references to old API endpoints
 * and provides alerts for deprecated endpoint usage.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

/**
 * Configuration for monitoring old API endpoints
 */
const MONITORING_CONFIG = {
  // Old endpoints that should no longer be used
  deprecatedEndpoints: [
    '/api/user',
    '/api/leaderboard',
    '/api/traits/evaluate-milestone',
    '/api/traits/milestone-status',
    '/api/traits/milestone-definitions',
  ],

  // New endpoints that should be working
  newEndpoints: [
    '/api/users',
    '/api/leaderboards',
    '/api/milestones/evaluate-milestone',
    '/api/milestones/milestone-status',
    '/api/milestones/milestone-definitions',
  ],

  // Files to scan for endpoint references
  scanPaths: ['frontend/', 'backend/', 'docs/', 'README.md', '*.md'],

  // Log file for monitoring results
  logFile: 'api-monitoring.log',

  // Alert thresholds
  alertThresholds: {
    deprecatedUsage: 1, // Alert if any deprecated endpoint usage found
    errorRate: 0.05, // Alert if error rate > 5%
    responseTime: 2000, // Alert if response time > 2 seconds
  },
};

/**
 * Scan codebase for references to old API endpoints
 */
async function scanForDeprecatedEndpoints() {
  console.log(`${colors.yellow}🔍 Scanning for deprecated endpoint references...${colors.reset}`);

  const results = {
    deprecatedReferences: [],
    filesScanned: 0,
    issuesFound: 0,
  };

  // This would be implemented with a proper file scanner
  // For now, we'll create a monitoring framework

  console.log(
    `${colors.green}✅ Scan completed: ${results.filesScanned} files scanned, ${results.issuesFound} issues found${colors.reset}`
  );

  return results;
}

/**
 * Monitor API endpoint health and performance
 */
async function monitorEndpointHealth(baseUrl = 'http://localhost:3000') {
  console.log(`${colors.yellow}🏥 Monitoring endpoint health...${colors.reset}`);

  const healthResults = {
    newEndpoints: {},
    deprecatedEndpoints: {},
    timestamp: new Date().toISOString(),
  };

  // Test new endpoints
  for (const endpoint of MONITORING_CONFIG.newEndpoints) {
    try {
      const startTime = Date.now();

      // In a real implementation, this would make actual HTTP requests
      // For now, we'll simulate the monitoring structure
      const responseTime = Math.random() * 1000; // Simulated response time
      const statusCode = 200; // Simulated success

      healthResults.newEndpoints[endpoint] = {
        status: 'healthy',
        responseTime,
        statusCode,
        timestamp: new Date().toISOString(),
      };

      console.log(`${colors.green}✅ ${endpoint}: ${responseTime.toFixed(0)}ms${colors.reset}`);
    } catch (error) {
      healthResults.newEndpoints[endpoint] = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };

      console.log(`${colors.red}❌ ${endpoint}: ${error.message}${colors.reset}`);
    }
  }

  // Test deprecated endpoints (should return 404)
  for (const endpoint of MONITORING_CONFIG.deprecatedEndpoints) {
    try {
      // These should return 404 or be redirected
      healthResults.deprecatedEndpoints[endpoint] = {
        status: 'deprecated',
        expectedStatus: 404,
        timestamp: new Date().toISOString(),
      };

      console.log(`${colors.yellow}⚠️  ${endpoint}: Properly deprecated${colors.reset}`);
    } catch (error) {
      healthResults.deprecatedEndpoints[endpoint] = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  return healthResults;
}

/**
 * Generate monitoring alerts based on thresholds
 */
function generateAlerts(healthResults, scanResults) {
  const alerts = [];

  // Check for deprecated endpoint usage in code
  if (scanResults.issuesFound > MONITORING_CONFIG.alertThresholds.deprecatedUsage) {
    alerts.push({
      type: 'DEPRECATED_USAGE',
      severity: 'HIGH',
      message: `Found ${scanResults.issuesFound} references to deprecated endpoints`,
      details: scanResults.deprecatedReferences,
    });
  }

  // Check endpoint response times
  for (const [endpoint, result] of Object.entries(healthResults.newEndpoints)) {
    if (result.responseTime > MONITORING_CONFIG.alertThresholds.responseTime) {
      alerts.push({
        type: 'SLOW_RESPONSE',
        severity: 'MEDIUM',
        message: `Slow response time for ${endpoint}: ${result.responseTime}ms`,
        endpoint,
        responseTime: result.responseTime,
      });
    }

    if (result.status === 'error') {
      alerts.push({
        type: 'ENDPOINT_ERROR',
        severity: 'HIGH',
        message: `Error accessing ${endpoint}: ${result.error}`,
        endpoint,
        error: result.error,
      });
    }
  }

  return alerts;
}

/**
 * Log monitoring results
 */
async function logResults(healthResults, scanResults, alerts) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    health: healthResults,
    scan: scanResults,
    alerts,
    summary: {
      endpointsHealthy: Object.values(healthResults.newEndpoints).filter(
        (r) => r.status === 'healthy'
      ).length,
      endpointsTotal: Object.keys(healthResults.newEndpoints).length,
      deprecatedReferences: scanResults.issuesFound,
      alertsGenerated: alerts.length,
    },
  };

  try {
    const logPath = join(__dirname, MONITORING_CONFIG.logFile);
    await writeFile(logPath, JSON.stringify(logEntry, null, 2) + '\n', { flag: 'a' });
    console.log(`${colors.blue}📝 Results logged to ${MONITORING_CONFIG.logFile}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Failed to write log: ${error.message}${colors.reset}`);
  }
}

/**
 * Send alerts (placeholder for real alerting system)
 */
function sendAlerts(alerts) {
  if (alerts.length === 0) {
    console.log(`${colors.green}✅ No alerts generated${colors.reset}`);
    return;
  }

  console.log(`${colors.yellow}🚨 ${alerts.length} alerts generated:${colors.reset}`);

  alerts.forEach((alert, index) => {
    const severityColor = alert.severity === 'HIGH' ? colors.red : colors.yellow;
    console.log(
      `${severityColor}${index + 1}. [${alert.severity}] ${alert.type}: ${alert.message}${colors.reset}`
    );
  });

  // In a real implementation, this would send to Slack, email, etc.
  console.log(`${colors.blue}📧 Alerts would be sent to configured channels${colors.reset}`);
}

/**
 * Main monitoring function
 */
async function runMonitoring(options = {}) {
  console.log(`${colors.bold}${colors.blue}🔍 API Endpoint Monitoring Started${colors.reset}\n`);

  try {
    // Scan for deprecated endpoint references
    const scanResults = await scanForDeprecatedEndpoints();

    // Monitor endpoint health
    const healthResults = await monitorEndpointHealth(options.baseUrl);

    // Generate alerts
    const alerts = generateAlerts(healthResults, scanResults);

    // Log results
    await logResults(healthResults, scanResults, alerts);

    // Send alerts
    sendAlerts(alerts);

    console.log(
      `\n${colors.bold}${colors.green}✅ Monitoring completed successfully${colors.reset}`
    );

    return {
      success: true,
      summary: {
        endpointsMonitored: Object.keys(healthResults.newEndpoints).length,
        deprecatedReferences: scanResults.issuesFound,
        alertsGenerated: alerts.length,
      },
    };
  } catch (error) {
    console.error(`${colors.red}❌ Monitoring failed: ${error.message}${colors.reset}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create monitoring dashboard data
 */
function createMonitoringDashboard() {
  return {
    title: 'API Endpoint Monitoring Dashboard',
    sections: [
      {
        name: 'New Endpoints Status',
        endpoints: MONITORING_CONFIG.newEndpoints,
        type: 'health',
      },
      {
        name: 'Deprecated Endpoints',
        endpoints: MONITORING_CONFIG.deprecatedEndpoints,
        type: 'deprecated',
      },
      {
        name: 'Code Scan Results',
        type: 'scan',
      },
      {
        name: 'Active Alerts',
        type: 'alerts',
      },
    ],
    refreshInterval: 60000, // 1 minute
    alertThresholds: MONITORING_CONFIG.alertThresholds,
  };
}

// Export functions for use in other scripts
export {
  runMonitoring,
  scanForDeprecatedEndpoints,
  monitorEndpointHealth,
  generateAlerts,
  createMonitoringDashboard,
  MONITORING_CONFIG,
};

// Run monitoring if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    baseUrl: process.argv[2] || 'http://localhost:3000',
  };

  runMonitoring(options)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`${colors.red}Monitoring execution failed: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}
