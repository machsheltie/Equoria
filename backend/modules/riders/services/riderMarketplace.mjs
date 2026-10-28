/**
 * Rider Marketplace Service
 * Handles generation and management of available riders for hire.
 *
 * Generates riders with personality, skill level, star level, weekly rate, and bio.
 * The weekly rate is the star level's price (owner ruling 2026-10-28, Equoria-nawn5;
 * backend/constants/staffLevels.mjs).
 * Mirrors the Groom marketplace pattern (groomMarketplace.mjs).
 */

import crypto from 'crypto';
import { DISCIPLINE_VALUES } from '../../../constants/schema.mjs';
import { drawStaffLevel, staffLevelFee, staffSkillOdds } from '../../../constants/staffLevels.mjs';
import { drawRiderStartAge } from './riderRetirementScheduleService.mjs';

// Marketplace configuration
export const RIDER_MARKETPLACE_CONFIG = {
  DEFAULT_MARKETPLACE_SIZE: 6,
  REFRESH_INTERVAL_HOURS: 24,
  PREMIUM_REFRESH_COST: 50,

  // Skill level distribution (percentages). Owner ruling 2026-10-28 (Equoria-nawn5):
  // these odds, and the weekly price (the star level's), live with the star levels in
  // backend/constants/staffLevels.mjs.
  SKILL_DISTRIBUTION: staffSkillOdds('rider'),

  // Discipline specialties: an even pick across every competition discipline
  // (owner ruling 2026-10-21), so a new discipline appears without an edit here.
  SPECIALTIES: DISCIPLINE_VALUES,
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
  const { skillLevel, starLevel } = drawStaffLevel('rider');
  const { SPECIALTIES } = RIDER_MARKETPLACE_CONFIG;
  const specialty = SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const weeklyRate = staffLevelFee(starLevel);
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
    starLevel,
    personality,
    speciality: specialty,
    weeklyRate,
    experience,
    bio: generateBio(firstName, skillLevel, specialty),
    // Owner ruling 2026-10-23 (Equoria-or2ua): a random age of 18-25.
    startAge: drawRiderStartAge(),
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
    starLevel: 'rookie',
    personality: 'methodical',
    speciality: specialty,
    weeklyRate: staffLevelFee('rookie'),
    experience: 0,
    bio: generateBio(firstName, 'rookie', specialty),
    startAge: drawRiderStartAge(),
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
