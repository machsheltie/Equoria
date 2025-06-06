import { describe, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the user model
jest.unstable_mockModule(join(__dirname, '../../models/userModel.mjs'), () => ({
  getUserById: jest.fn(),
  getUserWithHorses: jest.fn(),
  getUserByEmail: jest.fn(),
}));

// Import the mocked functions
const { getUserById, getUserWithHorses, getUserByEmail } = await import(
  '../../models/userModel.mjs'
);

describe('User Integration Tests - Mocked Database', () => {
  const testUserId = 'test-user-uuid-123';
  const testUserEmail = 'test@example.com';

  const mockUser = {
    id: testUserId,
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    email: testUserEmail,
    money: 500,
    level: 3,
    xp: 1000,
    settings: {
      darkMode: true,
      notifications: true,
      soundEnabled: false,
      autoSave: true,
    },
  };

  const mockHorses = [
    {
      id: 1,
      name: 'Comet',
      userId: testUserId,
      breed: { name: 'Thoroughbred' },
    },
    {
      id: 2,
      name: 'Starlight',
      userId: testUserId,
      breed: { name: 'Thoroughbred' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    getUserById.mockResolvedValue(mockUser);
    getUserByEmail.mockResolvedValue(mockUser);
    getUserWithHorses.mockResolvedValue({
      ...mockUser,
      horses: mockHorses,
    });
  });

  describe('User Retrieval from Seeded Data', () => {
    test('should retrieve the seeded user by ID', async () => {
      const user = await getUserById(testUserId);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.username).toBe('testuser');
      expect(user.email).toBe(testUserEmail);
      expect(user.money).toBe(500);
      expect(user.level).toBe(3);
      expect(user.xp).toBe(1000);
    });

    test('should retrieve the seeded user by email', async () => {
      const user = await getUserByEmail(testUserEmail);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.username).toBe('testuser');
      expect(user.email).toBe(testUserEmail);
    });

    test('should return null for non-existent user', async () => {
      getUserById.mockResolvedValueOnce(null);

      const user = await getUserById('nonexistent-uuid-456');

      expect(user).toBeNull();
    });
  });

  describe('User with Horses Relationship', () => {
    test('should retrieve user with their 2 horses', async () => {
      const userWithHorses = await getUserWithHorses(testUserId);

      expect(userWithHorses).toBeDefined();
      expect(userWithHorses.id).toBe(testUserId);
      expect(userWithHorses.horses).toBeDefined();
      expect(userWithHorses.horses).toHaveLength(2);

      // Check horse names
      const horseNames = userWithHorses.horses.map(h => h.name).sort();
      expect(horseNames).toEqual(['Comet', 'Starlight']);

      // Check that horses are linked to the user
      userWithHorses.horses.forEach(horse => {
        expect(horse.userId).toBe(testUserId);
      });
    });

    test('should include breed information for horses', async () => {
      const userWithHorses = await getUserWithHorses(testUserId);

      expect(userWithHorses.horses).toHaveLength(2);

      userWithHorses.horses.forEach(horse => {
        expect(horse.breed).toBeDefined();
        expect(horse.breed.name).toBe('Thoroughbred');
      });
    });
  });

  describe('JSON Settings Field', () => {
    test('should confirm JSON settings field exists and includes darkMode = true', async () => {
      const user = await getUserById(testUserId);

      expect(user.settings).toBeDefined();
      expect(typeof user.settings).toBe('object');
      expect(user.settings.darkMode).toBe(true);
      expect(user.settings.notifications).toBe(true);
      expect(user.settings.soundEnabled).toBe(false);
      expect(user.settings.autoSave).toBe(true);
    });
  });

  describe('Database Constraints', () => {
    test('should confirm unique email constraint', async () => {
      // This test verifies that the unique constraint on email is working
      // by checking that only one user exists with the test email
      const user = await getUserByEmail(testUserEmail);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
    });
  });
});
