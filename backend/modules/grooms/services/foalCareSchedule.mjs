/**
 * The foal care schedule: one table for a foal's first 21 days of life
 * (Equoria-gveno, owner ruling 2026-10-26, q70).
 *
 * The owner ruled that foals follow the bible's day bands (Vol 09: days 1-2,
 * 3-4 and 5-6 of the first week) stretched over every day a horse is a foal,
 * with each band offering its own activities. The groom does the activity the
 * player picks when she presses "groom horse" (owner rulings 2026-10-14 and
 * 2026-10-20). Nothing here runs on its own.
 *
 * Days of life: the birth day is day 1. A horse is a foal while its game age is
 * under 3, so day 21 is the last foal day and the horse is grown the next day.
 *
 * Activities come from the bible's age 0, 1 and 2 lists. Ids are stored on the
 * groom interaction; labels are what players see (players never see ids, owner
 * ruling 2026-10-23).
 */

import { getHorseAgeDays } from '../../../utils/horseAge.mjs';

/** Last day of life on which a horse is still a foal. */
export const lastFoalDay = 21;

const activityLabels = Object.freeze({
  gentleTouch: 'Gentle Touch and Brushing',
  trustBuilding: 'Trust Building',
  halterIntroduction: 'Halter Introduction',
  leading: 'Leading',
  tyingPractice: 'Tying',
  hoofHandling: 'Hoof Handling',
  desensitization: 'Desensitization',
  stableExposure: 'Stable Life',
  confidenceWalk: 'Confidence Walk',
  showgroundExposure: 'Showground Walk-Along',
  mannersWeaning: 'Manners and Weaning Preparation',
  noiseDesensitization: 'Saddle Pad and Noise Work',
  environmentExploration: 'New Surroundings',
  advancedGrooming: 'Grooming and Braiding',
  confinedSpaceTrust: 'Confined-Space Trust Work',
  tackDesensitization: 'Tack Introduction',
  groupCalmness: 'Group Calmness',
  showgroundWalkAlong: 'Showground Walk-Along',
});

const band = (id, label, firstDay, lastDay, activityIds) =>
  Object.freeze({ id, label, firstDay, lastDay, activityIds: Object.freeze(activityIds) });

/** The bands in day order. Together they cover days 1..21 with no gap or overlap. */
export const foalCareBands = Object.freeze([
  band('imprintingTrust', 'Imprinting and Trust', 1, 2, [
    'gentleTouch',
    'trustBuilding',
    'halterIntroduction',
  ]),
  band('socialEnvironment', 'Socialization and Environment', 3, 4, [
    'leading',
    'tyingPractice',
    'hoofHandling',
    'desensitization',
    'stableExposure',
  ]),
  band('confidenceManners', 'Confidence, Manners and Weaning Readiness', 5, 7, [
    'confidenceWalk',
    'showgroundExposure',
    'mannersWeaning',
    'noiseDesensitization',
  ]),
  band('handlingTrust', 'Handling and Trust', 8, 9, ['trustBuilding', 'leading', 'hoofHandling']),
  band('steadiness', 'Steadiness', 10, 11, [
    'tyingPractice',
    'desensitization',
    'environmentExploration',
  ]),
  band('growingConfidence', 'Growing Confidence', 12, 14, ['confidenceWalk', 'showgroundExposure']),
  band('presentation', 'Presentation', 15, 16, ['advancedGrooming', 'confinedSpaceTrust']),
  band('tackAndCompany', 'Tack and Company', 17, 18, ['tackDesensitization', 'groupCalmness']),
  band('showgroundReady', 'Showground Ready', 19, 21, [
    'showgroundWalkAlong',
    'tackDesensitization',
  ]),
]);

/**
 * The authored label for an activity id, or null when the id is not a care
 * activity.
 * @param {string} activityId
 * @returns {string|null}
 */
export function foalActivityLabel(activityId) {
  return Object.hasOwn(activityLabels, activityId) ? activityLabels[activityId] : null;
}

/**
 * A horse's day of life on the Eastern game clock (birth day = 1), or null once
 * it is grown (past day 21).
 * @param {Date|string|null} dateOfBirth
 * @param {Date} [now]
 * @returns {number|null}
 */
export function foalCareDay(dateOfBirth, now = new Date()) {
  const day = getHorseAgeDays(dateOfBirth, now) + 1;
  return day <= lastFoalDay ? day : null;
}

/**
 * The band for a day of life, or null outside days 1..21.
 * @param {number|null} day
 */
export function foalCareBandForDay(day) {
  if (!Number.isInteger(day)) {
    return null;
  }
  return foalCareBands.find(b => day >= b.firstDay && day <= b.lastDay) ?? null;
}

/**
 * Today's care for a foal: the day, its band and the activities on offer, with
 * labels. Null for a grown horse.
 * @param {Date|string|null} dateOfBirth
 * @param {Date} [now]
 * @returns {{day:number, band:{id:string,label:string,firstDay:number,lastDay:number},
 *   activities:Array<{id:string,label:string}>}|null}
 */
export function foalCareToday(dateOfBirth, now = new Date()) {
  const day = foalCareDay(dateOfBirth, now);
  const current = foalCareBandForDay(day);
  if (!current) {
    return null;
  }
  return {
    day,
    band: {
      id: current.id,
      label: current.label,
      firstDay: current.firstDay,
      lastDay: current.lastDay,
    },
    activities: current.activityIds.map(id => ({ id, label: activityLabels[id] })),
  };
}
