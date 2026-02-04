import React from 'react';
import { Trophy } from 'lucide-react';

interface CompetitionResult {
  id: string;
  competitionName: string;
  horseName: string;
  place: number;
  date: string;
  reward: number;
  discipline: string;
}

interface RecentCompetitionsProps {
  results: CompetitionResult[];
}

const RecentCompetitions: React.FC<RecentCompetitionsProps> = ({ results }) => {
  const getPlaceColor = (place: number) => {
    switch (place) {
      case 1:
        return 'text-amber-500';
      case 2:
        return 'text-silver';
      case 3:
        return 'text-amber-700';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center">
          <Trophy size={18} className="text-sky-blue mr-2" />
          Recent Competitions
        </h3>
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <div key={result.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-sm">{result.competitionName}</h4>
                <p className="text-xs text-gray-500">
                  with <span className="font-medium">{result.horseName}</span>
                </p>
              </div>

              <div className="flex flex-col items-end">
                <span className={`font-medium ${getPlaceColor(result.place)}`}>
                  {result.place === 1
                    ? '1st'
                    : result.place === 2
                      ? '2nd'
                      : result.place === 3
                        ? '3rd'
                        : `${result.place}th`}{' '}
                  Place
                </span>
                <span className="text-xs text-gray-500">{result.date}</span>
              </div>
            </div>

            <div className="flex justify-between mt-1 text-xs">
              <span className="bg-sky-blue/10 text-sky-blue px-1.5 py-0.5 rounded">
                {result.discipline}
              </span>
              <span className="flex items-center text-amber-500 font-medium">
                +{result.reward} <Trophy size={12} className="ml-1" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentCompetitions;
