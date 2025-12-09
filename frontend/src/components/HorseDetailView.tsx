import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHorse, useHorseTrainingHistory } from '@/hooks/api/useHorses';
import { Zap, Heart, Star, Shield, Trophy, ArrowLeft, Dumbbell, Award, Sparkles } from 'lucide-react';

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
    if (value >= 75) return 'text-forest-green';
    if (value >= 60) return 'text-aged-bronze';
    return 'text-mystic-silver';
  };

  // Loading state
  if (horseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-parchment">
        <div className="text-center">
          <div className="text-lg font-semibold text-midnight-ink">Loading horse details…</div>
          <div className="text-sm text-aged-bronze mt-2">Please wait</div>
        </div>
      </div>
    );
  }

  // Error state
  if (horseError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-parchment">
        <div className="max-w-md w-full mx-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <div className="text-sm text-rose-800">{horseError.message}</div>
            <button
              type="button"
              onClick={() => navigate('/horses')}
              className="mt-4 rounded-md bg-aged-bronze px-4 py-2 text-sm font-semibold text-parchment hover:bg-burnished-gold"
            >
              Back to Horse List
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Horse not found
  if (!horse) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-parchment">
        <div className="max-w-md w-full mx-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-600">Horse not found</div>
            <button
              type="button"
              onClick={() => navigate('/horses')}
              className="mt-4 rounded-md bg-aged-bronze px-4 py-2 text-sm font-semibold text-parchment hover:bg-burnished-gold"
            >
              Back to Horse List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment parchment-texture">
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
        <div className="bg-white rounded-lg border border-aged-bronze p-6 mb-6 shadow-sm">
          <div className="flex items-start space-x-6">
            {/* Horse Image Placeholder */}
            <div className="w-32 h-32 rounded border border-aged-bronze overflow-hidden bg-mystic-silver/20 flex-shrink-0">
              <div className="w-full h-full flex items-center justify-center text-aged-bronze">
                <Trophy className="w-16 h-16" />
              </div>
            </div>

            {/* Horse Info */}
            <div className="flex-1">
              <h1 className="fantasy-title text-3xl text-midnight-ink mb-2">{horse.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-aged-bronze mb-4">
                {horse.breed && <span>Breed: {horse.breed}</span>}
                {horse.ageYears !== undefined && <span>Age: {horse.ageYears} years</span>}
                {horse.sex && <span>Sex: {horse.sex}</span>}
                {horse.level !== undefined && <span>Level: {horse.level}</span>}
              </div>

              {/* Quick Stats Summary */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {['speed', 'stamina', 'agility', 'strength', 'intelligence', 'health'].map((stat) => (
                  <div key={stat} className="flex flex-col items-center">
                    <div className={getStatColor(75)}>
                      {getStatIcon(stat)}
                    </div>
                    <span className="text-xs text-midnight-ink mt-1 capitalize">{stat}</span>
                    <span className="text-sm font-semibold text-midnight-ink">--</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-aged-bronze mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-burnished-gold text-burnished-gold'
                  : 'border-transparent text-aged-bronze hover:border-aged-bronze hover:text-midnight-ink'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'disciplines'}
              onClick={() => setActiveTab('disciplines')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'disciplines'
                  ? 'border-burnished-gold text-burnished-gold'
                  : 'border-transparent text-aged-bronze hover:border-aged-bronze hover:text-midnight-ink'
              }`}
            >
              Disciplines
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'genetics'}
              onClick={() => setActiveTab('genetics')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'genetics'
                  ? 'border-burnished-gold text-burnished-gold'
                  : 'border-transparent text-aged-bronze hover:border-aged-bronze hover:text-midnight-ink'
              }`}
            >
              Genetics
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'training'}
              onClick={() => setActiveTab('training')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'training'
                  ? 'border-burnished-gold text-burnished-gold'
                  : 'border-transparent text-aged-bronze hover:border-aged-bronze hover:text-midnight-ink'
              }`}
            >
              Training
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'competition'}
              onClick={() => setActiveTab('competition')}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'competition'
                  ? 'border-burnished-gold text-burnished-gold'
                  : 'border-transparent text-aged-bronze hover:border-aged-bronze hover:text-midnight-ink'
              }`}
            >
              Competition
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-aged-bronze p-6 shadow-sm">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-midnight-ink mb-4">Current Status</h2>
                <div className="text-sm text-aged-bronze">
                  <p>Displaying basic horse information.</p>
                  <p className="mt-2">Full stats and attributes will be displayed when available from backend.</p>
                </div>
              </div>
            </div>
          )}

          {/* Disciplines Tab */}
          {activeTab === 'disciplines' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-midnight-ink mb-4">Discipline Scores</h2>
              <div className="text-sm text-aged-bronze">
                <p>Discipline scores will be displayed when available from backend.</p>
                <p className="mt-2">This section will show performance across all 23 disciplines.</p>
              </div>
            </div>
          )}

          {/* Genetics Tab */}
          {activeTab === 'genetics' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-midnight-ink mb-4">Genetic Traits</h2>
              <div className="text-sm text-aged-bronze">
                <p>Genetic traits and markers will be displayed when available.</p>
                <p className="mt-2">This section will show inherited traits and genetic potential.</p>
              </div>
            </div>
          )}

          {/* Training Tab */}
          {activeTab === 'training' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-midnight-ink mb-4">Training History</h2>
              {historyLoading && (
                <div className="text-sm text-aged-bronze">Loading training history…</div>
              )}
              {!historyLoading && trainingHistory && trainingHistory.length > 0 && (
                <div className="space-y-2">
                  {trainingHistory.map((entry, index) => (
                    <div key={entry.id || index} className="border border-aged-bronze rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-midnight-ink">
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
              <h2 className="text-xl font-bold text-midnight-ink mb-4">Competition Results</h2>
              <div className="text-sm text-aged-bronze">
                <p>Competition results will be displayed when available.</p>
                <p className="mt-2">This section will show rankings and achievements.</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions Bar */}
        <div className="mt-6 flex flex-wrap gap-4">
          <button
            type="button"
            className="flex items-center space-x-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Dumbbell className="w-4 h-4" />
            <span>Train This Horse</span>
          </button>
          <button
            type="button"
            className="flex items-center space-x-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Award className="w-4 h-4" />
            <span>Enter Competition</span>
          </button>
          <button
            type="button"
            className="flex items-center space-x-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            <Sparkles className="w-4 h-4" />
            <span>View Breeding Options</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HorseDetailView;
