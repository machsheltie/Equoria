/**
 * 🧪 INTEGRATION TEST: Database Data Check - Live Data Validation & Debugging
 *
 * This test validates the current state of the database by checking actual data
 * and relationships to help with debugging and data integrity verification.
 *
 * 📋 BUSINESS RULES TESTED:
 * - User data integrity: All users have required fields (id, email, username)
 * - User profile completeness: firstName, lastName, role, money, level, xp fields
 * - Horse ownership relationships: Horses properly linked to users via userId
 * - Database schema consistency: Field names and data types match expectations
 * - Data existence validation: Graceful handling of empty tables
 * - Relationship integrity: User-horse relationships properly established
 * - Field accessibility: All expected fields can be queried without errors
 * - Data structure validation: Objects have expected properties and types
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. User table data validation - Basic user information and structure
 * 2. User profile completeness - Full user data including game progression
 * 3. Horse-user relationships - Ownership links and data integrity
 * 4. Database connectivity - Live database query execution
 * 5. Schema validation - Field existence and accessibility
 * 6. Empty table handling - Graceful behavior with no data
 * 7. Data logging - Console output for debugging and verification
 * 8. Relationship queries - Include statements and nested data access
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete database operations, live data queries, relationship validation
 * ✅ REAL: Schema verification, data integrity checks, actual database state
 * 🔧 MOCK: None - full integration testing with live database for debugging
 *
 * 💡 TEST STRATEGY: Live database validation for debugging and data integrity
 *    verification with console logging to help identify data issues
 *
 * ⚠️  NOTE: This test uses console.log for debugging purposes and queries live data.
 *    Console warnings are expected and intentional for data inspection.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../db/index.mjs';

describe('🔍 INTEGRATION: Database Data Check - Live Data Validation & Debugging', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should check what users exist', async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true, // Select only id and email
      },
    });
    console.log('Users in database:', JSON.stringify(users, null, 2));
    expect(Array.isArray(users)).toBe(true);
    // Add new assertion to check if every user object has an email property
    expect(users.every(user => user.id && user.email)).toBe(true);
    if (users.length > 0) {
      const firstUser = users[0];
      expect(firstUser.id).toBeDefined();
      expect(firstUser.email).toBeDefined();
      // Removed assertions for fields no longer selected:
      // expect(firstUser.username).toBeDefined();
      // expect(firstUser.firstName).toBeDefined();
      // expect(firstUser.lastName).toBeDefined();
      // expect(firstUser.role).toBeDefined();
      // expect(firstUser.money).toBeDefined();
      // expect(firstUser.level).toBeDefined();
      // expect(firstUser.xp).toBeDefined();
    }
  });

  it('should check what players exist (using user table)', async () => {
    const players = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        money: true,
        level: true,
        xp: true,
      },
    });
    console.log('Players in database (from user table):', JSON.stringify(players, null, 2));
    expect(Array.isArray(players)).toBe(true);
    if (players.length > 0) {
      const firstPlayer = players[0];
      expect(firstPlayer.id).toBeDefined();
      expect(firstPlayer.username).toBeDefined();
      expect(firstPlayer.email).toBeDefined();
      expect(firstPlayer.firstName).toBeDefined();
      expect(firstPlayer.lastName).toBeDefined();
      expect(firstPlayer.role).toBeDefined();
      expect(firstPlayer.money).toBeDefined();
      expect(firstPlayer.level).toBeDefined();
      expect(firstPlayer.xp).toBeDefined();
    }
  });

  it('should check what horses exist', async () => {
    const horses = await prisma.horse.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
    console.log('Horses in database:', JSON.stringify(horses, null, 2));
    expect(Array.isArray(horses)).toBe(true);
    if (horses.length > 0) {
      const firstHorse = horses[0];
      expect(firstHorse.id).toBeDefined();
      expect(firstHorse.user).toBeDefined();
      if (firstHorse.user) {
        expect(firstHorse.user.id).toBeDefined();
        expect(firstHorse.user.username).toBeDefined();
        expect(firstHorse.user.email).toBeDefined();
      }
    }
  });
});
