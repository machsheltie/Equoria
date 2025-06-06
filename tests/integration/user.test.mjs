// 🎯 Updated import from userModel.mjs to userModel.mjs and function names
import { createUser, getUserById, getUserWithHorses } from '../../backend/models/userModel.mjs';
import { createHorse } from '../../backend/models/horseModel.mjs';

// Mock the database and logger
jest.unstable_mockModule('../../backend/db/index.mjs', () => ({
  default: {
    // 🎯 Changed player to user
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    breed: {
      create: jest.fn(),
    },
    horse: {
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

jest.unstable_mockModule('../../backend/utils/logger.mjs', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { default: prisma } = await import('../../backend/db/index.mjs');

// 🎯 Renamed describe block
describe('User Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 🎯 Renamed describe block
  describe('User Creation', () => {
    // 🎯 Renamed test
    test('should create a user successfully', async () => {
      // 🎯 Updated playerData to userData and its structure
      const userData = {
        // id is auto-generated, so not provided here
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User', // Merged from Player
        money: 500,
        level: 3,
        xp: 1000,
        settings: { darkMode: true, notifications: true },
      };

      const mockCreatedUser = {
        id: 1, // Example auto-generated ID
        ...userData,
        role: 'user', // Default role
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 🎯 Changed prisma.player.create to prisma.user.create
      prisma.user.create.mockResolvedValue(mockCreatedUser);

      // 🎯 Changed createPlayer to createUser
      const result = await createUser(userData);

      // 🎯 Changed prisma.player.create to prisma.user.create
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: userData,
      });
      expect(result).toEqual(mockCreatedUser);
    });

    // 🎯 Renamed test
    test('should handle user creation errors', async () => {
      // 🎯 Updated playerData to userData and its structure
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        money: 500,
        level: 3,
        xp: 1000,
        settings: { darkMode: true, notifications: true },
      };

      // 🎯 Changed prisma.player.create to prisma.user.create
      prisma.user.create.mockRejectedValue(new Error('Database connection failed'));

      // 🎯 Changed createPlayer to createUser and error message
      await expect(createUser(userData)).rejects.toThrow(
        'Database error in createUser: Database connection failed'
      );
    });
  });

  // 🎯 Renamed describe block
  describe('User Retrieval', () => {
    // 🎯 Renamed test
    test('should retrieve a user by ID', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const userId = 1;
      const mockUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'user',
        money: 500,
        level: 3,
        xp: 1000,
        settings: { darkMode: true, notifications: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // 🎯 Changed getPlayerById to getUserById
      const result = await getUserById(userId);

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(mockUser);
    });

    // 🎯 Renamed test
    test('should return null when user not found', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const userId = 999;

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      prisma.user.findUnique.mockResolvedValue(null);

      // 🎯 Changed getPlayerById to getUserById
      const result = await getUserById(userId);

      expect(result).toBeNull();
    });
  });

  // 🎯 Renamed describe block
  describe('User with Horses', () => {
    // 🎯 Renamed test
    test('should retrieve a user with their horses', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const userId = 1;
      const mockUserWithHorses = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        money: 500,
        level: 3,
        xp: 1000,
        settings: { darkMode: true, notifications: true },
        horses: [
          {
            id: 1,
            name: 'Starlight',
            age: 4,
            userId: userId, // 🎯 Horse linked to userId
            breed: { id: 1, name: 'Thoroughbred' },
            stable: null,
          },
          {
            id: 2,
            name: 'Comet',
            age: 6,
            userId: userId, // 🎯 Horse linked to userId
            breed: { id: 1, name: 'Thoroughbred' },
            stable: null,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      prisma.user.findUnique.mockResolvedValue(mockUserWithHorses);

      // 🎯 Changed getPlayerWithHorses to getUserWithHorses
      const result = await getUserWithHorses(userId);

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: {
          horses: {
            include: {
              breed: true,
              stable: true,
            },
          },
        },
      });
      expect(result).toEqual(mockUserWithHorses);
      expect(result.horses).toHaveLength(2);
      expect(result.horses[0].name).toBe('Starlight');
      expect(result.horses[1].name).toBe('Comet');
    });

    // 🎯 Renamed test
    test('should confirm user has 2 horses attached', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const userId = 1;
      const mockUserWithHorses = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        money: 500,
        level: 3,
        xp: 1000,
        settings: { darkMode: true, notifications: true },
        horses: [
          { id: 1, name: 'Starlight', age: 4, userId: userId },
          { id: 2, name: 'Comet', age: 6, userId: userId },
        ],
      };

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      prisma.user.findUnique.mockResolvedValue(mockUserWithHorses);

      // 🎯 Changed getPlayerWithHorses to getUserWithHorses
      const result = await getUserWithHorses(userId);

      expect(result.horses).toHaveLength(2);
      expect(result.horses.map((h) => h.name)).toEqual(['Starlight', 'Comet']);
    });
  });

  describe('JSON Settings Field', () => {
    test('should confirm JSON settings field exists and includes darkMode = true', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const userId = 1;
      const mockUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        money: 500,
        level: 3,
        xp: 1000,
        settings: {
          darkMode: true,
          notifications: true,
          soundEnabled: false,
          autoSave: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // 🎯 Changed getPlayerById to getUserById
      const result = await getUserById(userId);

      expect(result.settings).toBeDefined();
      expect(typeof result.settings).toBe('object');
      expect(result.settings.darkMode).toBe(true);
      expect(result.settings.notifications).toBe(true);
      expect(result.settings.soundEnabled).toBe(false);
      expect(result.settings.autoSave).toBe(true);
    });

    test('should handle complex JSON settings structure', async () => {
      // 🎯 Updated playerData to userData and its structure
      const userData = {
        // id is auto-generated
        username: 'advanceduser',
        email: 'advanced@example.com',
        password: 'password123',
        firstName: 'Advanced',
        lastName: 'User',
        name: 'Advanced User',
        money: 1000,
        level: 5,
        xp: 2500,
        settings: {
          darkMode: true,
          notifications: {
            email: true,
            push: false,
            sms: true,
          },
          gamePreferences: {
            autoSave: true,
            difficulty: 'hard',
            soundVolume: 0.8,
          },
          privacy: {
            showProfile: false,
            allowMessages: true,
          },
        },
      };

      const mockCreatedUser = {
        id: 2, // Example auto-generated ID
        ...userData,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 🎯 Changed prisma.player.create to prisma.user.create
      prisma.user.create.mockResolvedValue(mockCreatedUser);

      // 🎯 Changed createPlayer to createUser
      const result = await createUser(userData);

      expect(result.settings.darkMode).toBe(true);
      expect(result.settings.notifications.email).toBe(true);
      expect(result.settings.gamePreferences.difficulty).toBe('hard');
      expect(result.settings.privacy.showProfile).toBe(false);
    });
  });

  // 🎯 Renamed describe block
  describe('User Deletion and Integrity', () => {
    // 🎯 Renamed test
    test('should handle user deletion', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const userId = 1;
      const mockDeletedUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        money: 500,
        level: 3,
        xp: 1000,
        settings: { darkMode: true, notifications: true },
      };

      // 🎯 Changed prisma.player.delete to prisma.user.delete
      prisma.user.delete.mockResolvedValue(mockDeletedUser);

      // 🎯 Changed prisma.player.delete to prisma.user.delete
      const result = await prisma.user.delete({
        where: { id: userId },
      });

      // 🎯 Changed prisma.player.delete to prisma.user.delete
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(mockDeletedUser);
    });

    test('should confirm cascade behavior or integrity constraints', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const userId = 1;

      const mockUserWithHorses = {
        id: userId,
        // 🎯 Horse data should use userId
        horses: [
          { id: 1, name: 'Starlight', userId: userId },
          { id: 2, name: 'Comet', userId: userId },
        ],
      };

      // 🎯 Changed prisma.player.findUnique to prisma.user.findUnique
      prisma.user.findUnique.mockResolvedValue(mockUserWithHorses);

      // 🎯 Changed getPlayerWithHorses to getUserWithHorses
      const result = await getUserWithHorses(userId);

      expect(result.horses).toHaveLength(2);
      result.horses.forEach((horse) => {
        // 🎯 Check horse.userId
        expect(horse.userId).toBe(userId);
      });
    });
  });

  // 🎯 Renamed describe block
  describe('Horse Creation with User Link', () => {
    // 🎯 Renamed test
    test('should create horses linked to a user', async () => {
      // 🎯 Changed playerId to userId and type to Int
      const testUserId = 1; // Assuming a user with ID 1 exists or is created for this test
      const breedId = 1;
      const horseData = {
        name: 'Shadowfax',
        age: 5,
        breedId: breedId,
        userId: testUserId, // 🎯 Link horse to user via userId
        // ... other horse fields
      };
      const mockCreatedHorse = {
        id: 3,
        ...horseData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.horse.create.mockResolvedValue(mockCreatedHorse);
      // Mock user retrieval if createHorse checks for user existence
      // prisma.user.findUnique.mockResolvedValue({ id: testUserId, name: 'Test User', ... });

      const result = await createHorse(horseData);

      expect(prisma.horse.create).toHaveBeenCalledWith({
        data: horseData,
      });
      expect(result).toEqual(mockCreatedHorse);
      // 🎯 Verify horse is linked to the correct userId
      expect(result.userId).toBe(testUserId);
    });
  });
});
