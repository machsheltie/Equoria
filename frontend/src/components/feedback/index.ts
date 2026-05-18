/**
 * Feedback Components
 *
 * Components for displaying user feedback and notifications:
 * - BalanceUpdateIndicator: Animated balance counter with overlay
 * - XpGainedBadge: XP gained notification badge
 * - XpGainNotification: Compact XP gain notification with progress bar
 * - LevelUpCelebrationModal: Full-screen celebration modal for horse level ups
 * - RewardToast: Toast notification for prizes/rewards (NOT an Epic 5 deliverable —
 *   created as part of a future epic (Epic 30-3) and used by Epic 5 in place of the
 *   originally specced CompetitionSuccessToast)
 *
 * Story 5-3: Balance Update Indicators - Task 4
 * Story 5-4: XP Gain Notification - Task 1
 * Story 5-4: Level-Up Celebration Modal - Task 2
 */

export { default as BalanceUpdateIndicator } from './BalanceUpdateIndicator';
export type { BalanceUpdateIndicatorProps } from './BalanceUpdateIndicator';

export { default as XpGainedBadge } from './XpGainedBadge';
export type { XpGainedBadgeProps, XpBadgePosition } from './XpGainedBadge';

export { default as XpGainNotification } from './XpGainNotification';
export type { XpGainNotificationProps } from './XpGainNotification';

export { default as LevelUpCelebrationModal } from './LevelUpCelebrationModal';
export type { LevelUpCelebrationModalProps, StatChange } from './LevelUpCelebrationModal';

// RewardToast (Spec 11.3.10) + its trigger layer (Equoria-vcar). Previously
// orphaned — now exported and wired via RewardToastProvider (mounted in App).
export { default as RewardToast } from './RewardToast';
export type { RewardToastProps, RewardType } from './RewardToast';

export { default as RewardToastProvider, useRewardToast } from './RewardToastProvider';
export type { RewardNotification } from './RewardToastProvider';
