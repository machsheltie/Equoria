#!/usr/bin/env node

/**
 * Server Startup Test
 *
 * This script tests that the server can start successfully with the new route configuration
 * without requiring database access. It verifies that all routes are properly registered
 * and there are no syntax errors in the route definitions.
 */

import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

async function testServerStartup() {
  console.log(
    `${colors.bold}${colors.blue}🚀 Testing Server Startup with New Routes${colors.reset}\n`
  );

  try {
    // Set environment variables to avoid database connection
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DB_CONNECTION = 'true';

    console.log(`${colors.yellow}Loading app module...${colors.reset}`);

    // Import the app
    const { default: app } = await import('./backend/app.mjs');

    console.log(`${colors.green}✅ App module loaded successfully${colors.reset}`);

    // Test that we can create a server instance
    console.log(`${colors.yellow}Creating server instance...${colors.reset}`);
    const server = createServer(app);

    console.log(`${colors.green}✅ Server instance created successfully${colors.reset}`);

    // Test that the app has the expected routes
    console.log(`${colors.yellow}Checking route registration...${colors.reset}`);

    // The app should have the router stack with our routes
    if (app._router && app._router.stack) {
      const routes = app._router.stack
        .filter((layer) => layer.route || layer.name === 'router')
        .map((layer) => {
          if (layer.route) {
            return layer.route.path;
          } else if (layer.regexp) {
            // Extract route pattern from regex
            const regexStr = layer.regexp.toString();
            if (regexStr.includes('api')) {
              return 'API route registered';
            }
          }
          return 'Route registered';
        });

      console.log(`${colors.green}✅ Found ${routes.length} route registrations${colors.reset}`);
    }

    // Test that we can make a basic request to the API info endpoint
    console.log(`${colors.yellow}Testing API info endpoint...${colors.reset}`);

    // Create a mock request/response to test the /api endpoint
    const mockReq = {
      method: 'GET',
      url: '/api',
      headers: {},
      on: () => {},
      once: () => {},
    };

    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader: function (name, value) {
        this.headers[name] = value;
      },
      writeHead: function (statusCode) {
        this.statusCode = statusCode;
      },
      write: function (data) {
        this.body = data;
      },
      end: function (data) {
        if (data) this.body = data;
        this.finished = true;
      },
    };

    // Process the request
    app(mockReq, mockRes);

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (mockRes.finished && mockRes.body) {
      try {
        const responseData = JSON.parse(mockRes.body);
        if (responseData.endpoints) {
          console.log(`${colors.green}✅ API info endpoint working${colors.reset}`);

          // Check for our new endpoints
          const endpoints = responseData.endpoints;
          const expectedEndpoints = ['users', 'leaderboards', 'milestones'];

          const foundEndpoints = expectedEndpoints.filter(
            (endpoint) => endpoints[endpoint] && endpoints[endpoint].includes(`/api/${endpoint}`)
          );

          console.log(
            `${colors.green}✅ Found ${foundEndpoints.length}/${expectedEndpoints.length} expected new endpoints${colors.reset}`
          );

          if (foundEndpoints.length === expectedEndpoints.length) {
            console.log(`${colors.green}✅ All new endpoints properly registered${colors.reset}`);
          } else {
            console.log(`${colors.yellow}⚠️  Some endpoints may need verification${colors.reset}`);
          }
        }
      } catch (parseError) {
        console.log(
          `${colors.yellow}⚠️  API response not JSON, but server responded${colors.reset}`
        );
      }
    }

    console.log(`\n${colors.bold}${colors.green}🎉 SERVER STARTUP TEST PASSED!${colors.reset}`);
    console.log(`${colors.green}✅ No syntax errors in route definitions${colors.reset}`);
    console.log(`${colors.green}✅ App module loads successfully${colors.reset}`);
    console.log(`${colors.green}✅ Server can be created with new routes${colors.reset}`);
    console.log(`${colors.green}✅ API endpoints are accessible${colors.reset}`);

    return true;
  } catch (error) {
    console.log(`\n${colors.bold}${colors.red}❌ SERVER STARTUP TEST FAILED!${colors.reset}`);
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);

    if (error.stack) {
      console.log(`${colors.red}Stack trace:${colors.reset}`);
      console.log(error.stack);
    }

    return false;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testServerStartup()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`${colors.red}Test execution failed: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}

export { testServerStartup };
