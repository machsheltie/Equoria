/**
 * Outage time-back: every DateTime field in the schema, classified
 * (Equoria-puj1e.5, docs/features/admin-time-back.md "Rulebook", invariant 7).
 *
 * Generated from the 2026-10-06 owner-approved code survey and re-checked
 * against the schema on 2026-11-18. Every DateTime field in the schema belongs
 * in exactly one of these lists: when a new DateTime column ships, decide
 * whether an outage gives its time back and add it here.
 *
 * - pastEvent (rule 1): an anchor whose elapsed time drives play. Moved by the
 *   pause; a value inside the window lands on the window's end.
 * - pendingDeadline (rule 2): a future unlock or close time. Moved only when
 *   it was still ahead at the outage start; nothing already finished re-locks.
 * - neverMoved (rule 4): security, accounting, records, history displays,
 *   scheduling and housekeeping. Never touched.
 * - unruled: added to the schema after the owner's survey and not yet ruled on.
 *   Not moved (as neverMoved) until the owner decides; the time-back preview
 *   names them so the owner can see what was left alone. Empty since owner
 *   ruling q383 (2026-11-18): hunger, rider unpaid-fee and free-agent time,
 *   rider retirement notices, Hall of Fame voting rounds and a foal's final
 *   development day get the time back like every other game clock.
 *
 * Rule 3 (job counters) moves integers, not DateTime fields; see
 * timeBackRules.mjs.
 */

export const pastEventFields = Object.freeze([
  'Horse.dateOfBirth',
  'Horse.lastBredDate',
  'Horse.inFoalSinceDate',
  'Horse.lastVettedDate',
  'Horse.lastGroomed',
  'Horse.lastShod',
  'Horse.lastFedDate',
  'TrainingLog.trainedAt',
  'GroomAssignment.createdAt',
  'GroomAssignment.startDate',
  'GroomInteraction.timestamp',
  'GroomInteraction.createdAt',
  'StaffMarketplaceState.lastRefresh',
  // Owner ruling q383 (2026-11-18).
  'Horse.hungerSince',
  'Rider.freeAgentSince',
  'RiderRetirementSchedule.noticeSentAt',
  'FoalDevelopment.finalDayEvaluatedAt',
]);

export const pendingDeadlineFields = Object.freeze([
  'Horse.trainingCooldown',
  'Show.closeDate',
  'Show.runDate',
  'ClubElection.startsAt',
  'ClubElection.endsAt',
  'Groom.feeUnpaidSince',
  // Owner ruling q383 (2026-11-18).
  'Rider.feeUnpaidSince',
  'HallOfFameRound.startsAt',
  'HallOfFameRound.endsAt',
]);

export const unruledFields = Object.freeze([]);

export const neverMovedFields = Object.freeze([
  'User.passwordChangedAt',
  'User.dateOfBirth',
  'User.groomSalaryGracePeriod',
  'User.emailVerifiedAt',
  'User.createdAt',
  'User.updatedAt',
  'Notification.createdAt',
  'Horse.createdAt',
  'Horse.updatedAt',
  'Groom.hiredDate',
  'Groom.retirementTimestamp',
  'Groom.createdAt',
  'Groom.updatedAt',
  'GroomRetirementSchedule.assignedAt',
  'GroomEngagement.startedAt',
  'GroomEngagement.endedAt',
  'GroomAssignment.endDate',
  'GroomAssignment.updatedAt',
  'Show.openDate',
  'Show.executedAt',
  'Show.claimedAt',
  'Show.createdAt',
  'Show.updatedAt',
  'SystemAccount.createdAt',
  'SystemAccount.updatedAt',
  'CompetitionResult.runDate',
  'CompetitionResult.createdAt',
  'CompetitionResult.viewedAt',
  'FoalDevelopment.lastInteractionAt',
  'FoalDevelopment.createdAt',
  'FoalDevelopment.updatedAt',
  'FoalActivity.createdAt',
  'FoalTrainingHistory.timestamp',
  'FoalTrainingHistory.createdAt',
  'FoalTrainingHistory.updatedAt',
  'XpEvent.timestamp',
  'RefreshToken.expiresAt',
  'RefreshToken.lastActivityAt',
  'RefreshToken.createdAt',
  'RefreshToken.updatedAt',
  'EmailVerificationToken.expiresAt',
  'EmailVerificationToken.createdAt',
  'EmailVerificationToken.usedAt',
  'PasswordResetToken.expiresAt',
  'PasswordResetToken.usedAt',
  'PasswordResetToken.createdAt',
  'UserTransaction.createdAt',
  'HorseXpEvent.timestamp',
  'GroomSalaryPayment.paymentDate',
  'GroomSalaryPayment.createdAt',
  'GroomSalaryPayment.updatedAt',
  'TraitHistoryLog.timestamp',
  'TraitHistoryLog.createdAt',
  'TraitHistoryLog.updatedAt',
  'MilestoneTraitLog.timestamp',
  'MilestoneTraitLog.createdAt',
  'MilestoneTraitLog.updatedAt',
  'GroomHorseSynergy.lastAssignedAt',
  'GroomHorseSynergy.createdAt',
  'GroomHorseSynergy.updatedAt',
  'GroomAssignmentLog.assignedAt',
  'GroomAssignmentLog.unassignedAt',
  'GroomAssignmentLog.createdAt',
  'GroomAssignmentLog.updatedAt',
  'GroomLegacyLog.createdAt',
  'Rider.createdAt',
  'Rider.updatedAt',
  'RiderGrowthProfile.createdAt',
  'RiderGrowthProfile.updatedAt',
  'GroomGrowthProfile.createdAt',
  'GroomGrowthProfile.updatedAt',
  'RiderSalaryPayment.paymentDate',
  'RiderSalaryPayment.createdAt',
  'RiderAssignment.startDate',
  'RiderAssignment.createdAt',
  'RiderAssignment.updatedAt',
  'Trainer.createdAt',
  'Trainer.updatedAt',
  'TrainerAssignment.startDate',
  'TrainerAssignment.createdAt',
  'TrainerAssignment.updatedAt',
  'Facility.lastMaintenance',
  'Facility.createdAt',
  'Facility.updatedAt',
  'FacilityUpgrade.purchaseDate',
  'ForumThread.lastActivityAt',
  'ForumThread.createdAt',
  'ForumPost.createdAt',
  // Equoria-puj1e.3 (q381/q382): word-list entries and post reports are records.
  'ForumWord.createdAt',
  'ForumReport.createdAt',
  'ForumReport.decidedAt',
  'DirectMessage.createdAt',
  'Club.createdAt',
  'ClubMembership.joinedAt',
  'ClubBallot.createdAt',
  'HorseSale.soldAt',
  'ShowEntry.createdAt',
  'CronRunLog.startedAt',
  'CronRunLog.finishedAt',
  'CronRunLog.createdAt',
  'AuditLog.createdAt',
  'DocCoverageSnapshot.capturedAt',
  'StaffActionLog.createdAt',
  'GameControl.heldAt',
  'GameControl.updatedAt',
  'TimeBack.windowStart',
  'TimeBack.windowEnd',
  'TimeBack.appliedAt',
  'TimeBack.reversedAt',
  // Equoria-puj1e.5 (Codex r2 #2/#3): the career-week record and since when it is complete.
  'StaffCareerTick.tickedAt',
  'StaffCareerTickLedger.completeSince',
  'StaffCheckinCode.expiresAt',
  'StaffCheckinCode.usedAt',
  'StaffCheckinCode.retiredAt',
  'StaffCheckinCode.createdAt',
  'StaffTrustedDevice.expiresAt',
  'StaffTrustedDevice.revokedAt',
  'StaffTrustedDevice.createdAt',
  'StaffTicket.createdAt',
  'StaffTicket.updatedAt',
  'OwnerFiling.importedAt',
  'OwnerFiling.createdAt',
  'StaffTicketReply.createdAt',
  'EmailOutbox.nextAttemptAt',
  'EmailOutbox.claimedAt',
  'EmailOutbox.sentAt',
  'EmailOutbox.createdAt',
  'EmailOutbox.updatedAt',
  'BreedingRecord.createdAt',
  'BreedingRecord.resolvedAt',
  'NewsItem.endsAt',
  'NewsItem.publishAt',
  'NewsItem.createdAt',
  'NewsItem.updatedAt',
  'ConductRecord.endsAt',
  'ConductRecord.createdAt',
  'LoginSighting.firstSeenAt',
  'LoginSighting.lastSeenAt',
  'ConductBlock.createdAt',
  'UserPresence.lastActiveAt',
  // q383 (2026-11-18): the Hall of Fame week names (00:00 Eastern Sunday) are
  // labels, not clocks: the round's voting time is startsAt/endsAt, and a
  // round's weekStart is the unique one-round-per-week key. The rider
  // retirement roll time is a record, like GroomRetirementSchedule.assignedAt.
  'HallOfFameNomination.weekStart',
  'HallOfFameRound.weekStart',
  'RiderRetirementSchedule.assignedAt',
  'HallOfFameNomination.createdAt',
  'HallOfFameRound.closedAt',
  'HallOfFameVote.createdAt',
  'HallOfFameInduction.inductedAt',
]);

/** 'Model.field' -> 'pastEvent' | 'pendingDeadline' | 'neverMoved' | 'unruled'. */
export const dateTimeClassification = Object.freeze(
  Object.fromEntries([
    ...pastEventFields.map(key => [key, 'pastEvent']),
    ...pendingDeadlineFields.map(key => [key, 'pendingDeadline']),
    ...neverMovedFields.map(key => [key, 'neverMoved']),
    ...unruledFields.map(key => [key, 'unruled']),
  ]),
);
