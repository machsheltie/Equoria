/**
 * EnrichmentActivityPanel Component
 *
 * Main panel for foal enrichment activities.
 * Displays available activities, handles activity performance,
 * shows history, and manages category filtering.
 *
 * Story 6-3: Enrichment Activity UI
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Activity, History, AlertCircle } from 'lucide-react';
import ActivityCard from './ActivityCard';
import ActivityConfirmationModal from './ActivityConfirmationModal';
import ActivityHistoryList from './ActivityHistoryList';
import CategoryFilter from './CategoryFilter';
import type {
  Foal,
  EnrichmentCategory,
  EnrichmentActivityDefinition,
  FoalEnrichmentStatus,
} from '@/types/foal';

export interface EnrichmentActivityPanelProps {
  foal: Foal;
}

/**
 * Mock API - Replace with actual API calls
 */
const mockApi = {
  getEnrichmentStatus: async (foalId: number): Promise<FoalEnrichmentStatus> => {
    // Mock data - replace with actual API call
    return {
      foalId,
      availableActivities: [
        {
          id: 'gentle-touch',
          name: 'Gentle Touch',
          description: 'Gentle stroking and touching to build trust and bonding',
          category: 'trust',
          durationMinutes: 15,
          cooldownHours: 6,
          benefits: {
            temperamentModifiers: { boldness: 2, obedience: 1 },
            traitDiscoveryBoost: 5,
            milestoneBonus: 10,
            bondingIncrease: 5,
            stressReduction: 3,
          },
        },
        {
          id: 'sound-exposure',
          name: 'Sound Exposure',
          description: 'Gradual exposure to various sounds and noises',
          category: 'desensitization',
          durationMinutes: 20,
          cooldownHours: 8,
          benefits: {
            temperamentModifiers: { boldness: 3, focus: 1 },
            traitDiscoveryBoost: 8,
            milestoneBonus: 15,
            bondingIncrease: 3,
            stressReduction: 2,
          },
        },
      ],
      activityStatuses: [
        {
          activityId: 'gentle-touch',
          status: 'available',
          canPerform: true,
        },
        {
          activityId: 'sound-exposure',
          status: 'on_cooldown',
          nextAvailableAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          cooldownRemainingMinutes: 120,
          canPerform: false,
        },
      ],
      recentHistory: [
        {
          id: 1,
          activityName: 'Gentle Touch',
          category: 'trust',
          performedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 15,
          results: {
            temperamentChanges: { boldness: 2, obedience: 1 },
            traitsDiscovered: ['Calm', 'Trusting'],
            milestonePoints: 10,
            bondingChange: 5,
            stressChange: -3,
          },
        },
      ],
      dailyActivitiesCompleted: 1,
      dailyActivitiesLimit: 5,
      recommendedActivities: ['gentle-touch'],
    };
  },

  performActivity: async (foalId: number, activityId: string) => {
    // Mock response - replace with actual API call
    return {
      activity: {
        id: Date.now(),
        foalId,
        activityId,
        performedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results: {
          temperamentChanges: { boldness: 2, obedience: 1 },
          traitsDiscovered: ['Calm'],
          milestonePoints: 10,
          bondingChange: 5,
          stressChange: -3,
        },
      },
      foalUpdated: {
        bondingLevel: 55,
        stressLevel: 20,
      },
      message: 'Activity completed successfully!',
    };
  },
};

/**
 * EnrichmentActivityPanel Component
 */
const EnrichmentActivityPanel: React.FC<EnrichmentActivityPanelProps> = ({ foal }) => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<EnrichmentCategory | 'all'>('all');
  const [selectedActivity, setSelectedActivity] = useState<EnrichmentActivityDefinition | null>(
    null
  );
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Fetch enrichment status
  const {
    data: enrichmentStatus,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['foalEnrichmentStatus', foal.id],
    queryFn: () => mockApi.getEnrichmentStatus(foal.id),
    refetchInterval: 60000, // Refetch every minute to update cooldowns
  });

  // Perform activity mutation
  const performActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await mockApi.performActivity(foal.id, activityId);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['foalEnrichmentStatus', foal.id] });
      queryClient.invalidateQueries({ queryKey: ['foal', foal.id] });
      setIsConfirmModalOpen(false);
      setSelectedActivity(null);
    },
  });

  // Filter activities by category
  const filteredActivities = useMemo(() => {
    if (!enrichmentStatus) return [];
    if (selectedCategory === 'all') return enrichmentStatus.availableActivities;
    return enrichmentStatus.availableActivities.filter(
      (activity) => activity.category === selectedCategory
    );
  }, [enrichmentStatus, selectedCategory]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    if (!enrichmentStatus) return {};
    const counts: Record<EnrichmentCategory | 'all', number> = {
      all: enrichmentStatus.availableActivities.length,
      trust: 0,
      desensitization: 0,
      exposure: 0,
      habituation: 0,
    };

    enrichmentStatus.availableActivities.forEach((activity) => {
      counts[activity.category] = (counts[activity.category] || 0) + 1;
    });

    return counts;
  }, [enrichmentStatus]);

  // Handle activity selection
  const handleActivityClick = (activity: EnrichmentActivityDefinition) => {
    const status = enrichmentStatus?.activityStatuses.find(
      (s) => s.activityId === activity.id
    );
    if (status?.canPerform) {
      setSelectedActivity(activity);
      setIsConfirmModalOpen(true);
    }
  };

  // Handle activity confirmation
  const handleConfirmActivity = () => {
    if (selectedActivity) {
      performActivityMutation.mutate(selectedActivity.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error loading enrichment activities</p>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!enrichmentStatus) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-emerald-600" />
              <h2 className="text-2xl font-bold text-slate-900">Enrichment Activities</h2>
            </div>
            <p className="text-slate-600 mt-1">
              Build trust, discover traits, and support your foal's development
            </p>
          </div>
        </div>

        {/* Daily Activity Counter */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">
              Daily Activities Completed
            </span>
            <span className="text-sm font-bold text-emerald-600">
              {enrichmentStatus.dailyActivitiesCompleted} / {enrichmentStatus.dailyActivitiesLimit}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${
                  (enrichmentStatus.dailyActivitiesCompleted /
                    enrichmentStatus.dailyActivitiesLimit) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categoryCounts={categoryCounts}
          showCounts={true}
        />
      </div>

      {/* Available Activities */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">Available Activities</h3>
          {selectedCategory !== 'all' && (
            <span className="text-sm text-slate-500">
              ({filteredActivities.length} {selectedCategory})
            </span>
          )}
        </div>

        {filteredActivities.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredActivities.map((activity) => {
              const status = enrichmentStatus.activityStatuses.find(
                (s) => s.activityId === activity.id
              );
              const isRecommended = enrichmentStatus.recommendedActivities.includes(activity.id);

              return (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  status={status!}
                  foal={foal}
                  onClick={() => handleActivityClick(activity)}
                  isRecommended={isRecommended}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>No {selectedCategory !== 'all' ? selectedCategory : ''} activities available.</p>
          </div>
        )}
      </div>

      {/* Activity History */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">Recent Activity History</h3>
        </div>

        <ActivityHistoryList history={enrichmentStatus.recentHistory} maxItems={5} />
      </div>

      {/* Confirmation Modal */}
      <ActivityConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setSelectedActivity(null);
        }}
        onConfirm={handleConfirmActivity}
        activity={selectedActivity}
        foal={foal}
        isSubmitting={performActivityMutation.isPending}
      />
    </div>
  );
};

export default EnrichmentActivityPanel;
