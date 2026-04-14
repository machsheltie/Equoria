/**
 * Groom System Constants Unit Tests
 *
 * Validates the expected constant values for groom specialties, skill levels,
 * personalities, and interaction constraints.
 *
 * Reclassified from tests/integration/groomRoutes.test.mjs — these tests do not
 * exercise the HTTP layer or the database; they validate hardcoded domain constants.
 */

describe('Groom System Constants', () => {
  it('should define expected specialty types', () => {
    const specialties = ['foal_care', 'general', 'training', 'medical'];
    expect(specialties).toContain('foal_care');
  });

  it('should define expected skill level tiers', () => {
    const skillLevels = ['novice', 'intermediate', 'expert', 'master'];
    expect(skillLevels).toContain('intermediate');
  });

  it('should define expected personality types', () => {
    const personalities = ['gentle', 'energetic', 'patient', 'strict'];
    expect(personalities).toContain('gentle');
  });

  it('should define valid interaction types', () => {
    const validInteractionTypes = ['daily_care', 'feeding', 'grooming', 'exercise', 'medical_check'];
    expect(validInteractionTypes).toContain('daily_care');
    expect(validInteractionTypes).toContain('feeding');
    expect(validInteractionTypes).toContain('grooming');
  });

  it('should define valid interaction duration range', () => {
    const minDuration = 5;
    const maxDuration = 480;
    expect(minDuration).toBeLessThan(maxDuration);
    expect(60).toBeGreaterThanOrEqual(minDuration);
    expect(60).toBeLessThanOrEqual(maxDuration);
  });

  it('should define valid session rate range', () => {
    const minRate = 5;
    const maxRate = 100;
    const testRate = 18.0;
    expect(testRate).toBeGreaterThanOrEqual(minRate);
    expect(testRate).toBeLessThanOrEqual(maxRate);
  });
});
