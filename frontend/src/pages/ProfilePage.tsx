/**
 * Profile Page — Celestial Night design
 *
 * Allows users to view and edit their profile information.
 * Uses Zod validation and the dark Celestial Night visual style.
 *
 * Story 2.1: Profile Management - AC-1 through AC-6
 *
 * Design-system migration (Equoria-o5hub.22):
 * - PageHero → PageHeader (operational/management page, no location artwork).
 * - Local max-w-md/px-* wrapper → PageContainer variant="narrow" (DECISIONS §1;
 *   gutters belong to the DashboardLayout shell).
 * - One mega glass-panel containing nested cards → per-section Surface panels;
 *   the subtle wrappers around RankHistoryChart and ActivityFeed were removed
 *   because those components (and StatisticsCard) render their own framed
 *   items — wrapping them was card-in-card.
 * - Loading → PageLoading; error → ErrorState with a real retry (refetch).
 * - celestial-input × 2 → canonical Input/Textarea + FormField (validation
 *   timing, name attrs, autocomplete, maxLength, and counter preserved —
 *   the e2e contract in tests/e2e/profile-edit.spec.ts depends on them).
 * - Balance → canonical Currency (variant="balance").
 * - Page-local copyright footer removed — the DashboardLayout shell owns the
 *   app footer; the duplicate was an auth-layout leftover.
 */

import React, { useState, useEffect } from 'react';
import { User, FileText, Save, X } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { PageLoading, ErrorState } from '@/components/ui/state';
import Currency from '@/components/ui/Currency';
import { Input, Textarea, FormField } from '@/components/ui/form';
import XPLevelDisplay from '../components/XPLevelDisplay';
import StatisticsCard from '../components/StatisticsCard';
import ActivityFeed from '../components/ActivityFeed';
import { StatisticType } from '../lib/statistics-utils';
import { ActivityType, type Activity } from '../lib/activity-utils';
import { profileSchema, type ProfileFormData } from '../lib/validation-schemas';
import { VALIDATION_RULES, UI_TEXT } from '../lib/constants';
import { useProfile, useUpdateProfile } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useActivityFeed, useUserProgress } from '../hooks/api/useUserProgress';
import { useRankHistory } from '../hooks/api/useRankHistory';
import RankHistoryChart from '@/components/leaderboard/RankHistoryChart';

const ProfilePage: React.FC = () => {
  const { data: profileData, isLoading, isError, refetch } = useProfile();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const userId = profileData?.user?.id ?? 0;
  const {
    data: activityItems = [],
    isLoading: isActivityLoading,
    isError: isActivityError,
    error: activityError,
  } = useActivityFeed(userId);
  const { data: progressData, isLoading: isProgressLoading } = useUserProgress(userId);

  // Rank-history time-series for the trend chart (Equoria-l332). The backend
  // endpoint is ownership-enforced, so we only ever request the signed-in
  // user's own id (a UUID string, distinct from the numeric `userId` above).
  const rankUserId = profileData?.user?.id ? String(profileData.user.id) : '';
  const {
    data: rankHistory,
    isLoading: isRankHistoryLoading,
    isError: isRankHistoryError,
    error: rankHistoryError,
  } = useRankHistory({ userId: rankUserId, enabled: rankUserId.length > 0 });

  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    bio: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profileData?.user) {
      setFormData({
        username: profileData.user.username || '',
        bio: profileData.user.bio || '',
      });
    }
  }, [profileData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = profileSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      return;
    }
    updateProfile(result.data);
  };

  const handleCancel = () => {
    if (profileData?.user) {
      setFormData({
        username: profileData.user.username || '',
        bio: profileData.user.bio || '',
      });
    }
    setValidationErrors({});
  };

  const bioCharactersRemaining = VALIDATION_RULES.bio.maxLength - (formData.bio?.length || 0);
  const activities: Activity[] = activityItems.map((activity) => {
    const type = Object.values(ActivityType).includes(activity.type as ActivityType)
      ? (activity.type as ActivityType)
      : ActivityType.ACHIEVEMENT;
    return {
      id: String(activity.id),
      type,
      timestamp: activity.timestamp,
      data: activity.metadata ?? {},
    };
  });

  const breedingCount =
    typeof (progressData as { breedingCount?: number } | undefined)?.breedingCount === 'number'
      ? (progressData as { breedingCount?: number }).breedingCount
      : 0;
  const winRate =
    typeof (progressData as { winRate?: number } | undefined)?.winRate === 'number'
      ? (progressData as { winRate?: number }).winRate
      : 0;

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading) {
    return <PageLoading label="Loading profile…" />;
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <ErrorState
        severity="page"
        title="Could not load profile"
        message="Failed to load profile. Please try again."
        retry={{ label: 'Try Again', onClick: () => refetch() }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <PageContainer variant="narrow" padded={false} className="pb-8">
        <PageHeader
          title={UI_TEXT.profile.title}
          subtitle="View and edit your profile information"
          icon={<User className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />}
          className="mb-6"
        />

        <div className="space-y-5">
          {/* Identity panel: avatar, email, XP, balance */}
          <Surface variant="panel" className="space-y-5" data-testid="profile-identity-panel">
            {/* Avatar + subtitle */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center magical-glow"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
                  }}
                >
                  <User className="w-8 h-8 text-role-inverse" />
                </div>
              </div>
              <p className="text-xs text-role-secondary">{UI_TEXT.profile.subtitle}</p>
            </div>

            {/* Success and error feedback handled via toast notifications (AC-5, AC-6) */}

            {/* Email (read-only) */}
            <Surface variant="subtle" className="px-3 py-2" data-testid="profile-email-row">
              <p className="type-label mb-0.5">Email</p>
              <p className="text-sm text-role-primary break-words">{profileData?.user?.email}</p>
            </Surface>

            {/* XP & Level */}
            <Surface variant="subtle" className="px-3 py-2" data-testid="profile-xp-row">
              <XPLevelDisplay
                xp={profileData?.user?.xp}
                level={profileData?.user?.level}
                size="md"
              />
            </Surface>

            {/* Currency — canonical Currency component (DECISIONS §9) */}
            <Surface
              variant="subtle"
              className="px-3 py-2 flex items-center justify-between gap-3"
              data-testid="profile-balance-row"
            >
              <span className="type-label">Balance</span>
              <Currency
                amount={
                  typeof profileData?.user?.money === 'number' ? profileData.user.money : Number.NaN
                }
                variant="balance"
              />
            </Surface>
          </Surface>

          {/* Statistics — StatisticsCard renders its own framed card, so the
              grid sits on the page band (no wrapping panel = no card-in-card) */}
          <section className="space-y-2" aria-label="Game statistics">
            <h2 className="type-label">Game Statistics</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatisticsCard
                value={progressData?.totalHorses ?? 0}
                label="Horses Owned"
                type={StatisticType.HORSES_OWNED}
                size="sm"
                isLoading={isProgressLoading}
              />
              <StatisticsCard
                value={progressData?.totalCompetitions ?? 0}
                label="Competitions Won"
                type={StatisticType.COMPETITIONS_WON}
                size="sm"
                isLoading={isProgressLoading}
              />
              <StatisticsCard
                value={breedingCount}
                label="Breeding Count"
                type={StatisticType.BREEDING_COUNT}
                size="sm"
                isLoading={isProgressLoading}
              />
              <StatisticsCard
                value={winRate}
                label="Win Rate"
                type={StatisticType.WIN_RATE}
                size="sm"
                isLoading={isProgressLoading}
              />
            </div>
          </section>

          {/* Rank History Trend (Equoria-l332) — single panel frame; the chart
              itself is unframed */}
          <Surface variant="panel" className="space-y-2" data-testid="profile-rank-history-panel">
            <h2 className="type-label">Rank History</h2>
            <RankHistoryChart
              series={rankHistory?.series ?? []}
              isLoading={isRankHistoryLoading}
              errorMessage={
                isRankHistoryError
                  ? rankHistoryError?.message || 'Failed to load rank history'
                  : undefined
              }
            />
          </Surface>

          {/* Activity Feed — items render their own cards; no extra frame */}
          <section aria-label="Recent activity">
            <ActivityFeed
              activities={activities}
              title="Recent Activity"
              maxItems={3}
              showViewAll
              size="sm"
              isLoading={isActivityLoading}
              emptyMessage={
                isActivityError
                  ? activityError?.message || 'Failed to load activity feed'
                  : undefined
              }
            />
          </section>

          {/* Edit form */}
          <Surface variant="panel" data-testid="profile-edit-panel">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Display Name */}
              <FormField
                label={UI_TEXT.profile.displayNameLabel}
                htmlFor="username"
                error={validationErrors.username}
              >
                {(fieldProps) => (
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-role-muted pointer-events-none" />
                    <Input
                      {...fieldProps}
                      name="username"
                      type="text"
                      placeholder={UI_TEXT.profile.displayNamePlaceholder}
                      value={formData.username}
                      onChange={handleChange}
                      autoComplete="username"
                      className="pl-10"
                    />
                  </div>
                )}
              </FormField>

              {/* Bio */}
              <div className="space-y-1">
                <FormField
                  label={UI_TEXT.profile.bioLabel}
                  htmlFor="bio"
                  error={validationErrors.bio}
                >
                  {(fieldProps) => (
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-3 w-4 h-4 text-role-muted pointer-events-none" />
                      <Textarea
                        {...fieldProps}
                        name="bio"
                        placeholder={UI_TEXT.profile.bioPlaceholder}
                        value={formData.bio || ''}
                        onChange={handleChange}
                        maxLength={VALIDATION_RULES.bio.maxLength}
                        rows={4}
                        className="pl-10 min-h-[100px]"
                      />
                    </div>
                  )}
                </FormField>
                <p className="text-xs text-role-secondary text-right">
                  {UI_TEXT.profile.charactersRemaining(bioCharactersRemaining)}
                </p>
              </div>

              {/* Action buttons — one gold primary (Save); Cancel is secondary */}
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  <X className="w-4 h-4" />
                  {UI_TEXT.profile.cancelButton}
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  pending={isPending}
                  disabled={Object.keys(validationErrors).length > 0}
                >
                  <Save className="w-4 h-4" />
                  {UI_TEXT.profile.saveButton}
                </Button>
              </div>
            </form>
          </Surface>
        </div>
      </PageContainer>
    </div>
  );
};

export default ProfilePage;
