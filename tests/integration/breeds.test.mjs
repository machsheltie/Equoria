import request from 'supertest'; // Changed to ESM
import app from '../../backend/app.mjs'; // Path to your Express app, assuming .mjs extension
import prisma from '../../backend/db/index.mjs'; // Path to your Prisma client
// import logger from '../../backend/utils/logger.mjs'; // Logger might not be needed directly if Prisma handles errors, ensure .mjs extension if used

// Helper function to reset the database using Prisma
const resetDatabase = async () => {
  try {
    // Order matters due to foreign key constraints if any exist pointing to Breed
    // If Horse model has a required relation to Breed, horses must be deleted first.
    // Assuming Horse model has a breedId that relates to Breed model's id
    await prisma.horse.deleteMany({}); // Clear horses first
    await prisma.breed.deleteMany({}); // Then clear breeds
  } catch (error) {
    console.error('Error resetting database for tests:', error); // console.error for test visibility
    // It's crucial that tests can reset state. If this fails, tests are unreliable.
    throw error; // Rethrow to halt tests if DB reset fails
  }
};

describe('Breeds API - /api/breeds', () => {
  beforeAll(async () => {
    // Any one-time setup, if needed. Prisma client is typically available globally.
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect(); // Disconnect Prisma client after all tests
  });

  describe('POST /api/breeds', () => {
    it('should create a new breed and return 201 status with the created breed', async () => {
      const newBreedData = {
        name: 'Arabian',
        description: 'Elegant and spirited',
      };
      const response = await request(app).post('/api/breeds').send(newBreedData);
      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newBreedData.name);
      expect(response.body.description).toBe(newBreedData.description);

      // Verify the breed was actually inserted into the database using Prisma
      const dbBreed = await prisma.breed.findUnique({
        where: { id: response.body.id },
      });
      expect(dbBreed).not.toBeNull();
      expect(dbBreed.name).toBe(newBreedData.name);
      expect(dbBreed.description).toBe(newBreedData.description);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/breeds')
        .send({ description: 'A breed without a name' }); // Send only description
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if name is not a string or empty', async () => {
      const responseEmptyName = await request(app).post('/api/breeds').send({ name: '' });
      expect(responseEmptyName.statusCode).toBe(400);

      const responseNonStringName = await request(app).post('/api/breeds').send({ name: 123 });
      expect(responseNonStringName.statusCode).toBe(400);
    });

    it('should return 409 if breed name already exists (case-insensitive handled by controller)', async () => {
      const breedName = 'Thoroughbred';
      await prisma.breed.create({
        data: { name: breedName, description: 'Racehorse' },
      });

      // Attempt to create it again (same case)
      const responseSameCase = await request(app).post('/api/breeds').send({ name: breedName });
      expect(responseSameCase.statusCode).toBe(409);

      // Attempt to create with different casing
      const responseDifferentCase = await request(app)
        .post('/api/breeds')
        .send({ name: breedName.toLowerCase() });
      expect(responseDifferentCase.statusCode).toBe(409);
    });
  });

  describe('GET /api/breeds', () => {
    it('should return an array of breeds and 200 status', async () => {
      // Pre-populate some data using Prisma
      await prisma.breed.createMany({
        data: [
          { name: 'Quarter Horse', description: 'Versatile' },
          { name: 'Morgan', description: 'Elegant' },
        ],
      });

      const response = await request(app).get('/api/breeds');
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      const names = response.body.map((b) => b.name);
      expect(names).toContain('Quarter Horse');
      expect(names).toContain('Morgan');
    });

    it('should return an empty array and 200 status if no breeds exist', async () => {
      const response = await request(app).get('/api/breeds');
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /api/breeds/:id', () => {
    it('should return a single breed by id and 200 status', async () => {
      const createdBreed = await prisma.breed.create({
        data: { name: 'Appaloosa', description: 'Spotted' },
      });
      const breedId = createdBreed.id;

      const response = await request(app).get(`/api/breeds/${breedId}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id', breedId);
      expect(response.body.name).toBe('Appaloosa');
    });

    it('should return 404 if breed with id does not exist', async () => {
      const nonExistentId = 99999;
      const response = await request(app).get(`/api/breeds/${nonExistentId}`);
      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if id is not a valid integer (route validation)', async () => {
      const invalidId = 'abc';
      const response = await request(app).get(`/api/breeds/${invalidId}`);
      // This depends on your route validation for the ID parameter.
      // If it's like the breedController, it should be a 400 due to parseInt failing before Prisma is even hit.
      // Or if the route param validation is less strict and allows it to reach the controller,
      // Prisma might throw its own error or the parseInt in controller would make it NaN, leading to 404 if not found (or other error).
      // Assuming route param validation catches non-integers for /:id and returns 400 as per typical practice.
      expect(response.statusCode).toBe(400);
    });
  });
});
