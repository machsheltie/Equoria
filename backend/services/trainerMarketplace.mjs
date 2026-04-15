/**
 * Trainer Marketplace Service
 * Handles generation of available trainers for hire.
 *
 * Trainers: 5 personalities (focused/encouraging/technical/competitive/patient),
 * 3 skill levels (novice/developing/expert), session rate pricing.
 */

import crypto from 'crypto';

export const TRAINER_MARKETPLACE_CONFIG = {
  DEFAULT_MARKETPLACE_SIZE: 6,
  REFRESH_INTERVAL_HOURS: process.env.NODE_ENV === 'test' ? 0.00278 : 24,
  PREMIUM_REFRESH_COST: 50,

  // Session rate ranges by skill level
  SESSION_RATE_RANGES: {
    novice: { min: 100, max: 200 },
    developing: { min: 200, max: 350 },
    expert: { min: 350, max: 600 },
  },

  // Skill level distribution
  SKILL_DISTRIBUTION: {
    novice: 45,
    developing: 40,
    expert: 15,
  },

  // Discipline specialty distribution
  SPECIALTY_DISTRIBUTION: {
    Dressage: 20,
    'Show Jumping': 20,
    'Cross-Country': 15,
    Racing: 15,
    'Western Pleasure': 15,
    Endurance: 15,
  },
};

const PERSONALITIES = ['focused', 'encouraging', 'technical', 'competitive', 'patient'];

function selectByDistribution(distribution) {
  const random = Math.random() * 100;
  let cumulative = 0;
  for (const [item, percentage] of Object.entries(distribution)) {
    cumulative += percentage;
    if (random <= cumulative) {
      return item;
    }
  }
  return Object.keys(distribution)[0];
}

function generateFirstName() {
  const names = [
    'Alex',
    'Jordan',
    'Casey',
    'Morgan',
    'Riley',
    'Avery',
    'Quinn',
    'Sage',
    'Blake',
    'Cameron',
    'Dakota',
    'Emery',
    'Finley',
    'Harper',
    'Hayden',
    'Jamie',
    'Kendall',
    'Logan',
    'Parker',
    'Peyton',
    'Reese',
    'River',
    'Rowan',
    'Skyler',
    'Taylor',
    'Drew',
    'Ellis',
    'Kai',
    'Remy',
    'Shay',
  ];
  return names[Math.floor(Math.random() * names.length)];
}

function generateLastName() {
  const lastNames = [
    'Anderson',
    'Brooks',
    'Carter',
    'Davis',
    'Evans',
    'Foster',
    'Garcia',
    'Harris',
    'Johnson',
    'Kelly',
    'Lewis',
    'Miller',
    'Nelson',
    'Parker',
    'Roberts',
    'Smith',
    'Taylor',
    'Turner',
    'Walker',
    'Wilson',
    'Young',
    'Adams',
    'Baker',
    'Clark',
    'Cooper',
    'Edwards',
    'Fisher',
    'Green',
  ];
  return lastNames[Math.floor(Math.random() * lastNames.length)];
}

function generateBio(firstName, skillLevel, specialty) {
  const bios = {
    novice: [
      `${firstName} is a newer trainer building their reputation in ${specialty}.`,
      `Enthusiastic and dedicated, ${firstName} brings fresh training methods to ${specialty}.`,
    ],
    developing: [
      `${firstName} has several years of training experience focusing on ${specialty}.`,
      `A reliable trainer, ${firstName} has helped many horses improve in ${specialty}.`,
    ],
    expert: [
      `${firstName} is a highly sought-after ${specialty} trainer with a proven track record.`,
      `Renowned in the ${specialty} community, ${firstName} has produced multiple champions.`,
    ],
  };
  const options = bios[skillLevel];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate a single random marketplace trainer.
 * @returns {Object}
 */
export function generateRandomTrainer() {
  const skillLevel = selectByDistribution(TRAINER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION);
  const specialty = selectByDistribution(TRAINER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION);
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const { min, max } = TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES[skillLevel];
  const sessionRate = Math.floor(Math.random() * (max - min + 1)) + min;
  const firstName = generateFirstName();
  const lastName = generateLastName();

  return {
    marketplaceId: `mkt_trainer_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`,
    firstName,
    lastName,
    skillLevel,
    personality,
    speciality: specialty,
    sessionRate,
    bio: generateBio(firstName, skillLevel, specialty),
    availability: true,
  };
}

function generateStarterTrainer() {
  const firstName = generateFirstName();
  const specialty = 'Dressage';

  return {
    marketplaceId: `mkt_trainer_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`,
    firstName,
    lastName: generateLastName(),
    skillLevel: 'novice',
    personality: 'patient',
    speciality: specialty,
    sessionRate: TRAINER_MARKETPLACE_CONFIG.SESSION_RATE_RANGES.novice.min,
    bio: generateBio(firstName, 'novice', specialty),
    availability: true,
  };
}

/**
 * Generate a full trainer marketplace.
 * @param {number} size
 * @returns {Array}
 */
export function generateTrainerMarketplace(
  size = TRAINER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE,
) {
  const marketplace = [generateStarterTrainer()];
  for (let i = 1; i < size; i++) {
    marketplace.push(generateRandomTrainer());
  }
  return marketplace;
}

export function trainerMarketplaceNeedsRefresh(lastRefresh) {
  if (!lastRefresh) {
    return true;
  }
  const hoursDiff = (Date.now() - new Date(lastRefresh).getTime()) / (1000 * 60 * 60);
  return hoursDiff >= TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS;
}

export function getTrainerRefreshCost(lastRefresh) {
  return trainerMarketplaceNeedsRefresh(lastRefresh)
    ? 0
    : TRAINER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST;
}
