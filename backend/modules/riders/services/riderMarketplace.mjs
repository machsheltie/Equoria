/**
 * Rider Marketplace Service
 * Handles generation and management of available riders for hire.
 *
 * Generates riders with personality, star level, weekly rate, and bio. A rider has no
 * old skill word and no visible speciality (owner rulings 2026-10-29, q282/q283): the
 * star level is its only level, and disciplines are learned only through growth.
 * Every new rider is a Rookie (owner rulings 2026-10-28, q160/q177, Equoria-xlw03): it
 * earns its higher stars by shows, and its hidden modifiers are drawn when it is hired
 * (backend/services/staffGrowthService.mjs), so an offer carries none. The weekly rate is
 * the star level's price (Equoria-nawn5; backend/constants/staffLevels.mjs).
 * Mirrors the Groom marketplace pattern (groomMarketplace.mjs).
 */

import crypto from 'crypto';
import { staffLevelFee } from '../../../constants/staffLevels.mjs';
import { drawRiderStartAge } from './riderRetirementScheduleService.mjs';

// Marketplace configuration
export const RIDER_MARKETPLACE_CONFIG = {
  DEFAULT_MARKETPLACE_SIZE: 6,
  REFRESH_INTERVAL_HOURS: 24,
  PREMIUM_REFRESH_COST: 50,
};

const PERSONALITIES = ['daring', 'methodical', 'intuitive', 'competitive'];

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

// Every new rider is a Rookie, so every bio is a newcomer's, and none names a discipline
// (q283: disciplines are learned through growth).
function generateBio(firstName) {
  const bios = [
    `${firstName} is new to competitive riding but brings natural talent and enthusiasm.`,
    `Fresh from training, ${firstName} is eager to prove themselves on the circuit.`,
  ];
  return bios[Math.floor(Math.random() * bios.length)];
}

/**
 * Generate a random marketplace rider entry.
 * @returns {Object} Marketplace rider data
 */
export function generateRandomRider() {
  // The star level is always Rookie (q160); staff earn no XP, so experience starts at 0.
  const starLevel = 'rookie';
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const weeklyRate = staffLevelFee(starLevel);
  const experience = 0;
  const firstName = generateFirstName();
  const lastName = generateLastName();

  return {
    marketplaceId: `mkt_rider_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`,
    firstName,
    lastName,
    starLevel,
    personality,
    weeklyRate,
    experience,
    bio: generateBio(firstName),
    // Owner ruling 2026-10-23 (Equoria-or2ua): a random age of 18-25.
    startAge: drawRiderStartAge(),
    availability: true,
  };
}

function generateStarterRider() {
  const firstName = generateFirstName();

  return {
    marketplaceId: `mkt_rider_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`,
    firstName,
    lastName: generateLastName(),
    starLevel: 'rookie',
    personality: 'methodical',
    weeklyRate: staffLevelFee('rookie'),
    experience: 0,
    bio: generateBio(firstName),
    startAge: drawRiderStartAge(),
    availability: true,
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
