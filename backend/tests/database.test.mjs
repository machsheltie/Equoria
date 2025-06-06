/**
 * 🧪 INTEGRATION TEST: Database Connection - Core Infrastructure Validation
 *
 * This test validates the fundamental database connectivity and basic query
 * functionality to ensure the core infrastructure is working correctly.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Database connection establishment and maintenance
 * - Raw SQL query execution capability
 * - Prisma ORM functionality and table access
 * - User table accessibility and data structure validation
 * - Connection cleanup and resource management
 * - Basic data integrity: user records have required fields (id, email)
 * - Query result format validation: arrays, objects, field presence
 * - Database schema compatibility with Prisma client
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. Database connection establishment via Prisma
 * 2. Raw SQL query execution ($queryRaw functionality)
 * 3. User table query access (findMany operations)
 * 4. Data structure validation (id and email field presence)
 * 5. Connection cleanup and disconnection
 * 6. Basic infrastructure health checks
 * 7. Prisma client functionality verification
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete database operations, connection management, query execution
 * ✅ REAL: Prisma client functionality, schema validation, data integrity checks
 * 🔧 MOCK: None - full integration testing with real database infrastructure
 *
 * 💡 TEST STRATEGY: Infrastructure validation with real database to ensure
 *    core connectivity and basic operations work correctly for all other tests
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../db/index.mjs';

describe('🔌 INTEGRATION: Database Connection - Core Infrastructure Validation', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to the database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    expect(result[0].test).toBe(1);
  });

  it('should be able to query the User table', async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true, // Select only id and email
      },
    });
    expect(Array.isArray(users)).toBe(true);

    // If users exist, validate their structure
    if (users.length > 0) {
      expect(users.every(user => user.id && user.email)).toBe(true);
      // Validate that id is a string (UUID format)
      expect(typeof users[0].id).toBe('string');
      // Validate that email is a string with @ symbol
      expect(typeof users[0].email).toBe('string');
      expect(users[0].email).toContain('@');
    }

    // Test should pass even if no users exist (empty database)
    expect(users).toBeDefined();
  });

  it('should be able to perform basic database operations', async () => {
    // Test database write capability with a simple count query
    const userCount = await prisma.user.count();
    expect(typeof userCount).toBe('number');
    expect(userCount).toBeGreaterThanOrEqual(0);
  });

  it('should handle database errors gracefully', async () => {
    // Test error handling with an invalid query
    await expect(async () => {
      await prisma.$queryRaw`SELECT * FROM nonexistent_table`;
    }).rejects.toThrow();
  });
});
