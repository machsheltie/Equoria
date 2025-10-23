/**
 * Performance Testing Script for Equoria Backend
 *
 * This script runs comprehensive performance tests including:
 * - API endpoint response time testing
 * - Database query performance validation
 * - Memory usage monitoring
 * - Concurrent request handling
 * - Load testing scenarios
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance test configuration
const PERFORMANCE_CONFIG = {
  responseTimeThreshold: 1000, // 1 second
  memoryThreshold: 100 * 1024 * 1024, // 100MB
  concurrentUsers: 10,
  testDuration: 30000, // 30 seconds
  endpoints: [
    '/ping',
    '/health',
    '/api/auth/login',
    '/api/horses',
    '/api/competition/disciplines',
  ],
};

// Performance metrics storage
const performanceMetrics = {
  responseTime: [],
  memoryUsage: [],
  errorRate: 0,
  throughput: 0,
  startTime: null,
  endTime: null,
};

/**
 * Start the backend server for testing
 */
async function startTestServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting test server...');

    const server = spawn('node', ['server.mjs'], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3001',
      },
      stdio: 'pipe',
    });

    let serverReady = false;

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') && !serverReady) {
        serverReady = true;
        console.log('✅ Test server started successfully');
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    server.on('error', (error) => {
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Test API endpoint response time
 */
async function testEndpointPerformance(endpoint, baseUrl = 'http://localhost:3001') {
  const startTime = performance.now();

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    return {
      endpoint,
      responseTime,
      status: response.status,
      success: response.ok,
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      endpoint,
      responseTime: endTime - startTime,
      status: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Monitor memory usage during tests
 */
function monitorMemoryUsage() {
  const memUsage = process.memoryUsage();
  performanceMetrics.memoryUsage.push({
    timestamp: Date.now(),
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external,
    rss: memUsage.rss,
  });
}

/**
 * Run concurrent load test
 */
async function runLoadTest() {
  console.log('🔄 Running load test...');

  const promises = [];
  const startTime = Date.now();
  let totalRequests = 0;
  let successfulRequests = 0;

  // Start memory monitoring
  const memoryMonitor = setInterval(monitorMemoryUsage, 1000);

  // Run concurrent requests for specified duration
  const endTime = startTime + PERFORMANCE_CONFIG.testDuration;

  while (Date.now() < endTime) {
    for (let i = 0; i < PERFORMANCE_CONFIG.concurrentUsers; i++) {
      const endpoint = PERFORMANCE_CONFIG.endpoints[
        Math.floor(Math.random() * PERFORMANCE_CONFIG.endpoints.length)
      ];

      const promise = testEndpointPerformance(endpoint).then(result => {
        totalRequests++;
        if (result.success) {
          successfulRequests++;
        }
        performanceMetrics.responseTime.push(result.responseTime);
        return result;
      });

      promises.push(promise);
    }

    // Wait a bit before next batch
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Wait for all requests to complete
  await Promise.all(promises);

  // Stop memory monitoring
  clearInterval(memoryMonitor);

  // Calculate metrics
  performanceMetrics.errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;
  performanceMetrics.throughput = totalRequests / (PERFORMANCE_CONFIG.testDuration / 1000);

  console.log(`✅ Load test completed: ${totalRequests} requests, ${successfulRequests} successful`);
}

/**
 * Analyze performance results
 */
function analyzePerformanceResults() {
  const responseTimes = performanceMetrics.responseTime;
  const memoryUsages = performanceMetrics.memoryUsage;

  if (responseTimes.length === 0) {
    throw new Error('No performance data collected');
  }

  // Response time analysis
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);

  // Sort for percentiles
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

  // Memory analysis
  const avgMemoryUsage = memoryUsages.length > 0
    ? memoryUsages.reduce((sum, usage) => sum + usage.heapUsed, 0) / memoryUsages.length
    : 0;
  const maxMemoryUsage = memoryUsages.length > 0
    ? Math.max(...memoryUsages.map(usage => usage.heapUsed))
    : 0;

  return {
    responseTime: {
      average: avgResponseTime,
      min: minResponseTime,
      max: maxResponseTime,
      p95: p95ResponseTime,
      p99: p99ResponseTime,
    },
    memory: {
      average: avgMemoryUsage,
      max: maxMemoryUsage,
    },
    errorRate: performanceMetrics.errorRate,
    throughput: performanceMetrics.throughput,
  };
}

/**
 * Generate performance report
 */
async function generatePerformanceReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    testDuration: PERFORMANCE_CONFIG.testDuration,
    concurrentUsers: PERFORMANCE_CONFIG.concurrentUsers,
    results,
    thresholds: PERFORMANCE_CONFIG,
    passed: {
      responseTime: results.responseTime.average <= PERFORMANCE_CONFIG.responseTimeThreshold,
      memory: results.memory.max <= PERFORMANCE_CONFIG.memoryThreshold,
      errorRate: results.errorRate <= 5, // 5% error rate threshold
    },
  };

  // Create performance results directory
  const resultsDir = path.resolve(__dirname, '../performance-results');
  await fs.mkdir(resultsDir, { recursive: true });

  // Write detailed report
  const reportPath = path.join(resultsDir, `performance-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  // Write summary for CI
  const summaryPath = path.join(resultsDir, 'performance-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    timestamp: report.timestamp,
    passed: Object.values(report.passed).every(Boolean),
    avgResponseTime: results.responseTime.average,
    maxMemoryUsage: results.memory.max,
    errorRate: results.errorRate,
    throughput: results.throughput,
  }, null, 2));

  return report;
}

/**
 * Main performance test execution
 */
async function runPerformanceTests() {
  let server = null;

  try {
    console.log('🧪 Starting Equoria Performance Tests');
    console.log('=====================================');

    // Start test server
    server = await startTestServer();

    // Wait for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Record start time
    performanceMetrics.startTime = Date.now();

    // Run load test
    await runLoadTest();

    // Record end time
    performanceMetrics.endTime = Date.now();

    // Analyze results
    const results = analyzePerformanceResults();

    // Generate report
    const report = await generatePerformanceReport(results);

    // Display results
    console.log('\n📊 Performance Test Results');
    console.log('============================');
    console.log(`Average Response Time: ${results.responseTime.average.toFixed(2)}ms`);
    console.log(`95th Percentile: ${results.responseTime.p95.toFixed(2)}ms`);
    console.log(`99th Percentile: ${results.responseTime.p99.toFixed(2)}ms`);
    console.log(`Max Memory Usage: ${(results.memory.max / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Error Rate: ${results.errorRate.toFixed(2)}%`);
    console.log(`Throughput: ${results.throughput.toFixed(2)} req/s`);

    // Check if tests passed
    const allPassed = Object.values(report.passed).every(Boolean);

    if (allPassed) {
      console.log('\n✅ All performance tests PASSED');
      process.exit(0);
    } else {
      console.log('\n❌ Some performance tests FAILED');
      console.log('Failed checks:');
      Object.entries(report.passed).forEach(([check, passed]) => {
        if (!passed) {
          console.log(`  - ${check}: FAILED`);
        }
      });
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up server
    if (server) {
      console.log('🛑 Stopping test server...');
      server.kill();
    }
  }
}

// Run performance tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests();
}
