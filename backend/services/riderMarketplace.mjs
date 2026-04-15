/**
 * Rider Marketplace Service
 * Handles generation and management of available riders for hire.
 *
 * Generates riders with personality, skill level, weekly rate, and bio.
 * Mirrors the Groom marketplace pattern (groomMarketplace.mjs).
 */

import crypto from 'crypto';

// Marketplace configuration
export const RIDER_MARKETPLACE_CONFIG = {
  DEFAULT_MARKETPLACE_SIZE: 6,
  REFRESH_INTERVAL_HOURS: process.env.NODE_ENV === 'test' ? 0.00278 : 24,
  PREMIUM_REFRESH_COST: 50,

  // Weekly rate ranges by skill level
  WEEKLY_RATE_RANGES: {
    rookie: { min: 150, max: 300 },
    developing: { min: 300, max: 500 },
    experienced: { min: 500, max: 800 },
  },

  // Skill level distribution (percentages)
  SKILL_DISTRIBUTION: {
    rookie: 45,
    developing: 40,
    experienced: 15,
  },

  // Discipline specialties distribution
  SPECIALTY_DISTRIBUTION: {
    Dressage: 20,
    'Show Jumping': 20,
    'Cross-Country': 15,
    Racing: 15,
    'Western Pleasure': 15,
    Endurance: 15,
  },
};

const PERSONALITIES = ['daring', 'methodical', 'intuitive', 'competitive'];

/**
 * Select a value based on percentage distribution.
 * @param {Object} distribution - { key: percentage }
 * @returns {string}
 */
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
    'Hall',
    'Hill',
    'King',
    'Lee',
    'Moore',
    'Phillips',
    'Reed',
    'Scott',
  ];
  return lastNames[Math.floor(Math.random() * lastNames.length)];
}

function generateBio(firstName, skillLevel, specialty) {
  const bios = {
    rookie: [
      `${firstName} is new to competitive riding but brings natural talent and enthusiasm.`,
      `Fresh from training, ${firstName} is eager to prove themselves on the circuit.`,
    ],
    developing: [
      `${firstName} has competed for several seasons and excels in ${specialty}.`,
      `A seasoned amateur, ${firstName} is ready to take their career to the next level.`,
    ],
    experienced: [
      `${firstName} is a proven professional with multiple ${specialty} titles to their name.`,
      `One of the most respected riders on the circuit, ${firstName} brings championship experience.`,
    ],
  };
  const options = bios[skillLevel];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate a random marketplace rider entry.
 * @returns {Object} Marketplace rider data
 */
export function generateRandomRider() {
  const skillLevel = selectByDistribution(RIDER_MARKETPLACE_CONFIG.SKILL_DISTRIBUTION);
  const specialty = selectByDistribution(RIDER_MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION);
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const { min, max } = RIDER_MARKETPLACE_CONFIG.WEEKLY_RATE_RANGES[skillLevel];
  const weeklyRate = Math.floor(Math.random() * (max - min + 1)) + min;
  const experience =
    skillLevel === 'rookie'
      ? 0
      : skillLevel === 'developing'
        ? Math.floor(Math.random() * 50)
        : Math.floor(Math.random() * 100) + 50;
  const firstName = generateFirstName();
  const lastName = generateLastName();

  // Experienced riders reveal one affinity hint
  const knownAffinities = skillLevel === 'experienced' ? [specialty] : [];

  return {
    marketplaceId: `mkt_rider_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`,
    firstName,
    lastName,
    skillLevel,
    personality,
    speciality: specialty,
    weeklyRate,
    experience,
    bio: generateBio(firstName, skillLevel, specialty),
    availability: true,
    knownAffinities,
  };
}

function generateStarterRider() {
  const firstName = generateFirstName();
  const specialty = 'Dressage';

  return {
    marketplaceId: `mkt_rider_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`,
    firstName,
    lastName: generateLastName(),
    skillLevel: 'rookie',
    personality: 'methodical',
    speciality: specialty,
    weeklyRate: RIDER_MARKETPLACE_CONFIG.WEEKLY_RATE_RANGES.rookie.min,
    experience: 0,
    bio: generateBio(firstName, 'rookie', specialty),
    availability: true,
    knownAffinities: [],
  };
}

/**
 * Generate a full marketplace of riders.
 * @param {number} size - Number of riders to generate
 * @returns {Array}
 */
export function generateRiderMarketplace(size = RIDER_MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE) {
  const marketplace = [generateStarterRider()];
  for (let i = 1; i < size; i++) {
    marketplace.push(generateRandomRider());
  }
  return marketplace;
}

/**
 * Check if marketplace needs refresh.
 * @param {Date|null} lastRefresh
 * @returns {boolean}
 */
export function riderMarketplaceNeedsRefresh(lastRefresh) {
  if (!lastRefresh) {
    return true;
  }
  const hoursDiff = (Date.now() - new Date(lastRefresh).getTime()) / (1000 * 60 * 60);
  return hoursDiff >= RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS;
}

/**
 * Calculate refresh cost (0 if free window is open).
 * @param {Date|null} lastRefresh
 * @returns {number}
 */
export function getRiderRefreshCost(lastRefresh) {
  return riderMarketplaceNeedsRefresh(lastRefresh)
    ? 0
    : RIDER_MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST;
}
