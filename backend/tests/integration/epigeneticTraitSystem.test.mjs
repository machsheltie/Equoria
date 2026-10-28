/**
 * Integration tests for the Enhanced Epigenetic Trait System
 *
 * Tests trait history logging. The API endpoints (definitions, history,
 * summary) were removed with the trait reports (owner ruling 2026-10-28, q152;
 * Equoria-a7f1p), and their cases with them (pinned in
 * removedTraitReportRoutes).
 *
 * The evaluate-milestone and breeding-insights routes were removed
 * (Equoria-a7f1p; owner rulings 2026-10-27 grooming-day reveal ladder and
 * 2026-10-07 no advice); their cases left with them.
 */

// Jest is available globally in test environment
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

describe('Trait History Service', () => {
  let testUser, testHorse, testGroom;

  beforeAll(async () => {
    // Create minimal test data for service tests
    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `serviceTestUser_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `service_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
        password: 'hashedPassword',
        firstName: 'Service',
        lastName: 'Test',
        money: 1000,
      },
    });

    testHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'ServiceTest Horse',
        userId: testUser.id,
        dateOfBirth: gameCalendarDate(new Date(), -30), // 30 days old
        age: 0,
        sex: 'Stallion',
      },
    });

    testGroom = await prisma.groom.create({
      data: {
        name: 'Service Test Groom',
        speciality: 'foalCare',
        experience: 10,
        skillLevel: 'intermediate',
        personality: 'patient',
        epigeneticInfluenceType: 'patient',
        sessionRate: 20.0,
        userId: testUser.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.traitHistoryLog.deleteMany({ where: { horseId: testHorse.id } });
    await prisma.groom.deleteMany({ where: { id: testGroom.id } });
    await prisma.horse.deleteMany({ where: { id: testHorse.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  test('Should log and retrieve trait assignments correctly', async () => {
    const { logTraitAssignment } = await import('../../modules/traits/services/traitHistoryService.mjs');

    // Log a trait assignment
    const traitData = {
      horseId: testHorse.id,
      traitName: 'Confident',
      sourceType: 'milestone',
      sourceId: 'socializationMilestone',
      influenceScore: 2.5,
      isEpigenetic: true,
      groomId: testGroom.id,
      bondScore: 20,
    };

    const loggedTrait = await logTraitAssignment(traitData);
    expect(loggedTrait).toHaveProperty('id');
    expect(loggedTrait.traitName).toBe('Confident');
    expect(loggedTrait.isEpigenetic).toBe(true);

    // Read the stored history back (the getTraitHistory reader went with the
    // trait reports, Equoria-1vep2)
    const history = await prisma.traitHistoryLog.findMany({ where: { horseId: testHorse.id } });
    expect(history.length).toBeGreaterThan(0);

    const confidentTrait = history.find(h => h.traitName === 'Confident');
    expect(confidentTrait).toBeDefined();
    expect(confidentTrait.sourceType).toBe('milestone');
  });
});
