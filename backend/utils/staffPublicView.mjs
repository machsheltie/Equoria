/**
 * What a player's browser receives about a groom, rider or trainer (Equoria-no441).
 *
 * Owner rulings 2026-10-28 q164/q165: the data the game sends carries authored
 * words, not stored codes, and nothing a player could use to find loopholes.
 *
 * - Every staff row and marketplace offer carries `skillLevelLabel`,
 *   `personalityLabel` and `specialityLabel` beside the stored values. The
 *   stored values stay because the screens use them as keys (filters, the
 *   badge look-ups, the hire request), never as text.
 * - Rows and offers are copied through an allow-list, so a column or offer
 *   field the screens never read (a trainer's undiscovered traits, a groom's
 *   hidden influence and perk tables, a rider's start age) and any hidden field
 *   added later stays on the server.
 *
 * The words match frontend/src/lib/staffLabels.ts.
 */

import { isValidDiscipline } from '../constants/schema.mjs';

const skillLevelLabels = Object.freeze({
  novice: 'Novice',
  intermediate: 'Intermediate',
  expert: 'Expert',
  master: 'Master',
  rookie: 'Rookie',
  developing: 'Developing',
  experienced: 'Experienced',
});

const personalityLabels = Object.freeze({
  gentle: 'Gentle',
  energetic: 'Energetic',
  patient: 'Patient',
  strict: 'Strict',
  confident: 'Confident',
  calm: 'Calm',
  daring: 'Daring',
  methodical: 'Methodical',
  intuitive: 'Intuitive',
  competitive: 'Competitive',
  focused: 'Focused',
  encouraging: 'Encouraging',
  technical: 'Technical',
});

const groomSpecialityLabels = Object.freeze({
  foalCare: 'Foal Care',
  general: 'Everyday Care',
  training: 'Training Support',
  medical: 'Medical Care',
});

function lookup(map, value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  // Some older rows store a capitalised word ('Calm'); one spelling finds its label.
  const key = value.trim();
  if (Object.hasOwn(map, key)) {
    return map[key];
  }
  const lower = key.toLowerCase();
  return Object.hasOwn(map, lower) ? map[lower] : fallback;
}

/** A staff member's skill level as a word; an unknown value reads "Unrated". */
export function staffSkillLevelLabel(skillLevel) {
  return lookup(skillLevelLabels, skillLevel, 'Unrated');
}

/** A staff member's personality as a word; an unknown value reads "Hard to Read". */
export function staffPersonalityLabel(personality) {
  return lookup(personalityLabels, personality, 'Hard to Read');
}

/**
 * A staff member's speciality as words. A groom's is a kind of care; a rider's
 * or trainer's is a discipline, already stored by its name.
 *
 * @param {'groom'|'rider'|'trainer'} kind
 * @param {string} speciality
 */
export function staffSpecialityLabel(kind, speciality) {
  if (kind === 'groom') {
    return lookup(groomSpecialityLabels, speciality, 'Everyday Care');
  }
  return typeof speciality === 'string' && isValidDiscipline(speciality)
    ? speciality
    : 'Another Discipline';
}

/** The three labels for one row or offer. A groom offer spells it `specialty`. */
export function staffLabels(kind, row) {
  return {
    skillLevelLabel: staffSkillLevelLabel(row?.skillLevel),
    personalityLabel: staffPersonalityLabel(row?.personality),
    specialityLabel: staffSpecialityLabel(kind, row?.speciality ?? row?.specialty),
  };
}

const sharedFields = [
  'id',
  'name',
  'firstName',
  'lastName',
  'skillLevel',
  'starLevel',
  'personality',
  'speciality',
  'specialty',
  'experience',
  'bio',
  'imageUrl',
  'userId',
  'retired',
  'isActive',
  'availability',
  'feeUnpaidSince',
  'createdAt',
  'updatedAt',
  'hiredDate',
  'careerWeeks',
  'ageYears',
  'assignments',
  'assignedHorseId',
  'marketplaceId',
];

/** Per kind, every field a screen reads from a hired row or an offer. */
const allowedFields = Object.freeze({
  groom: new Set([...sharedFields, 'sessionRate', 'weeklyFee']),
  rider: new Set([
    ...sharedFields,
    'weeklyRate',
    'totalWins',
    'totalCompetitions',
    'prestige',
  ]),
  trainer: new Set([...sharedFields, 'sessionRate']),
});

/**
 * A hired staff row or a marketplace offer as the player receives it: only the
 * allowed fields, plus the authored labels.
 *
 * @param {'groom'|'rider'|'trainer'} kind
 * @param {Object} row
 * @returns {Object}
 */
export function publicStaffRow(kind, row) {
  const allowed = allowedFields[kind];
  if (!allowed) {
    throw new Error(`publicStaffRow: unknown staff kind ${kind}`);
  }
  const out = {};
  for (const [key, value] of Object.entries(row ?? {})) {
    if (allowed.has(key)) {
      out[key] = value;
    }
  }
  return { ...out, ...staffLabels(kind, row) };
}
