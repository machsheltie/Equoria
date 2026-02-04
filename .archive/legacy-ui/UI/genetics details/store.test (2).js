process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, server: expressServer } = require('../../index');
const pool = require('../../config/db');
const { stopHealthScheduler } = require('../../utils/healthScheduler');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateStoreHorseGenetics, determinePhenotype } = require('../../utils/geneticsEngine');
const { generateStoreHorseRatings } = require('../../utils/ratingsEngine');
const { determineStoreHorseTemperament } = require('../../utils/temperamentEngine');
const { calculateAgeInYears } = require('../../utils/horseUtils');

jest.mock('../../utils/geneticsEngine');
jest.mock('../../utils/ratingsEngine');
jest.mock('../../utils/temperamentEngine');
jest.mock('../../utils/horseUtils');

describe('Store API Endpoints', () => {
  let testUser;
  let testToken;
  let testBreed;

  beforeAll(async () => {
    console.log('Environment variables:', {
      DB_USER: process.env.DB_USER,
      DB_HOST: process.env.DB_HOST,
      DB_DATABASE: process.env.DB_DATABASE,
      DB_PASSWORD: process.env.DB_PASSWORD ? '[REDACTED]' : 'undefined',
      DB_PORT: process.env.DB_PORT,
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET,
    });

    // Mock utility functions
    generateStoreHorseGenetics.mockResolvedValue({
      E_Extension: 'E/e',
      A_Agouti: 'A/a',
      Cr_Cream: 'n/n',
    });
    determinePhenotype.mockResolvedValue({
      final_display_color: 'Bay',
      phenotypic_markings: {
        face: 'star',
        legs: { LF: 'sock', RF: 'none', LH: 'none', RH: 'none' },
      },
      determined_shade: 'standard',
    });
    generateStoreHorseRatings.mockReturnValue({
      conformationRatings: {
        head: 75,
        neck: 80,
        shoulders: 70,
        back: 65,
        hindquarters: 85,
        legs: 90,
        hooves: 60,
      },
      gaitRatings: {
        walk: 70,
        trot: 75,
        canter: 80,
        gallop: 85,
        gaiting: null,
      },
    });
    determineStoreHorseTemperament.mockReturnValue('Calm');
    calculateAgeInYears.mockReturnValue(3);

    // Mock Date.now for consistent date calculations
    jest.spyOn(Date, 'now').mockImplementation(() => new Date('2025-05-20T00:00:00Z').getTime());

    // Insert test user
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    const userResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, game_currency, user_type, is_verified, breeder_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      ['testuser', 'test@example.com', hashedPassword, 'user', 10000, 'basic', false, 1]
    );
    testUser = { id: userResult.rows[0].id };
    testToken = jwt.sign({ user: { id: testUser.id } }, 'test-secret', { expiresIn: '1h' });

    // Insert test breed
    const breedResult = await pool.query(
      `INSERT INTO breeds (
        name,
        default_trait,
        breed_genetic_profile
      ) VALUES ($1, $2, $3) RETURNING id`,
      [
        'Test Breed',
        'Endurance',
        {
          allele_weights: {
            E_Extension: { 'E/e': 0.5, 'e/e': 0.5 },
            A_Agouti: { 'A/a': 0.5, 'a/a': 0.5 },
          },
          temperament_weights: { Calm: 50, Spirited: 50 },
          rating_profiles: {
            conformation: {
              head: { mean: 75, std_dev: 10 },
              neck: { mean: 80, std_dev: 10 },
              shoulders: { mean: 70, std_dev: 10 },
              back: { mean: 65, std_dev: 10 },
              hindquarters: { mean: 85, std_dev: 10 },
              legs: { mean: 90, std_dev: 10 },
              hooves: { mean: 60, std_dev: 10 },
            },
            gaits: {
              walk: { mean: 70, std_dev: 10 },
              trot: { mean: 75, std_dev: 10 },
              canter: { mean: 80, std_dev: 10 },
              gallop: { mean: 85, std_dev: 10 },
              gaiting: null,
            },
            is_gaited_breed: false,
          },
          boolean_modifiers_prevalence: { overo: 0.1, tobiano: 0.2 },
        },
      ]
    );
    testBreed = { id: breedResult.rows[0].id };
  });

  beforeEach(async () => {
    const client = await pool.pool.connect();
    try {
      await client.query('BEGIN');
      console.log('Attempting to truncate tables at:', new Date().toISOString());
      await client.query(
        'TRUNCATE TABLE users, stables, breeds, crossbreed_rules, horses, conformation_ratings, gait_ratings, breeding_requests RESTART IDENTITY CASCADE'
      );
      console.log('Tables truncated successfully at:', new Date().toISOString());
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error during beforeEach TRUNCATE in store.test.js:', error);
      throw error;
    } finally {
      client.release();
    }

    try {
      // Re-insert test user
      const hashedPassword = await bcrypt.hash('testpassword', 10);
      const userResult = await pool.query(
        'INSERT INTO users (username, email, password_hash, role, game_currency, user_type, is_verified, breeder_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        ['testuser', 'test@example.com', hashedPassword, 'user', 10000, 'basic', false, 1]
      );
      testUser = { id: userResult.rows[0].id };
      testToken = jwt.sign({ user: { id: testUser.id } }, 'test-secret', { expiresIn: '1h' });

      // Re-insert test breed
      const breedResult = await pool.query(
        `INSERT INTO breeds (
          name,
          default_trait,
          breed_genetic_profile
        ) VALUES ($1, $2, $3) RETURNING id`,
        [
          'Test Breed',
          'Endurance',
          {
            allele_weights: {
              E_Extension: { 'E/e': 0.5, 'e/e': 0.5 },
              A_Agouti: { 'A/a': 0.5, 'a/a': 0.5 },
            },
            temperament_weights: { Calm: 50, Spirited: 50 },
            rating_profiles: {
              conformation: {
                head: { mean: 75, std_dev: 10 },
                neck: { mean: 80, std_dev: 10 },
                shoulders: { mean: 70, std_dev: 10 },
                back: { mean: 65, std_dev: 10 },
                hindquarters: { mean: 85, std_dev: 10 },
                legs: { mean: 90, std_dev: 10 },
                hooves: { mean: 60, std_dev: 10 },
              },
              gaits: {
                walk: { mean: 70, std_dev: 10 },
                trot: { mean: 75, std_dev: 10 },
                canter: { mean: 80, std_dev: 10 },
                gallop: { mean: 85, std_dev: 10 },
                gaiting: null,
              },
              is_gaited_breed: false,
            },
            boolean_modifiers_prevalence: { overo: 0.1, tobiano: 0.2 },
          },
        ]
      );
      testBreed = { id: breedResult.rows[0].id };
    } catch (error) {
      console.error('Error during beforeEach data insertion in store.test.js:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (pool && typeof pool.pool.end === 'function') {
      await pool.pool.end();
      console.log('Database pool closed in store.test.js.');
    }
    stopHealthScheduler();
    if (expressServer && typeof expressServer.close === 'function') {
      await new Promise((resolve) => expressServer.close(resolve));
      console.log('Express server closed in store.test.js.');
    }
    jest.restoreAllMocks();
  });

  describe('POST /api/store/purchase-horse', () => {
    it('should purchase a horse successfully with valid input', async () => {
      const response = await request(app)
        .post('/api/store/purchase-horse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Horse',
          breed_id: testBreed.id,
          sex: 'Stallion',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Horse purchased successfully!');
      expect(response.body.horse).toMatchObject({
        name: 'Test Horse',
        owner_id: testUser.id,
        breed_id: testBreed.id,
        sex: 'Stallion',
        final_display_color: 'Bay',
        temperament: 'Calm',
        trait: 'Endurance',
        age_years: 3,
        conformation_ratings: {
          head: 75,
          neck: 80,
          shoulders: 70,
          back: 65,
          hindquarters: 85,
          legs: 90,
          hooves: 60,
        },
        gait_ratings: {
          walk: 70,
          trot: 75,
          canter: 80,
          gallop: 85,
          gaiting: null,
        },
      });
      expect(response.body.horse.genotype).toEqual({
        E_Extension: 'E/e',
        A_Agouti: 'A/a',
        Cr_Cream: 'n/n',
      });
      expect(response.body.horse.phenotypic_markings).toEqual({
        face: 'star',
        legs: { LF: 'sock', RF: 'none', LH: 'none', RH: 'none' },
      });

      // Verify database insertion
      const horseResult = await pool.query('SELECT * FROM horses WHERE name = $1', ['Test Horse']);
      expect(horseResult.rows.length).toBe(1);
      const conformationResult = await pool.query(
        'SELECT * FROM conformation_ratings WHERE horse_id = $1',
        [horseResult.rows[0].id]
      );
      expect(conformationResult.rows.length).toBe(1);
      const gaitResult = await pool.query('SELECT * FROM gait_ratings WHERE horse_id = $1', [
        horseResult.rows[0].id,
      ]);
      expect(gaitResult.rows.length).toBe(1);
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app).post('/api/store/purchase-horse').send({
        name: 'Test Horse',
        breed_id: testBreed.id,
        sex: 'Stallion',
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token, authorization denied');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .post('/api/store/purchase-horse')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          name: 'Test Horse',
          breed_id: testBreed.id,
          sex: 'Stallion',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token is not valid');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/store/purchase-horse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          breed_id: testBreed.id,
          sex: 'Stallion',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Name, breed_id, and sex are required.');
    });

    it('should return 400 if sex is invalid', async () => {
      const response = await request(app)
        .post('/api/store/purchase-horse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Horse',
          breed_id: testBreed.id,
          sex: 'Invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Sex must be "Stallion" or "Mare" for store purchase.');
    });

    it('should return 404 if breed is not found', async () => {
      const response = await request(app)
        .post('/api/store/purchase-horse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Horse',
          breed_id: 999,
          sex: 'Stallion',
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Breed not found.');
    });

    it('should return 500 if breed is missing rating_profiles', async () => {
      // Insert breed without rating_profiles
      const breedResult = await pool.query(
        `INSERT INTO breeds (
          name,
          default_trait,
          breed_genetic_profile
        ) VALUES ($1, $2, $3) RETURNING id`,
        [
          'Invalid Breed',
          'Endurance',
          {
            allele_weights: { E_Extension: { 'E/e': 0.5, 'e/e': 0.5 } },
            temperament_weights: { Calm: 50 },
            boolean_modifiers_prevalence: { overo: 0.1 },
          },
        ]
      );
      const invalidBreedId = breedResult.rows[0].id;

      const response = await request(app)
        .post('/api/store/purchase-horse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Horse',
          breed_id: invalidBreedId,
          sex: 'Stallion',
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        'Configuration error: Breed Invalid Breed is missing rating profiles.'
      );
    });

    it('should return 500 if breed is missing temperament_weights', async () => {
      // Insert breed without temperament_weights
      const breedResult = await pool.query(
        `INSERT INTO breeds (
          name,
          default_trait,
          breed_genetic_profile
        ) VALUES ($1, $2, $3) RETURNING id`,
        [
          'Invalid Breed',
          'Endurance',
          {
            allele_weights: { E_Extension: { 'E/e': 0.5, 'e/e': 0.5 } },
            rating_profiles: {
              conformation: { head: { mean: 75, std_dev: 10 } },
              gaits: { walk: { mean: 70, std_dev: 10 } },
            },
            boolean_modifiers_prevalence: { overo: 0.1 },
          },
        ]
      );
      const invalidBreedId = breedResult.rows[0].id;

      const response = await request(app)
        .post('/api/store/purchase-horse')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Horse',
          breed_id: invalidBreedId,
          sex: 'Stallion',
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        'Configuration error: Breed Invalid Breed is missing temperament weights.'
      );
    });
  });
});
