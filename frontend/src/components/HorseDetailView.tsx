import { useState } from 'react';
import { getBreedName } from '@/lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { useHorse, useHorseTrainingHistory } from '@/hooks/api/useHorses';
import { Button } from '@/components/ui/button';
import {
  Zap,
  Heart,
  Star,
  Shield,
  Trophy,
  ArrowLeft,
  Dumbbell,
  Award,
  Sparkles,
} from 'lucide-react';

type TabType = 'overview' | 'disciplines' | 'genetics' | 'training' | 'competition';

interface HorseDetailViewProps {
  horseId?: number;
}

const HorseDetailView = ({ horseId: propHorseId }: HorseDetailViewProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const horseId = propHorseId || (id ? parseInt(id, 10) : 0);

  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data: horse, isLoading: horseLoading, error: horseError } = useHorse(horseId);
  const { data: trainingHistory, isLoading: historyLoading } = useHorseTrainingHistory(horseId);

  const getStatIcon = (statName: string) => {
    switch (statName) {
      case 'speed':
        return <Zap className="w-5 h-5" />;
      case 'stamina':
        return <Heart className="w-5 h-5" />;
      case 'agility':
        return <Star className="w-5 h-5" />;
      case 'strength':
        return <Shield className="w-5 h-5" />;
      case 'intelligence':
        return <Trophy className="w-5 h-5" />;
      case 'health':
        return <Heart className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const getStatColor = (value: number) => {
    if (value >= 90) return 'text-burnished-gold';
    if (value >= 75) return 'text-emerald-400';
    if (value >= 60) return 'text-aged-bronze';
    return 'text-[rgb(148,163,184)]';
  };

  // Loading state
  if (horseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="text-lg font-semibold text-[rgb(220,235,255)]">
            Loading horse details…
          </div>
          <div className="text-sm text-aged-bronze mt-2">Please wait</div>
        </div>
      </div>
    );
  }

  // Error state
  if (horseError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md w-full mx-4">
          <div className="glass-panel rounded-lg border border-rose-500/30 p-6">
            <div className="text-sm text-rose-400">{horseError.message}</div>
            <Button type="button" size="sm" className="mt-4" onClick={() => navigate('/horses')}>
              Back to Horse List
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Horse not found
  if (!horse) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md w-full mx-4">
          <div className="glass-panel rounded-lg p-6">
            <div className="text-sm text-[rgb(148,163,184)]">Horse not found</div>
            <Button type="button" size="sm" className="mt-4" onClick={() => navigate('/horses')}>
              Back to Horse List
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/horses')}
            className="flex items-center space-x-2 text-aged-bronze hover:text-burnished-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Horses</span>
          </button>
        </div>

        {/* Horse Header Section */}
        <div className="glass-panel rounded-lg p-6 mb-6">
          <div className="flex items-start space-x-6">
            {/* Horse Image Placeholder */}
            <div className="w-32 h-32 rounded border border-[rgba(37,99,235,0.3)] overflow-hidden bg-[rgba(37,99,235,0.05)] flex-shrink-0">
              <div className="w-full h-full flex items-center justify-center text-aged-bronze">
                <Trophy className="w-16 h-16" />
              </div>
            </div>

            {/* Horse Info */}
            <div className="flex-1">
              <h1 className="fantasy-title text-3xl text-[rgb(220,235,255)] mb-2">{horse.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-aged-bronze mb-4">
                {horse.breed && <span>Breed: {getBreedName(horse.breed)}</span>}
                {horse.ageYears !== undefined && <span>Age: {horse.ageYears} years</span>}
                {horse.sex && <span>Sex: {horse.sex}</span>}
                {horse.level !== undefined && <span>Level: {horse.level}</span>}
              </div>

              {/* Quick Stats Summary */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {['speed', 'stamina', 'agility', 'strength', 'intelligence', 'health'].map(
                  (stat) => (
                    <div key={stat} className="flex flex-col items-center">
                      <div className={getStatColor(75)}>{getStatIcon(stat)}</div>
                      <span className="text-xs text-[rgb(148,163,184)] mt-1 capitalize">
                        {stat}
                      </span>
                      <span className="text-sm font-semibold text-[rgb(220,235,255)]">--</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[rgba(37,99,235,0.3)] mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {(
              [
                { key: 'overview', label: 'Overview' },
                { key: 'disciplines', label: 'Disciplines' },
                { key: 'genetics', label: 'Genetics' },
                { key: 'training', label: 'Training' },
                { key: 'competition', label: 'Competition' },
              ] as { key: TabType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-burnished-gold text-burnished-gold'
                    : 'border-transparent text-aged-bronze hover:border-[rgba(37,99,235,0.4)] hover:text-[rgb(220,235,255)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="glass-panel rounded-lg p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[rgb(220,235,255)] mb-4">Current Status</h2>
                <div className="text-sm text-aged-bronze">
                  <p>Displaying basic horse information.</p>
                  <p className="mt-2">
                    Full stats and attributes will be displayed when available from backend.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Disciplines Tab */}
          {activeTab === 'disciplines' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[rgb(220,235,255)] mb-4">Discipline Scores</h2>
              <div className="text-sm text-aged-bronze">
                <p>Discipline scores will be displayed when available from backend.</p>
                <p className="mt-2">
                  This section will show performance across all 23 disciplines.
                </p>
              </div>
            </div>
          )}

          {/* Genetics Tab */}
          {activeTab === 'genetics' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[rgb(220,235,255)] mb-4">Genetic Traits</h2>
              <div className="text-sm text-aged-bronze">
                <p>Genetic traits and markers will be displayed when available.</p>
                <p className="mt-2">
                  This section will show inherited traits and genetic potential.
                </p>
              </div>
            </div>
          )}

          {/* Training Tab */}
          {activeTab === 'training' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[rgb(220,235,255)] mb-4">Training History</h2>
              {historyLoading && (
                <div className="text-sm text-aged-bronze">Loading training history…</div>
              )}
              {!historyLoading && trainingHistory && trainingHistory.length > 0 && (
                <div className="space-y-2">
                  {trainingHistory.map((entry, index) => (
                    <div
                      key={entry.id || index}
                      className="border border-[rgba(37,99,235,0.2)] rounded p-3 bg-[rgba(15,35,70,0.4)]"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-[rgb(220,235,255)]">
                          {entry.discipline || 'Unknown'}
                        </span>
                        <span className="text-sm text-aged-bronze">
                          Score: {entry.score !== undefined ? entry.score : '--'}
                        </span>
                      </div>
                      {entry.trainedAt && (
                        <div className="text-xs text-aged-bronze mt-1">
                          {new Date(entry.trainedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!historyLoading && (!trainingHistory || trainingHistory.length === 0) && (
                <div className="text-sm text-aged-bronze">No training history available yet.</div>
              )}
            </div>
          )}

          {/* Competition Tab */}
          {activeTab === 'competition' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[rgb(220,235,255)] mb-4">
                Competition Results
              </h2>
              <div className="text-sm text-aged-bronze">
                <p>Competition results will be displayed when available.</p>
                <p className="mt-2">This section will show rankings and achievements.</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions Bar */}
        <div className="mt-6 flex flex-wrap gap-4">
          <Button type="button" size="sm">
            <Dumbbell className="w-4 h-4" />
            <span>Train This Horse</span>
          </Button>
          <Button type="button" variant="secondary" size="sm">
            <Award className="w-4 h-4" />
            <span>Enter Competition</span>
          </Button>
          <Button type="button" variant="secondary" size="sm">
            <Sparkles className="w-4 h-4" />
            <span>View Breeding Options</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HorseDetailView;
