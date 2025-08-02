/**
 * Trait Assignment Logic Utility
 * 
 * Utility for calculating trait assignment probabilities with groom bonus effects.
 * This module integrates with the groom bonus trait system to apply probability
 * modifiers when conditions are met (bond > 60, 75% coverage).
 * 
 * Features:
 * - Calculate trait probability with groom bonuses
 * - Validate bonus application conditions
 * - Integration with milestone evaluation system
 * - Support for randomized trait assignment
 * 
 * Business Rules:
 * - Bonuses only apply to randomized traits (not guaranteed traits)
 * - Requires bond score > 60
 * - Requires 75% assignment window coverage
 * - Maximum 30% bonus per trait
 * - Bonuses are additive to base probability
 */

import { getBonusTraits, checkBonusEligibility } from '../services/groomBonusTraitService.mjs';
import logger from '../utils/logger.mjs';

/**
 * Calculate trait probability with potential groom bonus effects
 * @param {number} horseId - ID of the horse
 * @param {string} traitName - Name of the trait being evaluated
 * @param {number} baseProbability - Base probability for the trait (0.0 to 1.0)
 * @param {number} groomId - ID of the assigned groom (optional)
 * @returns {Object} Probability calculation result with bonus details
 */
export async function calculateTraitProbabilityWithBonus(horseId, traitName, baseProbability, groomId = null) {
  try {
    logger.info(`[traitAssignmentLogic.calculateTraitProbabilityWithBonus] Calculating probability for trait '${traitName}' on horse ${horseId}`);

    // Initialize result with base values
    const result = {
      horseId,
      traitName,
      baseProbability,
      finalProbability: baseProbability,
      bonusApplied: false,
      bonusAmount: 0,
      groomId,
      reason: 'No groom assigned',
    };

    // If no groom assigned, return base probability
    if (!groomId) {
      logger.info(`[traitAssignmentLogic.calculateTraitProbabilityWithBonus] No groom assigned, using base probability ${baseProbability}`);
      return result;
    }

    // Get groom bonus traits
    const bonusTraits = await getBonusTraits(groomId);
    
    // Check if groom has bonus for this trait
    if (!bonusTraits[traitName]) {
      result.reason = 'Groom has no bonus for this trait';
      logger.info(`[traitAssignmentLogic.calculateTraitProbabilityWithBonus] Groom ${groomId} has no bonus for trait '${traitName}'`);
      return result;
    }

    // Check if groom qualifies for bonus application
    const eligibility = await checkBonusEligibility(horseId, groomId);
    
    if (!eligibility.eligible) {
      result.reason = eligibility.reason;
      result.eligibilityDetails = {
        averageBondScore: eligibility.averageBondScore,
        coveragePercentage: eligibility.coveragePercentage,
        milestoneWindowDays: eligibility.milestoneWindowDays,
      };
      logger.info(`[traitAssignmentLogic.calculateTraitProbabilityWithBonus] Groom ${groomId} not eligible for bonus: ${eligibility.reason}`);
      return result;
    }

    // Apply bonus
    const bonusAmount = bonusTraits[traitName];
    const finalProbability = Math.min(1.0, baseProbability + bonusAmount); // Cap at 100%

    result.finalProbability = finalProbability;
    result.bonusApplied = true;
    result.bonusAmount = bonusAmount;
    result.reason = 'Bonus applied successfully';
    result.eligibilityDetails = {
      averageBondScore: eligibility.averageBondScore,
      coveragePercentage: eligibility.coveragePercentage,
      milestoneWindowDays: eligibility.milestoneWindowDays,
    };

    logger.info(`[traitAssignmentLogic.calculateTraitProbabilityWithBonus] Applied ${bonusAmount * 100}% bonus to trait '${traitName}' for horse ${horseId}`);

    return result;
  } catch (error) {
    logger.error(`[traitAssignmentLogic.calculateTraitProbabilityWithBonus] Error calculating trait probability: ${error.message}`);
    throw error;
  }
}

/**
 * Apply groom bonuses to a list of trait candidates
 * @param {number} horseId - ID of the horse
 * @param {Array} traitCandidates - Array of trait objects with name and baseProbability
 * @param {number} groomId - ID of the assigned groom (optional)
 * @returns {Array} Array of trait candidates with updated probabilities
 */
export async function applyGroomBonusesToTraitCandidates(horseId, traitCandidates, groomId = null) {
  try {
    logger.info(`[traitAssignmentLogic.applyGroomBonusesToTraitCandidates] Applying groom bonuses to ${traitCandidates.length} trait candidates for horse ${horseId}`);

    if (!groomId) {
      logger.info(`[traitAssignmentLogic.applyGroomBonusesToTraitCandidates] No groom assigned, returning original probabilities`);
      return traitCandidates.map(candidate => ({
        ...candidate,
        finalProbability: candidate.baseProbability,
        bonusApplied: false,
        bonusAmount: 0,
      }));
    }

    // Get groom bonus traits once
    const bonusTraits = await getBonusTraits(groomId);
    
    // Check eligibility once
    const eligibility = await checkBonusEligibility(horseId, groomId);

    // Apply bonuses to each candidate
    const updatedCandidates = traitCandidates.map(candidate => {
      const hasBonus = bonusTraits[candidate.name];
      const canApplyBonus = hasBonus && eligibility.eligible;
      
      const bonusAmount = canApplyBonus ? bonusTraits[candidate.name] : 0;
      const finalProbability = canApplyBonus 
        ? Math.min(1.0, candidate.baseProbability + bonusAmount)
        : candidate.baseProbability;

      return {
        ...candidate,
        finalProbability,
        bonusApplied: canApplyBonus,
        bonusAmount,
        groomId,
        eligibilityDetails: eligibility,
      };
    });

    const bonusesApplied = updatedCandidates.filter(c => c.bonusApplied).length;
    logger.info(`[traitAssignmentLogic.applyGroomBonusesToTraitCandidates] Applied bonuses to ${bonusesApplied} out of ${traitCandidates.length} trait candidates`);

    return updatedCandidates;
  } catch (error) {
    logger.error(`[traitAssignmentLogic.applyGroomBonusesToTraitCandidates] Error applying groom bonuses: ${error.message}`);
    throw error;
  }
}

/**
 * Perform randomized trait selection with groom bonuses
 * @param {number} horseId - ID of the horse
 * @param {Array} traitCandidates - Array of trait objects with name and baseProbability
 * @param {number} groomId - ID of the assigned groom (optional)
 * @param {number} maxTraits - Maximum number of traits to select (default: 1)
 * @returns {Object} Selection result with selected traits and details
 */
export async function selectTraitsWithGroomBonuses(horseId, traitCandidates, groomId = null, maxTraits = 1) {
  try {
    logger.info(`[traitAssignmentLogic.selectTraitsWithGroomBonuses] Selecting up to ${maxTraits} traits for horse ${horseId}`);

    // Apply groom bonuses to candidates
    const candidatesWithBonuses = await applyGroomBonusesToTraitCandidates(horseId, traitCandidates, groomId);

    // Perform randomized selection
    const selectedTraits = [];
    const selectionDetails = [];

    for (const candidate of candidatesWithBonuses) {
      if (selectedTraits.length >= maxTraits) break;

      const randomValue = Math.random();
      const selected = randomValue < candidate.finalProbability;

      selectionDetails.push({
        traitName: candidate.name,
        baseProbability: candidate.baseProbability,
        finalProbability: candidate.finalProbability,
        bonusApplied: candidate.bonusApplied,
        bonusAmount: candidate.bonusAmount,
        randomValue,
        selected,
      });

      if (selected) {
        selectedTraits.push({
          name: candidate.name,
          source: 'randomized_with_groom_bonus',
          probability: candidate.finalProbability,
          bonusApplied: candidate.bonusApplied,
          bonusAmount: candidate.bonusAmount,
          groomId,
        });
      }
    }

    const result = {
      horseId,
      groomId,
      selectedTraits,
      selectionDetails,
      totalCandidates: traitCandidates.length,
      bonusesApplied: candidatesWithBonuses.filter(c => c.bonusApplied).length,
      traitsSelected: selectedTraits.length,
    };

    logger.info(`[traitAssignmentLogic.selectTraitsWithGroomBonuses] Selected ${selectedTraits.length} traits for horse ${horseId}`);

    return result;
  } catch (error) {
    logger.error(`[traitAssignmentLogic.selectTraitsWithGroomBonuses] Error selecting traits: ${error.message}`);
    throw error;
  }
}

/**
 * Get trait assignment summary for a horse-groom combination
 * @param {number} horseId - ID of the horse
 * @param {number} groomId - ID of the groom
 * @returns {Object} Summary of potential trait bonuses and eligibility
 */
export async function getTraitAssignmentSummary(horseId, groomId) {
  try {
    logger.info(`[traitAssignmentLogic.getTraitAssignmentSummary] Getting trait assignment summary for horse ${horseId} and groom ${groomId}`);

    const bonusTraits = await getBonusTraits(groomId);
    const eligibility = await checkBonusEligibility(horseId, groomId);

    const summary = {
      horseId,
      groomId,
      bonusTraits,
      eligibility,
      potentialBonuses: Object.keys(bonusTraits).length,
      canApplyBonuses: eligibility.eligible,
      summary: eligibility.eligible
        ? `Groom can apply bonuses to ${Object.keys(bonusTraits).length} traits`
        : `Groom cannot apply bonuses: ${eligibility.reason}`,
    };

    logger.info(`[traitAssignmentLogic.getTraitAssignmentSummary] Generated summary for horse ${horseId} and groom ${groomId}`);

    return summary;
  } catch (error) {
    logger.error(`[traitAssignmentLogic.getTraitAssignmentSummary] Error generating summary: ${error.message}`);
    throw error;
  }
}
