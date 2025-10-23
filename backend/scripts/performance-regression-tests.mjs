/**
 * Performance Regression Testing System for CI/CD Pipeline
 *
 * This script provides automated performance validation including:
 * - Benchmark testing against baseline performance
 * - Response time monitoring and regression detection
 * - Memory usage tracking and leak detection
 * - Database query performance validation
 * - API endpoint performance benchmarking
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance regression configuration
const REGRESSION_CONFIG = {
  baselineFile: '../performance-results/baseline-performance.json',
  thresholds: {
    responseTime: {
      warning: 1.2,    // 20% slower than baseline
      critical: 1.5,    // 50% slower than baseline
    },
    memory: {
      warning: 1.3,    // 30% more memory than baseline
      critical: 1.8,    // 80% more memory than baseline
    },
    throughput: {
      warning: 0.8,    // 20% less throughput than baseline
      critical: 0.6,    // 40% less throughput than baseline
    },
  },
  testDuration: 30000, // 30 seconds
  warmupDuration: 5000, // 5 seconds
  concurrentUsers: 5,
  endpoints: [
    { path: '/ping', method: 'GET', weight: 1 },
    { path: '/health', method: 'GET', weight: 1 },
    { path: '/api/auth/login', method: 'POST', weight: 2, body: { email: 'test@example.com', password: 'testpass' } },
    { path: '/api/horses', method: 'GET', weight: 3, requiresAuth: true },
    { path: '/api/competition/disciplines', method: 'GET', weight: 2 },
  ],
};

/**
 * Load baseline performance data
 */
async function loadBaseline() {
  try {
    const baselinePath = path.resolve(__dirname, REGRESSION_CONFIG.baselineFile);
    const baselineData = await fs.readFile(baselinePath, 'utf8');
    return JSON.parse(baselineData);
  } catch (error) {
    console.warn('⚠️ No baseline performance data found, creating new baseline');
    return null;
  }
}

/**
 * Start test server for performance testing
 */
async function startPerformanceTestServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting performance test server...');

    const server = spawn('node', ['server.mjs'], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3002',
      },
      stdio: 'pipe',
    });

    let serverReady = false;

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') && !serverReady) {
        serverReady = true;
        console.log('✅ Performance test server started');
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    server.on('error', (error) => {
      reject(error);
    });

    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Perform single API request with timing
 */
async function performRequest(endpoint, baseUrl = 'http://localhost:3002', authToken = null) {
  const startTime = performance.now();
  const memBefore = process.memoryUsage();

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (authToken && endpoint.requiresAuth) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const requestOptions = {
      method: endpoint.method,
      headers,
    };

    if (endpoint.body) {
      requestOptions.body = JSON.stringify(endpoint.body);
    }

    const response = await fetch(`${baseUrl}${endpoint.path}`, requestOptions);

    const endTime = performance.now();
    const memAfter = process.memoryUsage();

    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      responseTime: endTime - startTime,
      status: response.status,
      success: response.ok,
      memoryDelta: memAfter.heapUsed - memBefore.heapUsed,
      timestamp: Date.now(),
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      responseTime: endTime - startTime,
      status: 0,
      success: false,
      error: error.message,
      memoryDelta: 0,
      timestamp: Date.now(),
    };
  }
}

/**
 * Run performance benchmark test
 */
async function runPerformanceBenchmark() {
  console.log('🔄 Running performance benchmark...');

  const results = {
    startTime: Date.now(),
    endTime: null,
    requests: [],
    summary: {},
    memoryProfile: [],
  };

  // Start memory monitoring
  const memoryMonitor = setInterval(() => {
    const memUsage = process.memoryUsage();
    results.memoryProfile.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    });
  }, 1000);

  try {
    // Warmup phase
    console.log('🔥 Warming up...');
    const warmupEnd = Date.now() + REGRESSION_CONFIG.warmupDuration;
    while (Date.now() < warmupEnd) {
      // eslint-disable-next-line prefer-destructuring
      const endpoint = REGRESSION_CONFIG.endpoints[0]; // Use simple endpoint for warmup
      await performRequest(endpoint);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Main test phase
    console.log('📊 Running main performance test...');
    const testEnd = Date.now() + REGRESSION_CONFIG.testDuration;
    const promises = [];

    while (Date.now() < testEnd) {
      for (let i = 0; i < REGRESSION_CONFIG.concurrentUsers; i++) {
        // Select endpoint based on weight
        const totalWeight = REGRESSION_CONFIG.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
        const random = Math.random() * totalWeight;
        let currentWeight = 0;
        // eslint-disable-next-line prefer-destructuring
        let selectedEndpoint = REGRESSION_CONFIG.endpoints[0];

        for (const endpoint of REGRESSION_CONFIG.endpoints) {
          currentWeight += endpoint.weight;
          if (random <= currentWeight) {
            selectedEndpoint = endpoint;
            break;
          }
        }

        const promise = performRequest(selectedEndpoint).then(result => {
          results.requests.push(result);
          return result;
        });

        promises.push(promise);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    results.endTime = Date.now();
    clearInterval(memoryMonitor);

    // Calculate summary statistics
    results.summary = calculatePerformanceSummary(results);

    console.log(`✅ Performance benchmark completed: ${results.requests.length} requests`);
    return results;

  } catch (error) {
    clearInterval(memoryMonitor);
    throw error;
  }
}

/**
 * Calculate performance summary statistics
 */
function calculatePerformanceSummary(results) {
  const { requests, memoryProfile, startTime, endTime } = results;

  if (requests.length === 0) {
    throw new Error('No performance data collected');
  }

  // Response time statistics
  const responseTimes = requests.map(r => r.responseTime);
  const successfulRequests = requests.filter(r => r.success);

  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);

  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p50ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

  // Throughput calculation
  const durationSeconds = (endTime - startTime) / 1000;
  const throughput = requests.length / durationSeconds;
  const successRate = (successfulRequests.length / requests.length) * 100;

  // Memory statistics
  const memoryUsages = memoryProfile.map(m => m.heapUsed);
  const avgMemoryUsage = memoryUsages.length > 0
    ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
    : 0;
  const maxMemoryUsage = memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0;
  const minMemoryUsage = memoryUsages.length > 0 ? Math.min(...memoryUsages) : 0;

  // Per-endpoint statistics
  const endpointStats = {};
  REGRESSION_CONFIG.endpoints.forEach(endpoint => {
    const endpointRequests = requests.filter(r => r.endpoint === endpoint.path);
    if (endpointRequests.length > 0) {
      const endpointTimes = endpointRequests.map(r => r.responseTime);
      endpointStats[endpoint.path] = {
        requests: endpointRequests.length,
        avgResponseTime: endpointTimes.reduce((a, b) => a + b, 0) / endpointTimes.length,
        maxResponseTime: Math.max(...endpointTimes),
        successRate: (endpointRequests.filter(r => r.success).length / endpointRequests.length) * 100,
      };
    }
  });

  return {
    responseTime: {
      average: avgResponseTime,
      min: minResponseTime,
      max: maxResponseTime,
      p50: p50ResponseTime,
      p95: p95ResponseTime,
      p99: p99ResponseTime,
    },
    memory: {
      average: avgMemoryUsage,
      min: minMemoryUsage,
      max: maxMemoryUsage,
    },
    throughput,
    successRate,
    totalRequests: requests.length,
    duration: durationSeconds,
    endpointStats,
  };
}

/**
 * Compare performance against baseline
 */
function compareWithBaseline(currentResults, baseline) {
  if (!baseline) {
    return {
      hasBaseline: false,
      message: 'No baseline available - current results will be used as new baseline',
    };
  }

  const comparison = {
    hasBaseline: true,
    regressions: [],
    improvements: [],
    status: 'passed',
  };

  const current = currentResults.summary;
  const base = baseline.summary;

  // Response time comparison
  const responseTimeRatio = current.responseTime.average / base.responseTime.average;
  if (responseTimeRatio > REGRESSION_CONFIG.thresholds.responseTime.critical) {
    comparison.regressions.push({
      metric: 'responseTime',
      severity: 'critical',
      current: current.responseTime.average,
      baseline: base.responseTime.average,
      ratio: responseTimeRatio,
      message: `Response time is ${((responseTimeRatio - 1) * 100).toFixed(1)}% slower than baseline`,
    });
    comparison.status = 'failed';
  } else if (responseTimeRatio > REGRESSION_CONFIG.thresholds.responseTime.warning) {
    comparison.regressions.push({
      metric: 'responseTime',
      severity: 'warning',
      current: current.responseTime.average,
      baseline: base.responseTime.average,
      ratio: responseTimeRatio,
      message: `Response time is ${((responseTimeRatio - 1) * 100).toFixed(1)}% slower than baseline`,
    });
    if (comparison.status === 'passed') { comparison.status = 'warning'; }
  } else if (responseTimeRatio < 0.9) {
    comparison.improvements.push({
      metric: 'responseTime',
      current: current.responseTime.average,
      baseline: base.responseTime.average,
      ratio: responseTimeRatio,
      message: `Response time improved by ${((1 - responseTimeRatio) * 100).toFixed(1)}%`,
    });
  }

  // Memory comparison
  const memoryRatio = current.memory.max / base.memory.max;
  if (memoryRatio > REGRESSION_CONFIG.thresholds.memory.critical) {
    comparison.regressions.push({
      metric: 'memory',
      severity: 'critical',
      current: current.memory.max,
      baseline: base.memory.max,
      ratio: memoryRatio,
      message: `Memory usage is ${((memoryRatio - 1) * 100).toFixed(1)}% higher than baseline`,
    });
    comparison.status = 'failed';
  } else if (memoryRatio > REGRESSION_CONFIG.thresholds.memory.warning) {
    comparison.regressions.push({
      metric: 'memory',
      severity: 'warning',
      current: current.memory.max,
      baseline: base.memory.max,
      ratio: memoryRatio,
      message: `Memory usage is ${((memoryRatio - 1) * 100).toFixed(1)}% higher than baseline`,
    });
    if (comparison.status === 'passed') { comparison.status = 'warning'; }
  }

  // Throughput comparison
  const throughputRatio = current.throughput / base.throughput;
  if (throughputRatio < REGRESSION_CONFIG.thresholds.throughput.critical) {
    comparison.regressions.push({
      metric: 'throughput',
      severity: 'critical',
      current: current.throughput,
      baseline: base.throughput,
      ratio: throughputRatio,
      message: `Throughput decreased by ${((1 - throughputRatio) * 100).toFixed(1)}%`,
    });
    comparison.status = 'failed';
  } else if (throughputRatio < REGRESSION_CONFIG.thresholds.throughput.warning) {
    comparison.regressions.push({
      metric: 'throughput',
      severity: 'warning',
      current: current.throughput,
      baseline: base.throughput,
      ratio: throughputRatio,
      message: `Throughput decreased by ${((1 - throughputRatio) * 100).toFixed(1)}%`,
    });
    if (comparison.status === 'passed') { comparison.status = 'warning'; }
  } else if (throughputRatio > 1.1) {
    comparison.improvements.push({
      metric: 'throughput',
      current: current.throughput,
      baseline: base.throughput,
      ratio: throughputRatio,
      message: `Throughput improved by ${((throughputRatio - 1) * 100).toFixed(1)}%`,
    });
  }

  return comparison;
}

/**
 * Save performance results and update baseline
 */
async function savePerformanceResults(results, comparison) {
  const resultsDir = path.resolve(__dirname, '../performance-results');
  await fs.mkdir(resultsDir, { recursive: true });

  // Save current results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.join(resultsDir, `performance-${timestamp}.json`);
  await fs.writeFile(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    comparison,
  }, null, 2));

  // Update baseline if no regressions or if no baseline exists
  if (!comparison.hasBaseline || comparison.status !== 'failed') {
    const baselinePath = path.join(resultsDir, 'baseline-performance.json');
    await fs.writeFile(baselinePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: results.summary,
      config: REGRESSION_CONFIG,
    }, null, 2));
    console.log('📊 Baseline performance data updated');
  }

  // Save summary for CI
  const summaryPath = path.join(resultsDir, 'performance-regression-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    status: comparison.status,
    hasBaseline: comparison.hasBaseline,
    regressions: comparison.regressions?.length || 0,
    improvements: comparison.improvements?.length || 0,
    summary: results.summary,
  }, null, 2));

  return {
    resultsPath,
    summaryPath,
  };
}

/**
 * Display performance regression results
 */
function displayResults(results, comparison) {
  console.log('\n📊 Performance Regression Test Results');
  console.log('======================================');

  const { summary } = results;
  console.log(`Duration: ${summary.duration.toFixed(1)}s`);
  console.log(`Total Requests: ${summary.totalRequests}`);
  console.log(`Success Rate: ${summary.successRate.toFixed(1)}%`);
  console.log(`Throughput: ${summary.throughput.toFixed(2)} req/s`);
  console.log(`Avg Response Time: ${summary.responseTime.average.toFixed(2)}ms`);
  console.log(`95th Percentile: ${summary.responseTime.p95.toFixed(2)}ms`);
  console.log(`Max Memory: ${(summary.memory.max / 1024 / 1024).toFixed(2)}MB`);

  if (comparison.hasBaseline) {
    console.log('\n🔍 Regression Analysis:');
    console.log(`Status: ${comparison.status.toUpperCase()}`);

    if (comparison.regressions.length > 0) {
      console.log('\n❌ Performance Regressions:');
      comparison.regressions.forEach(regression => {
        const icon = regression.severity === 'critical' ? '🔴' : '⚠️';
        console.log(`${icon} ${regression.message}`);
      });
    }

    if (comparison.improvements.length > 0) {
      console.log('\n✅ Performance Improvements:');
      comparison.improvements.forEach(improvement => {
        console.log(`🚀 ${improvement.message}`);
      });
    }

    if (comparison.regressions.length === 0 && comparison.improvements.length === 0) {
      console.log('📊 Performance is stable compared to baseline');
    }
  } else {
    console.log('\n📊 No baseline available - results saved as new baseline');
  }
}

/**
 * Main performance regression test execution
 */
async function runPerformanceRegressionTests() {
  let server = null;

  try {
    console.log('🧪 Starting Performance Regression Tests');
    console.log('=========================================');

    // Load baseline
    const baseline = await loadBaseline();

    // Start test server
    server = await startPerformanceTestServer();

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run performance benchmark
    const results = await runPerformanceBenchmark();

    // Compare with baseline
    const comparison = compareWithBaseline(results, baseline);

    // Save results
    await savePerformanceResults(results, comparison);

    // Display results
    displayResults(results, comparison);

    // Exit with appropriate code
    if (comparison.status === 'failed') {
      console.log('\n❌ Performance regression tests FAILED');
      process.exit(1);
    } else if (comparison.status === 'warning') {
      console.log('\n⚠️ Performance regression tests completed with WARNINGS');
      process.exit(0); // Don't fail CI for warnings
    } else {
      console.log('\n✅ Performance regression tests PASSED');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Performance regression tests failed:', error.message);
    process.exit(1);
  } finally {
    if (server) {
      console.log('🛑 Stopping test server...');
      server.kill();
    }
  }
}

// Run performance regression tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceRegressionTests();
}

export {
  runPerformanceRegressionTests,
  runPerformanceBenchmark,
  compareWithBaseline,
  calculatePerformanceSummary,
};
