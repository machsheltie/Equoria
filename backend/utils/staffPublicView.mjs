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
 * - A trainer's speciality is a secret until the trainer is an Expert (owner
 *   ruling 2026-10-29, q278, Equoria-45u5g): below Expert the row carries no
 *   speciality, no speciality label, and a bio with the speciality taken out.
 * - A rider has no old skill word and no speciality (owner rulings 2026-10-29,
 *   q282/q283): its star level is its only level, so a rider row or offer carries
 *   neither, nor their labels, even an offer stored before the ruling.
 *
 * The words match frontend/src/lib/staffLabels.ts.
 */

import { isValidDiscipline } from '../constants/schema.mjs';

// Trainers' and grooms' old skill words (riders' were retired, q282).
const skillLevelLabels = Object.freeze({
  novice: 'Novice',
  intermediate: 'Intermediate',
  expert: 'Expert',
  master: 'Master',
  developing: 'Developing',
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

/**
 * The labels for one row or offer. A groom offer spells it `specialty`. A rider has
 * only its personality label (q282/q283).
 */
export function staffLabels(kind, row) {
  if (kind === 'rider') {
    return { personalityLabel: staffPersonalityLabel(row?.personality) };
  }
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
  // q282/q283: no skill word and no speciality for a rider.
  rider: new Set(
    [...sharedFields, 'weeklyRate', 'totalWins', 'totalCompetitions', 'prestige'].filter(
      field => !['skillLevel', 'speciality', 'specialty'].includes(field),
    ),
  ),
  trainer: new Set([...sharedFields, 'sessionRate']),
});

/**
 * Whether a trainer's speciality may be shown: only at Expert (q278). A row or offer
 * without a star level is treated as below Expert.
 *
 * @param {{ starLevel?: string }} row
 * @returns {boolean}
 */
export function trainerSpecialityKnown(row) {
  return row?.starLevel === 'expert';
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A below-Expert trainer's bio with its speciality taken out (q278). The game's bios
 * name it as "in / to / focusing on <discipline>"; those words go. A bio that still
 * names the speciality after that is withheld (null) rather than leak it.
 *
 * @param {string|null|undefined} bio
 * @param {string|null|undefined} speciality
 * @returns {string|null|undefined}
 */
export function trainerBioWithoutSpeciality(bio, speciality) {
  if (typeof bio !== 'string' || typeof speciality !== 'string' || speciality.trim() === '') {
    return bio;
  }
  const name = escapeRegExp(speciality.trim());
  const stripped = bio.replace(new RegExp(`\\s+(?:in|to|focusing on)\\s+${name}\\b`, 'gi'), '');
  return new RegExp(`\\b${name}\\b`, 'i').test(stripped) ? null : stripped;
}

/**
 * A hired staff row or a marketplace offer as the player receives it: only the
 * allowed fields, plus the authored labels. A trainer below Expert carries no
 * speciality (q278).
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
  const labels = staffLabels(kind, row);
  if (kind === 'trainer' && !trainerSpecialityKnown(row)) {
    delete out.speciality;
    delete out.specialty;
    delete labels.specialityLabel;
    if (Object.hasOwn(out, 'bio')) {
      out.bio = trainerBioWithoutSpeciality(out.bio, row.speciality ?? row.specialty);
    }
  }
  return { ...out, ...labels };
}
