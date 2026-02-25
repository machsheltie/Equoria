/**
 * Profile Page — Celestial Night design
 *
 * Allows users to view and edit their profile information.
 * Uses Zod validation and the dark Celestial Night visual style.
 *
 * Story 2.1: Profile Management - AC-1 through AC-6
 */

import React, { useState, useEffect } from 'react';
import { User, FileText, Save, X } from 'lucide-react';
import XPLevelDisplay from '../components/XPLevelDisplay';
import CurrencyDisplay from '../components/CurrencyDisplay';
import StatisticsCard from '../components/StatisticsCard';
import ActivityFeed from '../components/ActivityFeed';
import { StatisticType } from '../lib/statistics-utils';
import { ActivityType, type Activity } from '../lib/activity-utils';
import { profileSchema, type ProfileFormData } from '../lib/validation-schemas';
import { VALIDATION_RULES, UI_TEXT, SUCCESS_MESSAGES } from '../lib/constants';
import { useProfile, useUpdateProfile } from '../hooks/useAuth';
import { useActivityFeed, useUserProgress } from '../hooks/api/useUserProgress';

const ProfilePage: React.FC = () => {
  const { data: profileData, isLoading, isError, error: profileError } = useProfile();
  const {
    mutate: updateProfile,
    isPending,
    isSuccess,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateProfile();
  const userId = profileData?.user?.id ?? 0;
  const {
    data: activityItems = [],
    isLoading: isActivityLoading,
    isError: isActivityError,
    error: activityError,
  } = useActivityFeed(userId);
  const { data: progressData, isLoading: isProgressLoading } = useUserProgress(userId);

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto"
            style={{
              borderColor: 'var(--border-default)',
              borderTopColor: 'var(--celestial-primary)',
            }}
          />
          <p className="text-sm text-[rgb(148,163,184)]">Loading profile…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-panel px-6 py-5 max-w-md text-center">
          <p className="text-red-400 text-sm">
            {profileError?.message || 'Failed to load profile. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="relative border-b flex items-center justify-center p-4"
        style={{ borderColor: 'var(--border-default)', background: 'var(--glass-surface-bg)' }}
      >
        <h1 className="fantasy-title text-2xl tracking-widest">{UI_TEXT.profile.title}</h1>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-md space-y-5">
          {/* Profile card */}
          <div className="glass-panel px-6 py-6 space-y-5">
            {/* Avatar + subtitle */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center magical-glow"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--electric-blue-500) 0%, var(--electric-blue-700) 100%)',
                  }}
                >
                  <User className="w-8 h-8 text-white" />
                </div>
              </div>
              <p className="text-xs text-[rgb(148,163,184)]">{UI_TEXT.profile.subtitle}</p>
            </div>

            {/* Success */}
            {isSuccess && (
              <p className="text-sm text-center" style={{ color: 'var(--celestial-primary)' }}>
                {SUCCESS_MESSAGES.profile.updated}
              </p>
            )}

            {/* API error */}
            {isUpdateError && (
              <p className="text-red-400 text-sm text-center">
                {updateError?.message || 'Failed to update profile. Please try again.'}
              </p>
            )}

            {/* Email (read-only) */}
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.2)',
              }}
            >
              <p className="text-xs text-[rgb(148,163,184)] uppercase tracking-wider mb-0.5">
                Email
              </p>
              <p className="text-sm text-[rgb(220,235,255)]">{profileData?.user?.email}</p>
            </div>

            {/* XP & Level */}
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.2)',
              }}
            >
              <XPLevelDisplay
                xp={profileData?.user?.xp}
                level={profileData?.user?.level}
                size="md"
              />
            </div>

            {/* Currency */}
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.2)',
              }}
            >
              <CurrencyDisplay
                amount={profileData?.user?.money}
                label="Balance"
                size="md"
                isLoading={isLoading}
              />
            </div>

            {/* Statistics */}
            <div className="space-y-2">
              <p className="text-xs text-[rgb(148,163,184)] uppercase tracking-wider">
                Game Statistics
              </p>
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
            </div>

            {/* Activity Feed */}
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.2)',
              }}
            >
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
            </div>

            {/* Edit form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Display Name */}
              <div className="space-y-1">
                <label
                  htmlFor="username"
                  className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
                >
                  {UI_TEXT.profile.displayNameLabel}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder={UI_TEXT.profile.displayNamePlaceholder}
                    value={formData.username}
                    onChange={handleChange}
                    autoComplete="username"
                    className="celestial-input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
                {validationErrors.username && (
                  <p className="text-red-400 text-xs">{validationErrors.username}</p>
                )}
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label
                  htmlFor="bio"
                  className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
                >
                  {UI_TEXT.profile.bioLabel}
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
                  <textarea
                    id="bio"
                    name="bio"
                    placeholder={UI_TEXT.profile.bioPlaceholder}
                    value={formData.bio || ''}
                    onChange={handleChange}
                    maxLength={VALIDATION_RULES.bio.maxLength}
                    rows={4}
                    className="celestial-input min-h-[100px] resize-vertical"
                    style={{ paddingLeft: '2.5rem', paddingTop: '0.625rem' }}
                  />
                </div>
                <p className="text-xs text-[rgb(148,163,184)] text-right">
                  {UI_TEXT.profile.charactersRemaining(bioCharactersRemaining)}
                </p>
                {validationErrors.bio && (
                  <p className="text-red-400 text-xs">{validationErrors.bio}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  className="btn-outline-celestial flex-1 inline-flex items-center justify-center gap-2"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  <X className="w-4 h-4" />
                  {UI_TEXT.profile.cancelButton}
                </button>
                <button
                  type="submit"
                  className="btn-cobalt flex-1 inline-flex items-center justify-center gap-2"
                  disabled={isPending}
                >
                  <Save className="w-4 h-4" />
                  {isPending ? UI_TEXT.profile.savingButton : UI_TEXT.profile.saveButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center border-t" style={{ borderColor: 'var(--border-muted)' }}>
        <p className="text-xs text-[rgb(100,130,165)]">&copy; 2025 Equoria. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ProfilePage;
