/**
 * EnrichmentActivityPanel Component
 *
 * Displays recent foal activity history using real API data.
 * Interactive enrichment activity selection and performance requires backend
 * enrichment status endpoints not yet available in this beta.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * (Replaces mockApi with breedingApi.getFoalActivities; interactive features deferred)
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, History } from 'lucide-react';
import { breedingApi } from '@/lib/api-client';
import BetaExcludedNotice from '@/components/beta/BetaExcludedNotice';
import type { Foal } from '@/types/foal';

export interface EnrichmentActivityPanelProps {
  foal: Foal;
}

/**
 * EnrichmentActivityPanel Component
 *
 * Uses real foal activity history from the API.
 * Interactive enrichment selection is excluded from beta pending backend support.
 */
const EnrichmentActivityPanel: React.FC<EnrichmentActivityPanelProps> = ({ foal }) => {
  // Fetch real foal activity history
  const {
    data: activities,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['foalActivities', foal.id],
    queryFn: () => breedingApi.getFoalActivities(foal.id),
    enabled: !!foal.id,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="enrichment-activity-loading">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-4 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/30 bg-[rgba(239,68,68,0.1)] p-6"
        data-testid="enrichment-activity-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[rgb(220,235,255)]">
              Error loading enrichment activities
            </p>
            <p className="text-sm text-[rgb(148,163,184)] mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="enrichment-activity-panel">
      {/* Header */}
      <div className="glass-panel rounded-lg p-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-emerald-400" />
          <h2 className="text-2xl font-bold text-[rgb(220,235,255)]">Enrichment Activities</h2>
        </div>
        <p className="text-[rgb(148,163,184)] mt-1">
          Build trust, discover traits, and support your foal&apos;s development
        </p>
      </div>

      {/* Interactive enrichment — beta-readonly (enrichment status API not available) */}
      <BetaExcludedNotice
        testId="enrichment-activity-beta-notice"
        message="Interactive enrichment activities are not available in this beta."
      />

      {/* Activity History using real API data */}
      <div className="glass-panel rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-[rgb(148,163,184)]" />
          <h3 className="text-lg font-bold text-[rgb(220,235,255)]">Recent Activity History</h3>
        </div>

        {activities && activities.length > 0 ? (
          <ul className="space-y-2" data-testid="enrichment-activity-history">
            {activities.slice(0, 5).map((activity, index) => (
              <li
                key={activity.id ?? index}
                className="flex items-center justify-between p-3 rounded-lg bg-[rgba(15,35,70,0.5)]"
              >
                <span className="text-sm text-[rgb(220,235,255)]">{activity.activity}</span>
                {activity.createdAt && (
                  <span className="text-xs text-[rgb(148,163,184)]">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="text-sm text-[rgb(148,163,184)] text-center py-4"
            data-testid="enrichment-activity-empty"
          >
            No activity history yet for this foal.
          </p>
        )}
      </div>
    </div>
  );
};

export default EnrichmentActivityPanel;
