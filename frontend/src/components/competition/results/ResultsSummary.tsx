/**
 * The summary block of CompetitionResultsModal (Equoria-a1thh): the discipline,
 * date and participant line, and the prize-pool distribution. Presentational
 * only.
 */

import { Trophy, Calendar, Users } from 'lucide-react';
import Currency from '@/components/ui/Currency';
import { formatDate } from '@/lib/formatDate';
import { competitionDisciplineLabel } from '@/lib/utils/training-utils';
import type { CompetitionResults } from '@/lib/api/competitionResults';

interface ResultsSummaryProps {
  results: CompetitionResults | null;
}

export default function ResultsSummary({ results }: ResultsSummaryProps) {
  return (
    <>
      {/* Subtitle row: discipline, date, participants */}
      <div className="flex items-center gap-4 flex-wrap -mt-2">
        <span
          className="inline-block px-3 py-1 bg-[rgba(37,99,235,0.1)] text-blue-400 text-sm font-medium rounded-full border border-blue-500/30"
          data-testid="competition-discipline"
        >
          {results?.discipline ? competitionDisciplineLabel(results.discipline) : '—'}
        </span>
        <div className="flex items-center text-sm text-slate-400" data-testid="competition-date">
          <Calendar className="h-4 w-4 mr-1" aria-hidden="true" />
          {results?.date ? formatDate(results.date) : '—'}
        </div>
        <div className="flex items-center text-sm text-slate-400">
          <Users className="h-4 w-4 mr-1" aria-hidden="true" />
          <span data-testid="total-participants">{results?.totalParticipants || 0}</span>
          <span className="ml-1">participants</span>
        </div>
      </div>

      {/* Prize Distribution */}
      {/* Shows that pay no prize money (conformation) have no pool to show. */}
      {results && results.prizePool !== null && results.prizeDistribution && (
        <div
          className="bg-[var(--alpha-gold-primary-10)] border border-amber-500/20 rounded-lg p-4"
          data-testid="prize-distribution"
        >
          <div className="flex items-center mb-3">
            <Trophy className="h-5 w-5 text-amber-500 mr-2" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[rgb(220,235,255)]">
              Prize Pool: <Currency amount={results.prizePool} />
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center" data-testid="prize-1st">
              <div className="text-lg font-bold text-amber-400">1st</div>
              <div className="text-sm text-slate-400">50%</div>
              <div className="font-semibold text-[rgb(220,235,255)]">
                <Currency amount={results.prizeDistribution.first ?? Number.NaN} />
              </div>
            </div>
            <div className="text-center" data-testid="prize-2nd">
              <div className="text-lg font-bold text-slate-400">2nd</div>
              <div className="text-sm text-slate-400">30%</div>
              <div className="font-semibold text-[rgb(220,235,255)]">
                <Currency amount={results.prizeDistribution.second ?? Number.NaN} />
              </div>
            </div>
            <div className="text-center" data-testid="prize-3rd">
              <div className="text-lg font-bold text-orange-600">3rd</div>
              <div className="text-sm text-slate-400">20%</div>
              <div className="font-semibold text-orange-600">
                <Currency amount={results.prizeDistribution.third ?? Number.NaN} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
