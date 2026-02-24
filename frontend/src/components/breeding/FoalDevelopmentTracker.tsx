import { useState } from 'react';
import {
  useDevelopFoal,
  useEnrichFoal,
  useFoal,
  useFoalActivities,
  useFoalDevelopment,
  useLogFoalActivity,
  useRevealFoalTraits,
} from '@/hooks/api/useBreeding';

interface FoalDevelopmentTrackerProps {
  foalId: number;
}

const FoalDevelopmentTracker = ({ foalId }: FoalDevelopmentTrackerProps) => {
  const { data: foal, isLoading: loadingFoal } = useFoal(foalId);
  const { data: development, isLoading: loadingDev, error: devError } = useFoalDevelopment(foalId);
  const { data: activities } = useFoalActivities(foalId);

  const logActivity = useLogFoalActivity(foalId);
  const enrichFoal = useEnrichFoal(foalId);
  const revealTraits = useRevealFoalTraits(foalId);
  const developFoal = useDevelopFoal(foalId);

  const [activityName, setActivityName] = useState('trust_building');
  const [duration, setDuration] = useState<number | ''>(15);

  return (
    <div className="space-y-4 rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[rgb(148,163,184)]">
            Foal Development
          </p>
          <h3 className="text-xl font-bold text-[rgb(220,235,255)]">Foal #{foalId}</h3>
          {foal && (
            <p className="text-sm text-[rgb(148,163,184)]">
              {foal.name ?? 'Unnamed foal'} • Age {foal.ageDays ?? '—'} days
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => developFoal.mutate({ progress: (development?.progress ?? 0) + 5 })}
          className="rounded-md border border-[rgba(37,99,235,0.2)] px-3 py-2 text-sm font-semibold text-[rgb(220,235,255)] shadow-sm hover:bg-[rgba(37,99,235,0.08)]"
          disabled={developFoal.isPending}
        >
          {developFoal.isPending ? 'Updating…' : 'Advance Stage'}
        </button>
      </div>

      {devError && (
        <div className="rounded-md border border-red-500/30 bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-red-400">
          {devError.message}
        </div>
      )}

      {(loadingFoal || loadingDev) && (
        <div className="text-sm text-[rgb(148,163,184)]">Loading foal details and development…</div>
      )}

      {development && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4">
            <div className="text-sm font-semibold text-[rgb(220,235,255)]">Stage</div>
            <div className="text-xl font-bold text-[rgb(220,235,255)]">
              {development.stage ?? 'Unknown'}
            </div>
            <div className="text-xs text-[rgb(148,163,184)]">
              Progress: {development.progress ?? 0}%
            </div>
          </div>
          <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4">
            <div className="text-sm font-semibold text-[rgb(220,235,255)]">Wellbeing</div>
            <div className="text-xs text-[rgb(148,163,184)]">
              Bonding: {development.bonding ?? 0} • Stress: {development.stress ?? 0}
            </div>
            <div className="text-xs text-[rgb(148,163,184)]">
              Enrichment: {development.enrichmentLevel ?? 0}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4">
          <div className="text-sm font-semibold text-[rgb(220,235,255)]">Log Activity</div>
          <input
            type="text"
            value={activityName}
            onChange={(event) => setActivityName(event.target.value)}
            className="celestial-input w-full"
            placeholder="Activity name"
          />
          <input
            type="number"
            value={duration}
            onChange={(event) =>
              setDuration(event.target.value === '' ? '' : Number(event.target.value))
            }
            className="celestial-input w-full"
            placeholder="Duration (minutes)"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                logActivity.mutate({ activity: activityName, duration: Number(duration) })
              }
              disabled={logActivity.isPending || activityName.length === 0 || duration === ''}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {logActivity.isPending ? 'Logging…' : 'Log Activity'}
            </button>
            <button
              type="button"
              onClick={() =>
                enrichFoal.mutate({ activity: 'enrichment', duration: Number(duration) })
              }
              disabled={enrichFoal.isPending || duration === ''}
              className="w-full rounded-md border border-emerald-500/30 bg-[rgba(16,185,129,0.1)] px-4 py-2 text-sm font-semibold text-emerald-400 shadow-sm hover:bg-[rgba(16,185,129,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {enrichFoal.isPending ? 'Enriching…' : 'Enrich'}
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[rgb(220,235,255)]">Traits</div>
              <div className="text-xs text-[rgb(148,163,184)]">
                Reveal traits once available; server computes inheritance.
              </div>
            </div>
            <button
              type="button"
              onClick={() => revealTraits.mutate()}
              disabled={revealTraits.isPending}
              className="rounded-md border border-[rgba(37,99,235,0.2)] px-3 py-2 text-sm font-semibold text-[rgb(220,235,255)] shadow-sm hover:bg-[rgba(37,99,235,0.1)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {revealTraits.isPending ? 'Revealing…' : 'Reveal Traits'}
            </button>
          </div>
          <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] px-3 py-2 text-sm text-[rgb(220,235,255)] shadow-inner">
            {foal?.traits && foal.traits.length > 0
              ? foal.traits.join(', ')
              : 'Traits pending discovery.'}
          </div>

          <div>
            <div className="text-sm font-semibold text-[rgb(220,235,255)]">Activity Log</div>
            <div className="text-xs text-[rgb(148,163,184)]">
              Latest activities fetched from the API.
            </div>
            <div className="mt-2 space-y-2">
              {activities?.map((activity) => (
                <div
                  key={`${activity.activity}-${activity.createdAt ?? activity.id ?? 'pending'}`}
                  className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] px-3 py-2 text-sm text-[rgb(220,235,255)] shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{activity.activity}</span>
                    <span className="text-xs text-[rgb(148,163,184)]">
                      {activity.duration ? `${activity.duration} min` : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-[rgb(148,163,184)]">
                    {activity.createdAt
                      ? new Date(activity.createdAt).toLocaleString()
                      : 'Timestamp pending'}
                  </div>
                </div>
              ))}
              {!activities?.length && (
                <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] px-3 py-2 text-sm text-[rgb(148,163,184)] shadow-sm">
                  No activities logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoalDevelopmentTracker;
