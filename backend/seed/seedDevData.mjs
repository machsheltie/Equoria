/**
 * seedDevData.mjs — Seeds development database with users, breeds, horses, and shows
 * for local frontend testing. Idempotent — skips existing records.
 *
 * Usage: node backend/seed/seedDevData.mjs
 */

import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

// ── Breed data ──────────────────────────────────────────────────────────────

// Canonical 12 breeds — must match CANONICAL_BREEDS in breedGeneticProfiles.mjs
const BREEDS = [
  {
    name: 'Thoroughbred',
    description: 'Athletic and versatile racing breed known for speed and stamina',
  },
  {
    name: 'Arabian',
    description: 'Ancient breed prized for endurance, intelligence, and refinement',
  },
  {
    name: 'American Saddlebred',
    description: 'Elegant five-gaited show horse with high-stepping action',
  },
  {
    name: 'National Show Horse',
    description: 'Arabian-Saddlebred cross combining showiness and sensitivity',
  },
  {
    name: 'Pony Of The Americas',
    description: 'Gentle, versatile pony breed ideal for youth riders',
  },
  { name: 'Appaloosa', description: 'Versatile breed known for distinctive spotted coat patterns' },
  {
    name: 'Tennessee Walking Horse',
    description: 'Smooth-gaited breed famous for comfortable trail riding',
  },
  { name: 'Andalusian', description: 'Noble Iberian breed excelling in classical dressage' },
  {
    name: 'American Quarter Horse',
    description: 'Steady, versatile breed dominating western disciplines',
  },
  {
    name: 'Walkaloosa',
    description: 'Gaited Appaloosa cross combining spotted patterns with smooth gait',
  },
  {
    name: 'Lusitano',
    description: 'Courageous Iberian breed known for agility and classical movements',
  },
  { name: 'Paint Horse', description: 'Colorful stock horse breed excelling in western events' },
];

// ── User data ───────────────────────────────────────────────────────────────

const USERS = [
  {
    username: 'player1',
    email: 'player1@equoria.test',
    password: 'Password123!',
    firstName: 'Alex',
    lastName: 'Morgan',
    money: 5000,
    level: 3,
    xp: 450,
    settings: { completedOnboarding: true, onboardingStep: 10 },
  },
  {
    username: 'player2',
    email: 'player2@equoria.test',
    password: 'Password123!',
    firstName: 'Emma',
    lastName: 'Clarke',
    money: 3200,
    level: 2,
    xp: 200,
    settings: { completedOnboarding: true, onboardingStep: 10 },
  },
  {
    username: 'newplayer',
    email: 'newplayer@equoria.test',
    password: 'Password123!',
    firstName: 'Sam',
    lastName: 'Rivera',
    money: 1000,
    level: 1,
    xp: 0,
    settings: { completedOnboarding: false, onboardingStep: 0 },
  },
];

// ── Horse data (assigned to users after creation) ───────────────────────────

function randomStat(min = 20, max = 80) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function yearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

const HORSES = [
  // player1's horses
  {
    name: 'Midnight Star',
    sex: 'Mare',
    age: 5,
    breed: 'Thoroughbred',
    userIdx: 0,
    trait: 'Speed Demon',
  },
  {
    name: 'Golden Thunder',
    sex: 'Stallion',
    age: 4,
    breed: 'Arabian',
    userIdx: 0,
    trait: 'Iron Will',
  },
  {
    name: 'Silver Mist',
    sex: 'Mare',
    age: 3,
    breed: 'American Saddlebred',
    userIdx: 0,
    trait: 'Quick Learner',
  },
  {
    name: 'Eclipse',
    sex: 'Stallion',
    age: 6,
    breed: 'Lusitano',
    userIdx: 0,
    trait: 'Gentle Giant',
  },
  // player2's horses
  {
    name: 'Copper Rose',
    sex: 'Mare',
    age: 4,
    breed: 'Andalusian',
    userIdx: 1,
    trait: 'Show Stopper',
  },
  {
    name: 'Storm Chaser',
    sex: 'Stallion',
    age: 5,
    breed: 'Paint Horse',
    userIdx: 1,
    trait: 'Speed Demon',
  },
  { name: 'Daisy Belle', sex: 'Mare', age: 2, breed: 'Appaloosa', userIdx: 1, trait: null },
  // newplayer's starter horse
  {
    name: 'Lucky Clover',
    sex: 'Gelding',
    age: 3,
    breed: 'American Quarter Horse',
    userIdx: 2,
    trait: null,
  },
];

// ── Show data ───────────────────────────────────────────────────────────────

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

const SHOWS = [
  {
    name: 'Spring Dressage Classic',
    discipline: 'Dressage',
    levelMin: 1,
    levelMax: 5,
    entryFee: 100,
    prize: 500,
    runDate: futureDate(3),
  },
  {
    name: 'Moonlight Jump Cup',
    discipline: 'Show Jumping',
    levelMin: 1,
    levelMax: 10,
    entryFee: 200,
    prize: 1000,
    runDate: futureDate(5),
  },
  {
    name: 'Celestial Cross-Country',
    discipline: 'Cross-Country',
    levelMin: 2,
    levelMax: 8,
    entryFee: 150,
    prize: 750,
    runDate: futureDate(7),
  },
  {
    name: 'Starlight Endurance Trail',
    discipline: 'Endurance',
    levelMin: 1,
    levelMax: 5,
    entryFee: 100,
    prize: 600,
    runDate: futureDate(4),
  },
  {
    name: 'Western Sunset Showdown',
    discipline: 'Western Pleasure',
    levelMin: 1,
    levelMax: 5,
    entryFee: 80,
    prize: 400,
    runDate: futureDate(6),
  },
];

// ── Seed functions ──────────────────────────────────────────────────────────

async function seedBreeds() {
  console.log('Seeding breeds...');
  const created = [];
  for (const breed of BREEDS) {
    const existing = await prisma.breed.findFirst({ where: { name: breed.name } });
    if (existing) {
      console.log(`  Skip existing breed: ${breed.name}`);
      created.push(existing);
    } else {
      const b = await prisma.breed.create({ data: breed });
      console.log(`  Created breed: ${b.name} (ID: ${b.id})`);
      created.push(b);
    }
  }
  return created;
}

async function seedUsers() {
  console.log('Seeding users...');
  const created = [];
  for (const userData of USERS) {
    const existing = await prisma.user.findFirst({ where: { username: userData.username } });
    if (existing) {
      console.log(`  Skip existing user: ${userData.username}`);
      created.push(existing);
    } else {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const u = await prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          money: userData.money,
          level: userData.level,
          xp: userData.xp,
          settings: userData.settings,
          emailVerified: true,
        },
      });
      console.log(`  Created user: ${u.username} (ID: ${u.id})`);
      created.push(u);
    }
  }
  return created;
}

async function seedHorses(users, breeds) {
  console.log('Seeding horses...');
  const breedMap = {};
  for (const b of breeds) {
    breedMap[b.name] = b.id;
  }

  for (const horseData of HORSES) {
    const existing = await prisma.horse.findFirst({ where: { name: horseData.name } });
    if (existing) {
      console.log(`  Skip existing horse: ${horseData.name}`);
      continue;
    }

    const owner = users[horseData.userIdx];
    const h = await prisma.horse.create({
      data: {
        name: horseData.name,
        sex: horseData.sex,
        dateOfBirth: yearsAgo(horseData.age),
        breedId: breedMap[horseData.breed] ?? null,
        userId: owner.id,
        trait: horseData.trait,
        age: horseData.age,
        // Randomized stats
        speed: randomStat(),
        stamina: randomStat(),
        agility: randomStat(),
        endurance: randomStat(),
        precision: randomStat(),
        strength: randomStat(),
        intelligence: randomStat(),
        balance: randomStat(),
        boldness: randomStat(),
        flexibility: randomStat(),
        obedience: randomStat(),
        focus: randomStat(),
        coordination: randomStat(),
        // Defaults
        healthStatus: 'Excellent',
        bondScore: randomStat(10, 60),
        totalEarnings: horseData.userIdx === 2 ? 0 : randomStat(0, 2000),
        horseXp: horseData.userIdx === 2 ? 0 : randomStat(0, 500),
        currentFeed: 'basic',
        energyLevel: 100,
        lastFedDate: new Date(),
        lastVettedDate: new Date(),
      },
    });
    console.log(`  Created horse: ${h.name} (ID: ${h.id}) → owner: ${owner.username}`);
  }
}

async function seedShows() {
  console.log('Seeding shows...');
  for (const showData of SHOWS) {
    const existing = await prisma.show.findFirst({ where: { name: showData.name } });
    if (existing) {
      console.log(`  Skip existing show: ${showData.name}`);
      continue;
    }
    const s = await prisma.show.create({ data: showData });
    console.log(`  Created show: ${s.name} (ID: ${s.id})`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Equoria Dev Data Seed ===\n');

  try {
    const breeds = await seedBreeds();
    const users = await seedUsers();
    await seedHorses(users, breeds);
    await seedShows();

    console.log('\n=== Seed complete! ===');
    console.log('\nTest accounts (password: Password123!):');
    console.log('  player1@equoria.test  — 4 horses, level 3');
    console.log('  player2@equoria.test  — 3 horses, level 2');
    console.log('  newplayer@equoria.test — 1 horse, new player (onboarding)');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
