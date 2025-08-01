/**
 * 🧪 INTEGRATION TEST: Groom Bonding System Integration
 *
 * This test validates the integration of the new bonding system with the existing
 * groom interaction system, ensuring proper workflow for horses 3+ years old.
 *
 * 📋 BUSINESS RULES TESTED:
 * - New grooming tasks (brushing, hand-walking, stall_care) for horses 3+ years old
 * - Integration with existing daily interaction limits
 * - Bond score updates in horse records
 * - Consecutive day tracking and burnout immunity
 * - Proper interaction recording with new task types
 * - Age-based task validation
 *
 * 🎯 TESTING APPROACH: Balanced Mocking
 * - Mock: Database operations (Prisma), time functions
 * - Real: Business logic, validation, bonding calculations
 * - Focus: Complete workflow from API call to database updates
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../db/index.mjs';
// TODO: Will use GROOM_CONFIG in future integration tests
// import { GROOM_CONFIG } from '../config/groomConfig.mjs';

describe('Groom Bonding System Integration', () => {
  let testUser, testGroom, testHorse, testAssignment;

  beforeEach(async () => {
    // Clean up test data
    await prisma.groomInteraction.deleteMany({});
    await prisma.groomAssignment.deleteMany({});
    await prisma.groom.deleteMany({});
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-bonding',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: 'Test Groom',
        speciality: 'general',
        experience: 5,
        skillLevel: 'intermediate',
        personality: 'gentle',
        sessionRate: 25.0,
        userId: testUser.id,
      },
    });

    // Create test horse (3+ years old)
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 4); // 4 years old

    testHorse = await prisma.horse.create({
      data: {
        name: 'Test Horse',
        sex: 'Mare',
        dateOfBirth: birthDate,
        age: 1460, // 4 years in days
        userId: testUser.id,
        bondScore: 20,
        daysGroomedInARow: 3,
        burnoutStatus: 'none',
      },
    });

    // Create groom assignment
    testAssignment = await prisma.groomAssignment.create({
      data: {
        foalId: testHorse.id,
        groomId: testGroom.id,
        isActive: true,
        userId: testUser.id,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.groomInteraction.deleteMany({});
    await prisma.groomAssignment.deleteMany({});
    await prisma.groom.deleteMany({});
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('New Grooming Tasks for Horses 3+ Years Old', () => {
    it('should successfully process brushing interaction', async () => {
      const response = await request(app).post('/api/grooms/interact').send({
        foalId: testHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'brushing',
        duration: 30,
        notes: 'Daily brushing session',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.interaction.interactionType).toBe('brushing');
      expect(response.body.data.foalUpdates.bondingChange).toBeGreaterThan(0);
    });

    it('should successfully process hand-walking interaction', async () => {
      const response = await request(app).post('/api/grooms/interact').send({
        foalId: testHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'hand-walking',
        duration: 45,
        notes: 'Hand-walking exercise',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.interaction.interactionType).toBe('hand-walking');
      expect(response.body.data.foalUpdates.bondingChange).toBeGreaterThan(0);
    });

    it('should successfully process stall_care interaction', async () => {
      const response = await request(app).post('/api/grooms/interact').send({
        foalId: testHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'stall_care',
        duration: 20,
        notes: 'Stall cleaning and maintenance',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.interaction.interactionType).toBe('stall_care');
      expect(response.body.data.foalUpdates.bondingChange).toBeGreaterThan(0);
    });
  });

  describe('Age Restrictions', () => {
    it('should reject new grooming tasks for horses under 3 years old', async () => {
      // Create young horse (2 years old in game time)
      // In game time: 2 years = 14 days, which is under 3 years (21 days) minimum for general grooming
      const youngBirthDate = new Date();
      youngBirthDate.setDate(youngBirthDate.getDate() - 14); // 14 days ago (2 years in game time)

      const youngHorse = await prisma.horse.create({
        data: {
          name: 'Young Horse',
          sex: 'Colt',
          dateOfBirth: youngBirthDate,
          age: 14, // 14 days old (2 years in game time)
          userId: testUser.id,
          bondScore: 0,
          daysGroomedInARow: 0,
          burnoutStatus: 'none',
        },
      });

      const response = await request(app).post('/api/grooms/interact').send({
        foalId: youngHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'brushing',
        duration: 30,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('young foal');
    });
  });

  describe('Bond Score Updates', () => {
    it('should update horse bond score after grooming', async () => {
      const initialBondScore = testHorse.bondScore;

      // Set up horse with some consecutive days and recent grooming
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.horse.update({
        where: { id: testHorse.id },
        data: {
          daysGroomedInARow: 2,
          lastGroomed: yesterday,
        },
      });

      await request(app).post('/api/grooms/interact').send({
        foalId: testHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'brushing',
        duration: 30,
      });

      // Check updated horse record
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: testHorse.id },
        select: { bondScore: true, daysGroomedInARow: true, burnoutStatus: true },
      });

      expect(updatedHorse.bondScore).toBeGreaterThan(initialBondScore);
      expect(updatedHorse.daysGroomedInARow).toBeGreaterThanOrEqual(3); // Should increase to 3
    });

    it('should grant burnout immunity after 7 consecutive days', async () => {
      // Update horse to 6 consecutive days with a recent lastGroomed date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.horse.update({
        where: { id: testHorse.id },
        data: {
          daysGroomedInARow: 6,
          lastGroomed: yesterday,
        },
      });

      await request(app).post('/api/grooms/interact').send({
        foalId: testHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'brushing',
        duration: 30,
      });

      // Check immunity granted
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: testHorse.id },
        select: { daysGroomedInARow: true, burnoutStatus: true },
      });

      expect(updatedHorse.daysGroomedInARow).toBeGreaterThanOrEqual(6);
      expect(updatedHorse.burnoutStatus).toBe('immune');
    });
  });

  describe('Daily Interaction Limits', () => {
    it('should enforce one grooming session per horse per day', async () => {
      // First interaction should succeed
      const firstResponse = await request(app).post('/api/grooms/interact').send({
        foalId: testHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'brushing',
        duration: 30,
      });

      expect(firstResponse.status).toBe(200);

      // Second interaction same day should fail
      const secondResponse = await request(app).post('/api/grooms/interact').send({
        foalId: testHorse.id,
        groomId: testGroom.id,
        assignmentId: testAssignment.id,
        interactionType: 'hand-walking',
        duration: 30,
      });

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.message).toContain('already had a groom interaction today');
    });
  });
});
