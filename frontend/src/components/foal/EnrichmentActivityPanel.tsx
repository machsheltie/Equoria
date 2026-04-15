/**
 * EnrichmentActivityPanel Component
 *
 * Displays recent foal activity history using real API data.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * Uses breedingApi.getFoalActivities with live empty/error states.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, History } from 'lucide-react';
import { breedingApi } from '@/lib/api-client';
import type { Foal } from '@/types/foal';

export interface EnrichmentActivityPanelProps {
  foal: Foal;
}

/**
 * EnrichmentActivityPanel Component
 *
 * Uses real foal activity history from the API.
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
        className="rounded-lg border border-red-500/30 bg-red-500/10 p-6"
        data-testid="enrichment-activity-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-midnight-ink">Error loading enrichment activities</p>
            <p className="text-sm text-mystic-silver mt-1">
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
          <h2 className="text-2xl font-bold text-midnight-ink">Enrichment Activities</h2>
        </div>
        <p className="text-mystic-silver mt-1">
          Build trust, discover traits, and support your foal&apos;s development
        </p>
      </div>
      {/* Activity History using real API data */}
      <div className="glass-panel rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-mystic-silver" />
          <h3 className="text-lg font-bold text-midnight-ink">Recent Activity History</h3>
        </div>

        {activities && activities.length > 0 ? (
          <ul className="space-y-2" data-testid="enrichment-activity-history">
            {activities.slice(0, 5).map((activity, index) => (
              <li
                key={activity.id ?? index}
                className="flex items-center justify-between p-3 rounded-lg bg-saddle-leather/50"
              >
                <span className="text-sm text-midnight-ink">{activity.activity}</span>
                {activity.createdAt && (
                  <span className="text-xs text-mystic-silver">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="text-sm text-mystic-silver text-center py-4"
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
