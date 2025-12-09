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
  const {
    data: development,
    isLoading: loadingDev,
    error: devError,
  } = useFoalDevelopment(foalId);
  const { data: activities } = useFoalActivities(foalId);

  const logActivity = useLogFoalActivity(foalId);
  const enrichFoal = useEnrichFoal(foalId);
  const revealTraits = useRevealFoalTraits(foalId);
  const developFoal = useDevelopFoal(foalId);

  const [activityName, setActivityName] = useState('trust_building');
  const [duration, setDuration] = useState<number | ''>(15);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Foal Development</p>
          <h3 className="text-xl font-bold text-slate-900">Foal #{foalId}</h3>
          {foal && (
            <p className="text-sm text-slate-600">
              {foal.name ?? 'Unnamed foal'} • Age {foal.ageDays ?? '—'} days
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => developFoal.mutate({ progress: (development?.progress ?? 0) + 5 })}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          disabled={developFoal.isPending}
        >
          {developFoal.isPending ? 'Updating…' : 'Advance Stage'}
        </button>
      </div>

      {devError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {devError.message}
        </div>
      )}

      {(loadingFoal || loadingDev) && (
        <div className="text-sm text-slate-600">Loading foal details and development…</div>
      )}

      {development && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Stage</div>
            <div className="text-xl font-bold text-slate-900">
              {development.stage ?? 'Unknown'}
            </div>
            <div className="text-xs text-slate-600">Progress: {development.progress ?? 0}%</div>
          </div>
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Wellbeing</div>
            <div className="text-xs text-slate-600">
              Bonding: {development.bonding ?? 0} • Stress: {development.stress ?? 0}
            </div>
            <div className="text-xs text-slate-600">
              Enrichment: {development.enrichmentLevel ?? 0}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Log Activity</div>
          <input
            type="text"
            value={activityName}
            onChange={(event) => setActivityName(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Activity name"
          />
          <input
            type="number"
            value={duration}
            onChange={(event) => setDuration(event.target.value === '' ? '' : Number(event.target.value))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Duration (minutes)"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => logActivity.mutate({ activity: activityName, duration: Number(duration) })}
              disabled={logActivity.isPending || activityName.length === 0 || duration === ''}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {logActivity.isPending ? 'Logging…' : 'Log Activity'}
            </button>
            <button
              type="button"
              onClick={() => enrichFoal.mutate({ activity: 'enrichment', duration: Number(duration) })}
              disabled={enrichFoal.isPending || duration === ''}
              className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {enrichFoal.isPending ? 'Enriching…' : 'Enrich'}
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Traits</div>
              <div className="text-xs text-slate-600">
                Reveal traits once available; server computes inheritance.
              </div>
            </div>
            <button
              type="button"
              onClick={() => revealTraits.mutate()}
              disabled={revealTraits.isPending}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {revealTraits.isPending ? 'Revealing…' : 'Reveal Traits'}
            </button>
          </div>
          <div className="rounded-md border border-white/60 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner">
            {foal?.traits && foal.traits.length > 0
              ? foal.traits.join(', ')
              : 'Traits pending discovery.'}
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Activity Log</div>
            <div className="text-xs text-slate-600">Latest activities fetched from the API.</div>
            <div className="mt-2 space-y-2">
              {activities?.map((activity) => (
                <div
                  key={`${activity.activity}-${activity.createdAt ?? activity.id ?? 'pending'}`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{activity.activity}</span>
                    <span className="text-xs text-slate-500">
                      {activity.duration ? `${activity.duration} min` : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {activity.createdAt
                      ? new Date(activity.createdAt).toLocaleString()
                      : 'Timestamp pending'}
                  </div>
                </div>
              ))}
              {!activities?.length && (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
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
