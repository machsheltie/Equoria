/**
 * Trainer Marketplace Service
 * Handles generation of available trainers for hire.
 *
 * Trainers: 5 personalities (focused/encouraging/technical/competitive/patient),
 * 3 skill levels (novice/developing/expert) and a star level; the session rate is the
 * star level's price (owner ruling 2026-10-28, Equoria-nawn5; backend/constants/staffLevels.mjs).
 */

import crypto from 'crypto';
import { DISCIPLINE_VALUES } from '../../../constants/schema.mjs';
import { drawStaffLevel, staffLevelFee, staffSkillOdds } from '../../../constants/staffLevels.mjs';

export const TRAINER_MARKETPLACE_CONFIG = {
  DEFAULT_MARKETPLACE_SIZE: 6,
  REFRESH_INTERVAL_HOURS: 24,
  PREMIUM_REFRESH_COST: 50,

  // Skill level distribution. Owner ruling 2026-10-28 (Equoria-nawn5): these odds, and
  // the session price (the star level's), live with the star levels in
  // backend/constants/staffLevels.mjs.
  SKILL_DISTRIBUTION: staffSkillOdds('trainer'),

  // Discipline specialties: an even pick across every competition discipline
  // (owner ruling 2026-10-21), so a new discipline appears without an edit here.
  SPECIALTIES: DISCIPLINE_VALUES,
};

const PERSONALITIES = ['focused', 'encouraging', 'technical', 'competitive', 'patient'];

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

// Owner ruling 2026-10-29 (q278, Equoria-45u5g): a trainer's speciality is a secret
// until Expert, so only the expert bios name it. (Every expert-tier trainer is an
// Expert on the star scale; the old tiers below it never are.)
function generateBio(firstName, skillLevel, specialty) {
  const bios = {
    novice: [
      `${firstName} is a newer trainer building their reputation.`,
      `Enthusiastic and dedicated, ${firstName} brings fresh training methods.`,
    ],
    developing: [
      `${firstName} has several years of training experience.`,
      `A reliable trainer, ${firstName} has helped many horses improve.`,
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
  const { skillLevel, starLevel } = drawStaffLevel('trainer');
  const { SPECIALTIES } = TRAINER_MARKETPLACE_CONFIG;
  const specialty = SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const sessionRate = staffLevelFee(starLevel);
  const firstName = generateFirstName();
  const lastName = generateLastName();

  return {
    marketplaceId: `mkt_trainer_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`,
    firstName,
    lastName,
    skillLevel,
    starLevel,
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
    starLevel: 'rookie',
    personality: 'patient',
    speciality: specialty,
    sessionRate: staffLevelFee('rookie'),
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
