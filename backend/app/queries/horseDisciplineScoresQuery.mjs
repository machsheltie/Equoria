/**
 * A horse's Discipline Scores for the Progression section of its page
 * (Equoria-a0fim; owner request 2026-10-28).
 *
 * Each of the 24 competition disciplines, in bible order, with the horse's
 * score and the level that score sits in. The score is the nightly show
 * scorer's own flat score (competition `disciplineStandingScore`): the
 * discipline's three stats weighted 50/30/20, plus the horse's trained value in
 * that discipline, plus its saddle and bridle points, rounded x.5 up. Health,
 * temperament, rider and luck are show-day percentages and are not part of it.
 * The level is the one level table (`levelForScore`, owner ruling 2026-10-23:
 * 50-point levels to 500, then 100-point levels, top level 20).
 *
 * Application query layer: it composes the horse row with competition rules,
 * which the horses module may not import.
 */
import {
  competitionDisciplines,
  disciplineStandingScore,
} from '../../modules/competition/index.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { levelForScore } from '../../utils/competitionLogic.mjs';

/** Everything the flat score reads: the ten competition stats, training and tack. */
const scoreInputs = Object.freeze({
  speed: true,
  stamina: true,
  agility: true,
  balance: true,
  precision: true,
  intelligence: true,
  boldness: true,
  flexibility: true,
  obedience: true,
  focus: true,
  disciplineScores: true,
  tack: true,
});

/**
 * @param {number} horseId
 * @returns {Promise<Array<{ discipline: string, score: number, level: number }>|null>}
 *   null when the horse does not exist.
 */
export async function getHorseDisciplineScores(horseId) {
  const horse = await prisma.horse.findUnique({ where: { id: horseId }, select: scoreInputs });
  if (!horse) {
    return null;
  }
  return competitionDisciplines.map(discipline => {
    const score = disciplineStandingScore(horse, discipline);
    return { discipline, score, level: levelForScore(score) };
  });
}
