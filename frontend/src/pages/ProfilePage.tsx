/**
 * Profile Page
 *
 * Allows users to view and edit their profile information.
 * Uses fantasy-themed components and Zod validation.
 *
 * Story 2.1: Profile Management - AC-1 through AC-6
 */

import React, { useState, useEffect } from 'react';
import { User, FileText, Save, X } from 'lucide-react';
import { FantasyInput, FantasyTextarea } from '../components/FantasyForm';
import FantasyButton from '../components/FantasyButton';
import XPLevelDisplay from '../components/XPLevelDisplay';
import CurrencyDisplay from '../components/CurrencyDisplay';
import StatisticsCard from '../components/StatisticsCard';
import ActivityFeed from '../components/ActivityFeed';
import { StatisticType } from '../lib/statistics-utils';
import { ActivityType, type Activity } from '../lib/activity-utils';
import { profileSchema, type ProfileFormData, VALIDATION_RULES, UI_TEXT, SUCCESS_MESSAGES } from '../lib/constants';
import { useProfile, useUpdateProfile } from '../hooks/useAuth';

// Mock activities for demonstration (will be replaced with API data)
const mockActivities: Activity[] = [
  {
    id: '1',
    type: ActivityType.TRAINING,
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    data: { horseName: 'Thunder', skill: 'Speed', level: 5 },
  },
  {
    id: '2',
    type: ActivityType.COMPETITION,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    data: { horseName: 'Storm', competitionName: 'Spring Derby', placement: 1 },
  },
  {
    id: '3',
    type: ActivityType.BREEDING,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    data: { horseName: 'Lightning', foalName: 'Spark' },
  },
  {
    id: '4',
    type: ActivityType.ACHIEVEMENT,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    data: { achievementName: 'First Victory' },
  },
  {
    id: '5',
    type: ActivityType.LEVEL_UP,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    data: { newLevel: 10 },
  },
];

const ProfilePage: React.FC = () => {
  const { data: profileData, isLoading, isError, error: profileError } = useProfile();
  const { mutate: updateProfile, isPending, isSuccess, isError: isUpdateError, error: updateError } = useUpdateProfile();

  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    bio: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize form with user data
  useEffect(() => {
    if (profileData?.user) {
      setFormData({
        username: profileData.user.username || '',
        bio: profileData.user.bio || '',
      });
    }
  }, [profileData]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
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

    // Submit to API
    updateProfile(result.data);
  };

  // Handle cancel - reset form to original values
  const handleCancel = () => {
    if (profileData?.user) {
      setFormData({
        username: profileData.user.username || '',
        bio: profileData.user.bio || '',
      });
    }
    setValidationErrors({});
  };

  // Calculate remaining characters for bio
  const bioCharactersRemaining = VALIDATION_RULES.bio.maxLength - (formData.bio?.length || 0);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-aged-bronze border-t-burnished-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="fantasy-body text-aged-bronze">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-700 text-center">
            {profileError?.message || 'Failed to load profile. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-parchment parchment-texture border-b-2 border-aged-bronze shadow-lg relative">
        <div className="flex items-center justify-center p-4">
          <h1 className="fantasy-title text-3xl text-midnight-ink">{UI_TEXT.profile.title}</h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-aged-bronze via-burnished-gold to-aged-bronze" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Profile Card */}
          <div className="bg-parchment parchment-texture rounded-lg border-2 border-aged-bronze shadow-xl p-6 space-y-6">
            {/* Title */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
                  <User className="w-8 h-8 text-parchment" />
                </div>
              </div>
              <p className="fantasy-body text-aged-bronze text-sm">
                {UI_TEXT.profile.subtitle}
              </p>
            </div>

            {/* Success Message */}
            {isSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm text-center">
                  {SUCCESS_MESSAGES.profile.updated}
                </p>
              </div>
            )}

            {/* API Error */}
            {isUpdateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm text-center">
                  {updateError?.message || 'Failed to update profile. Please try again.'}
                </p>
              </div>
            )}

            {/* Email Display (Read-only) */}
            <div className="bg-aged-bronze/10 rounded-lg p-3">
              <p className="fantasy-body text-xs text-aged-bronze uppercase mb-1">Email</p>
              <p className="fantasy-body text-midnight-ink">{profileData?.user?.email}</p>
            </div>

            {/* XP & Level Display (Story 2.2) */}
            <div className="bg-aged-bronze/10 rounded-lg p-3">
              <XPLevelDisplay
                xp={profileData?.user?.xp}
                level={profileData?.user?.level}
                size="md"
              />
            </div>

            {/* Currency Display (Story 2.3) */}
            <div className="bg-aged-bronze/10 rounded-lg p-3">
              <CurrencyDisplay
                amount={profileData?.user?.money}
                label="Balance"
                size="md"
                isLoading={isLoading}
              />
            </div>

            {/* Statistics Dashboard (Story 2.4) */}
            {/* Mock data for now - will use API stats when backend endpoint is ready */}
            <div className="space-y-2">
              <p className="fantasy-body text-xs text-aged-bronze uppercase tracking-wide">
                Game Statistics
              </p>
              <div className="grid grid-cols-2 gap-3">
                <StatisticsCard
                  value={3}
                  label="Horses Owned"
                  type={StatisticType.HORSES_OWNED}
                  size="sm"
                  isLoading={isLoading}
                />
                <StatisticsCard
                  value={7}
                  label="Competitions Won"
                  type={StatisticType.COMPETITIONS_WON}
                  size="sm"
                  isLoading={isLoading}
                />
                <StatisticsCard
                  value={2}
                  label="Breeding Count"
                  type={StatisticType.BREEDING_COUNT}
                  size="sm"
                  isLoading={isLoading}
                />
                <StatisticsCard
                  value={58}
                  label="Win Rate"
                  type={StatisticType.WIN_RATE}
                  size="sm"
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* Activity Feed (Story 2.5) */}
            {/* Mock data for now - will use API activities when backend endpoint is ready */}
            <div className="bg-aged-bronze/10 rounded-lg p-3">
              <ActivityFeed
                activities={mockActivities}
                title="Recent Activity"
                maxItems={3}
                showViewAll
                size="sm"
                isLoading={isLoading}
              />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Display Name Field */}
              <div className="space-y-1">
                <label htmlFor="username" className="fantasy-body text-sm text-midnight-ink font-medium">
                  {UI_TEXT.profile.displayNameLabel}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
                  <FantasyInput
                    id="username"
                    name="username"
                    type="text"
                    placeholder={UI_TEXT.profile.displayNamePlaceholder}
                    value={formData.username}
                    onChange={handleChange}
                    className="pl-10"
                    autoComplete="username"
                  />
                </div>
                {validationErrors.username && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.username}</p>
                )}
              </div>

              {/* Bio Field */}
              <div className="space-y-1">
                <label htmlFor="bio" className="fantasy-body text-sm text-midnight-ink font-medium">
                  {UI_TEXT.profile.bioLabel}
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-aged-bronze" />
                  <FantasyTextarea
                    id="bio"
                    name="bio"
                    placeholder={UI_TEXT.profile.bioPlaceholder}
                    value={formData.bio || ''}
                    onChange={handleChange}
                    className="pl-10 min-h-[120px]"
                    maxLength={VALIDATION_RULES.bio.maxLength}
                  />
                </div>
                <p className="text-aged-bronze text-xs text-right">
                  {UI_TEXT.profile.charactersRemaining(bioCharactersRemaining)}
                </p>
                {validationErrors.bio && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.bio}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <FantasyButton
                  type="button"
                  variant="secondary"
                  size="default"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  {UI_TEXT.profile.cancelButton}
                </FantasyButton>
                <FantasyButton
                  type="submit"
                  variant="primary"
                  size="default"
                  className="flex-1"
                  disabled={isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isPending ? UI_TEXT.profile.savingButton : UI_TEXT.profile.saveButton}
                </FantasyButton>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-parchment border-t border-aged-bronze p-4 text-center">
        <p className="fantasy-body text-xs text-aged-bronze">
          &copy; 2025 Equoria. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default ProfilePage;
