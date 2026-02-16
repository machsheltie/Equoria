/**
 * Groom Marketplace Service
 * Handles the generation and management of available grooms for hire
 *
 * Features:
 * - Generate random grooms with varying quality and rarity
 * - Marketplace refresh mechanics (daily/weekly)
 * - Quality distribution system
 * - Pricing based on skill level and experience
 * - Availability tracking
 */

import crypto from 'crypto';

// Marketplace configuration
export const MARKETPLACE_CONFIG = {
  // Marketplace size and refresh
  DEFAULT_MARKETPLACE_SIZE: 12,
  MAX_MARKETPLACE_SIZE: 20,
  MIN_MARKETPLACE_SIZE: 6,

  // Refresh timing (in hours)
  REFRESH_INTERVAL_HOURS: process.env.NODE_ENV === 'test' ? 0.00278 : 24, // 10 seconds for tests (balances stability vs testability), daily for production
  PREMIUM_REFRESH_COST: 100, // Cost for manual refresh

  // Quality distribution (percentages)
  QUALITY_DISTRIBUTION: {
    novice: 40,     // 40% novice grooms
    intermediate: 35, // 35% intermediate grooms
    expert: 20,     // 20% expert grooms
    master: 5,       // 5% master grooms
  },

  // Specialty distribution
  SPECIALTY_DISTRIBUTION: {
    general: 40,    // 40% general grooms
    foalCare: 25,   // 25% foal care specialists
    training: 20,   // 20% training specialists
    medical: 15,     // 15% medical specialists
  },

  // Experience ranges by skill level
  EXPERIENCE_RANGES: {
    novice: { min: 1, max: 3 },
    intermediate: { min: 3, max: 8 },
    expert: { min: 8, max: 15 },
    master: { min: 15, max: 20 },
  },

  // Base session rates by skill level (before experience modifier)
  BASE_SESSION_RATES: {
    novice: 15,
    intermediate: 25,
    expert: 40,
    master: 60,
  },
};

// Available personalities for grooms
const PERSONALITIES = ['gentle', 'energetic', 'patient', 'strict'];

// Available specialties
const _SPECIALTIES = ['general', 'foalCare', 'training', 'medical'];

// Available skill levels
const _SKILL_LEVELS = ['novice', 'intermediate', 'expert', 'master'];

/**
 * Generate a random groom for the marketplace
 * @returns {Object} Generated groom data
 */
export function generateRandomGroom() {
  // Select skill level based on distribution
  const skillLevel = selectByDistribution(MARKETPLACE_CONFIG.QUALITY_DISTRIBUTION);

  // Select specialty based on distribution
  const specialty = selectByDistribution(MARKETPLACE_CONFIG.SPECIALTY_DISTRIBUTION);

  // Generate experience within skill level range
  const experienceRange = MARKETPLACE_CONFIG.EXPERIENCE_RANGES[skillLevel];
  const experience = Math.floor(Math.random() * (experienceRange.max - experienceRange.min + 1)) + experienceRange.min;

  // Select random personality
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

  // Calculate session rate
  const baseRate = MARKETPLACE_CONFIG.BASE_SESSION_RATES[skillLevel];
  const experienceModifier = 1 + (experience - experienceRange.min) * 0.1; // 10% per year above minimum
  const sessionRate = Math.round(baseRate * experienceModifier);

  // Generate random name
  const firstName = generateRandomName();
  const lastName = generateRandomLastName();

  // Generate bio
  const bio = generateRandomBio(firstName, skillLevel, specialty, experience);

  return {
    firstName,
    lastName,
    specialty,
    skillLevel,
    personality,
    experience,
    sessionRate,
    bio,
    availability: true,
    marketplaceId: generateMarketplaceId(),
  };
}

/**
 * Select item based on percentage distribution
 * @param {Object} distribution - Object with items and their percentages
 * @returns {string} Selected item
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

  // Fallback to first item
  return Object.keys(distribution)[0];
}

/**
 * Generate random first name
 * @returns {string} Random first name
 */
function generateRandomName() {
  const names = [
    'Alex', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Avery', 'Quinn', 'Sage',
    'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper', 'Hayden',
    'Jamie', 'Kendall', 'Logan', 'Parker', 'Peyton', 'Reese', 'River',
    'Rowan', 'Skyler', 'Taylor', 'Tatum', 'Drew', 'Ellis', 'Emerson',
    'Gray', 'Kai', 'Lane', 'Marlowe', 'Phoenix', 'Remy', 'Shay',
  ];

  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Generate random last name
 * @returns {string} Random last name
 */
function generateRandomLastName() {
  const lastNames = [
    'Anderson', 'Brooks', 'Carter', 'Davis', 'Evans', 'Foster', 'Garcia',
    'Harris', 'Johnson', 'Kelly', 'Lewis', 'Miller', 'Nelson', 'Parker',
    'Roberts', 'Smith', 'Taylor', 'Turner', 'Walker', 'Wilson', 'Young',
    'Adams', 'Baker', 'Clark', 'Cooper', 'Edwards', 'Fisher', 'Green',
    'Hall', 'Hill', 'King', 'Lee', 'Moore', 'Phillips', 'Reed', 'Scott',
  ];

  return lastNames[Math.floor(Math.random() * lastNames.length)];
}

/**
 * Generate random bio for groom
 * @param {string} firstName - Groom's first name
 * @param {string} skillLevel - Groom's skill level
 * @param {string} specialty - Groom's specialty
 * @param {number} experience - Years of experience
 * @returns {string} Generated bio
 */
function generateRandomBio(firstName, skillLevel, specialty, experience) {
  const bioTemplates = {
    novice: [
      `${firstName} is new to professional horse care but shows great enthusiasm and dedication.`,
      `Fresh out of training, ${firstName} is eager to learn and grow in the equestrian field.`,
      `${firstName} brings a fresh perspective and boundless energy to horse care.`,
    ],
    intermediate: [
      `With ${experience} years of experience, ${firstName} has developed solid skills in horse care.`,
      `${firstName} has been working with horses for ${experience} years and continues to improve.`,
      `An experienced groom, ${firstName} handles daily care routines with confidence.`,
    ],
    expert: [
      `${firstName} is a highly skilled professional with ${experience} years of specialized experience.`,
      `With extensive experience spanning ${experience} years, ${firstName} excels in advanced horse care.`,
      `${firstName} brings expert-level knowledge and ${experience} years of proven results.`,
    ],
    master: [
      `A true master of the craft, ${firstName} has ${experience} years of exceptional experience.`,
      `${firstName} is a renowned expert with ${experience} years of outstanding achievements.`,
      `With ${experience} years of mastery, ${firstName} represents the pinnacle of professional horse care.`,
    ],
  };

  const specialtyAddons = {
    foalCare: ' Specializes in the delicate care of young foals and their developmental needs.',
    training: ' Expert in training support and exercise routines for competitive horses.',
    medical: ' Skilled in health monitoring and basic medical care procedures.',
    general: ' Provides comprehensive general care for horses of all ages.',
  };

  const templates = bioTemplates[skillLevel];
  const baseTemplate = templates[Math.floor(Math.random() * templates.length)];
  const specialtyAddon = specialtyAddons[specialty];

  return baseTemplate + specialtyAddon;
}

/**
 * Generate unique marketplace ID
 * @returns {string} Unique marketplace ID
 */
function generateMarketplaceId() {
  // Use crypto.randomUUID if available, otherwise fallback to timestamp + random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `mkt_${crypto.randomUUID()}`;
  }

  // Fallback for environments without crypto.randomUUID
  const timestamp = Date.now();
  const random1 = Math.floor(Math.random() * 1000000);
  const random2 = Math.floor(Math.random() * 1000000);
  return `mkt_${timestamp}_${random1}_${random2}`;
}

/**
 * Generate marketplace of available grooms
 * @param {number} size - Number of grooms to generate
 * @returns {Array} Array of generated grooms
 */
export function generateMarketplace(size = MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE) {
  const marketplace = [];

  for (let i = 0; i < size; i++) {
    marketplace.push(generateRandomGroom());
  }

  return marketplace;
}

/**
 * Check if marketplace needs refresh
 * @param {Date} lastRefresh - Last refresh timestamp
 * @returns {boolean} True if refresh is needed
 */
export function needsRefresh(lastRefresh) {
  if (!lastRefresh) { return true; }

  const now = new Date();
  const timeDiff = now - new Date(lastRefresh);
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  return hoursDiff >= MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS;
}

/**
 * Calculate refresh cost for premium refresh
 * @param {Date} lastRefresh - Last refresh timestamp
 * @returns {number} Cost for premium refresh (0 if free refresh available)
 */
export function getRefreshCost(lastRefresh) {
  if (needsRefresh(lastRefresh)) {
    return 0; // Free refresh available
  }

  return MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST;
}
