/**
 * Who is owed the one-time welcome note (Equoria-kd2dd).
 *
 * Owner ruling 2026-10-23: it greets a NEW player the first time she enters the
 * game after the three-step signup, once. That moment is exactly "the wizard is
 * finished (onboardingStep >= 1) and the guided tour has not been completed".
 *
 * The server always sends `welcomeSeen` as a boolean on the profile. Only an
 * explicit `false` counts as pending: an established player who finished
 * onboarding before the note existed is never greeted as if she were new, and a
 * profile without the field (a stale cache, a legacy payload) shows nothing
 * rather than guessing.
 */

import type { User } from '@/hooks/useAuth';

export function isWelcomePending(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    user.welcomeSeen === false &&
    user.completedOnboarding === false &&
    (user.onboardingStep ?? 0) >= 1
  );
}
