/**
 * Advanced Epigenetic Dashboard Component
 * 
 * Comprehensive dashboard for advanced epigenetic features including:
 * - Environmental Analysis Panel with trigger detection and risk assessment
 * - Trait Interaction Matrix showing synergies, conflicts, and dominance
 * - Developmental Timeline with milestone tracking and progress visualization
 * - Forecasting Widget with predictions, recommendations, and risk analysis
 * 
 * Features:
 * - Real-time data updates with React Query
 * - Responsive design for mobile and desktop
 * - Interactive panels with expand/collapse functionality
 * - Error handling with retry mechanisms
 * - TypeScript for type safety
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp,
  Activity,
  Target,
  Clock
} from 'lucide-react';

// Types
interface AdvancedEpigeneticDashboardProps {
  horseId: number | null;
  enableRealTime?: boolean;
  className?: string;
}

interface EnvironmentalData {
  triggers: Array<{
    type: string;
    intensity: number;
    timestamp: string;
  }>;
  currentConditions: {
    temperature: number;
    humidity: number;
    noiseLevel: string;
    socialActivity: string;
  };
  riskFactors: string[];
}

interface TraitInteractionData {
  synergies: Array<{
    traits: string[];
    strength: number;
    effect: string;
  }>;
  conflicts: Array<{
    traits: string[];
    strength: number;
    effect: string;
  }>;
  dominance: {
    primary: string;
    secondary: string;
    influence: number;
  };
}

interface DevelopmentalData {
  currentWindow: {
    name: string;
    ageRange: string;
    criticalPeriod: boolean;
    progress: number;
  };
  milestones: Array<{
    name: string;
    completed: boolean;
    score: number;
    date: string | null;
  }>;
  upcomingWindows: Array<{
    name: string;
    ageRange: string;
    startsIn: string;
  }>;
}

interface ForecastData {
  predictions: Array<{
    trait: string;
    probability: number;
    confidence: number;
    timeframe: string;
  }>;
  recommendations: Array<{
    action: string;
    priority: string;
    expectedBenefit: string;
  }>;
  riskAssessment: {
    overall: string;
    factors: string[];
  };
}

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Custom hooks for data fetching
const useEnvironmentalData = (horseId: number | null) => {
  return useQuery({
    queryKey: ['environmental-data', horseId],
    queryFn: async () => {
      if (!horseId) return null;
      const response = await fetch(`${API_BASE_URL}/advanced-epigenetic/environmental/${horseId}`);
      if (!response.ok) throw new Error('Failed to fetch environmental data');
      const result = await response.json();
      return result.data as EnvironmentalData;
    },
    enabled: !!horseId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

const useTraitInteractionData = (horseId: number | null) => {
  return useQuery({
    queryKey: ['trait-interaction-data', horseId],
    queryFn: async () => {
      if (!horseId) return null;
      const response = await fetch(`${API_BASE_URL}/advanced-epigenetic/trait-interactions/${horseId}`);
      if (!response.ok) throw new Error('Failed to fetch trait interaction data');
      const result = await response.json();
      return result.data as TraitInteractionData;
    },
    enabled: !!horseId,
  });
};

const useDevelopmentalData = (horseId: number | null) => {
  return useQuery({
    queryKey: ['developmental-data', horseId],
    queryFn: async () => {
      if (!horseId) return null;
      const response = await fetch(`${API_BASE_URL}/advanced-epigenetic/developmental/${horseId}`);
      if (!response.ok) throw new Error('Failed to fetch developmental data');
      const result = await response.json();
      return result.data as DevelopmentalData;
    },
    enabled: !!horseId,
  });
};

const useForecastData = (horseId: number | null) => {
  return useQuery({
    queryKey: ['forecast-data', horseId],
    queryFn: async () => {
      if (!horseId) return null;
      const response = await fetch(`${API_BASE_URL}/advanced-epigenetic/forecast/${horseId}`);
      if (!response.ok) throw new Error('Failed to fetch forecast data');
      const result = await response.json();
      return result.data as ForecastData;
    },
    enabled: !!horseId,
  });
};

// Main Component
const AdvancedEpigeneticDashboard: React.FC<AdvancedEpigeneticDashboardProps> = ({
  horseId,
  enableRealTime = false,
  className = '',
}) => {
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  // Data queries
  const environmentalQuery = useEnvironmentalData(horseId);
  const traitInteractionQuery = useTraitInteractionData(horseId);
  const developmentalQuery = useDevelopmentalData(horseId);
  const forecastQuery = useForecastData(horseId);

  // Responsive design detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Panel expansion toggle
  const togglePanel = (panelId: string) => {
    const newExpanded = new Set(expandedPanels);
    if (newExpanded.has(panelId)) {
      newExpanded.delete(panelId);
    } else {
      newExpanded.add(panelId);
    }
    setExpandedPanels(newExpanded);
  };

  // Refresh all data
  const refreshData = () => {
    environmentalQuery.refetch();
    traitInteractionQuery.refetch();
    developmentalQuery.refetch();
    forecastQuery.refetch();
  };

  // Handle no horse selected
  if (!horseId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Please select a horse to view epigenetic data</p>
      </div>
    );
  }

  // Loading state
  const isLoading = environmentalQuery.isLoading || traitInteractionQuery.isLoading || 
                   developmentalQuery.isLoading || forecastQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading epigenetic data...</p>
        </div>
      </div>
    );
  }

  // Error state
  const hasError = environmentalQuery.error || traitInteractionQuery.error || 
                  developmentalQuery.error || forecastQuery.error;

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 mb-4">Error loading epigenetic data</p>
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-testid="epigenetic-dashboard"
      className={`space-y-6 ${isMobile ? 'mobile-layout' : ''} ${className}`}
    >
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Advanced Epigenetic Dashboard</h2>
        <button
          onClick={refreshData}
          aria-label="Refresh Data"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          disabled={isLoading}
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Dashboard Grid */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {/* Environmental Analysis Panel */}
        <EnvironmentalAnalysisPanel
          data={environmentalQuery.data}
          isExpanded={expandedPanels.has('environmental')}
          onToggle={() => togglePanel('environmental')}
          error={environmentalQuery.error}
        />

        {/* Trait Interaction Matrix */}
        <TraitInteractionPanel
          data={traitInteractionQuery.data}
          isExpanded={expandedPanels.has('traits')}
          onToggle={() => togglePanel('traits')}
          error={traitInteractionQuery.error}
        />

        {/* Developmental Timeline */}
        <DevelopmentalTimelinePanel
          data={developmentalQuery.data}
          isExpanded={expandedPanels.has('developmental')}
          onToggle={() => togglePanel('developmental')}
          error={developmentalQuery.error}
        />

        {/* Forecasting Widget */}
        <ForecastingPanel
          data={forecastQuery.data}
          isExpanded={expandedPanels.has('forecast')}
          onToggle={() => togglePanel('forecast')}
          error={forecastQuery.error}
        />
      </div>

      {/* Real-time indicator */}
      {enableRealTime && (
        <div className="flex items-center justify-center text-sm text-gray-500">
          <Activity className="w-4 h-4 mr-1" />
          <span>Real-time updates enabled</span>
        </div>
      )}
    </div>
  );
};

// Environmental Analysis Panel Component
interface EnvironmentalAnalysisPanelProps {
  data: EnvironmentalData | null | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  error: Error | null;
}

const EnvironmentalAnalysisPanel: React.FC<EnvironmentalAnalysisPanelProps> = ({
  data,
  isExpanded,
  onToggle,
  error,
}) => {
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Environmental Analysis</h3>
        <p className="text-red-600">Environmental data unavailable</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Environmental Analysis</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Environmental Analysis</h3>
          <button
            onClick={onToggle}
            aria-label="Expand Environmental Analysis"
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Environmental Triggers */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Environmental Triggers</h4>
          <div className="space-y-2">
            {data.triggers.map((trigger, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">{trigger.type}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${trigger.intensity * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{Math.round(trigger.intensity * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Conditions */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Current Conditions</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-sm">
              <span className="text-gray-600">Temperature: </span>
              <span className="font-medium">{data.currentConditions.temperature}°C</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Humidity: </span>
              <span className="font-medium">{data.currentConditions.humidity}%</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Noise: </span>
              <span className="font-medium">{data.currentConditions.noiseLevel}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Social: </span>
              <span className="font-medium">{data.currentConditions.socialActivity}</span>
            </div>
          </div>
        </div>

        {/* Risk Factors */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Risk Factors</h4>
          <div className="flex flex-wrap gap-2">
            {data.riskFactors.map((factor, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full"
              >
                {factor}
              </span>
            ))}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-700 mb-3">Detailed Environmental Data</h4>
            <div className="text-sm text-gray-600 space-y-2">
              <p>Environmental monitoring provides real-time assessment of factors affecting epigenetic expression.</p>
              <p>Trigger intensity levels indicate the strength of environmental influences on trait development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Trait Interaction Panel Component
interface TraitInteractionPanelProps {
  data: TraitInteractionData | null | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  error: Error | null;
}

const TraitInteractionPanel: React.FC<TraitInteractionPanelProps> = ({
  data,
  isExpanded,
  onToggle,
  error,
}) => {
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trait Interactions</h3>
        <p className="text-red-600">Trait data unavailable</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trait Interactions</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Trait Interactions</h3>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Trait Synergies */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Trait Synergies</h4>
          <div className="space-y-3">
            {data.synergies.map((synergy, index) => (
              <div key={index} className="p-3 bg-green-50 rounded border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-800">
                    {synergy.traits.join(' + ')}
                  </span>
                  <span className="text-sm font-bold text-green-600">
                    {Math.round(synergy.strength * 100)}%
                  </span>
                </div>
                <p className="text-xs text-green-700">{synergy.effect}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trait Conflicts */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Trait Conflicts</h4>
          <div className="space-y-3">
            {data.conflicts.map((conflict, index) => (
              <div key={index} className="p-3 bg-red-50 rounded border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-800">
                    {conflict.traits.join(' vs ')}
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {Math.round(conflict.strength * 100)}%
                  </span>
                </div>
                <p className="text-xs text-red-700">{conflict.effect}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dominant Traits */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Dominant Traits</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Primary: </span>
              <span className="text-sm font-medium">{data.dominance.primary}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Secondary: </span>
              <span className="text-sm font-medium">{data.dominance.secondary}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Influence: </span>
              <span className="text-sm font-medium">{Math.round(data.dominance.influence * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Developmental Timeline Panel Component
interface DevelopmentalTimelinePanelProps {
  data: DevelopmentalData | null | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  error: Error | null;
}

const DevelopmentalTimelinePanel: React.FC<DevelopmentalTimelinePanelProps> = ({
  data,
  isExpanded,
  onToggle,
  error,
}) => {
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Developmental Timeline</h3>
        <p className="text-red-600">Developmental data unavailable</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Developmental Timeline</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Developmental Timeline</h3>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Current Window */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Current Window</h4>
          <div className="p-4 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-blue-800">{data.currentWindow.name}</span>
              {data.currentWindow.criticalPeriod && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                  Critical
                </span>
              )}
            </div>
            <p className="text-sm text-blue-700 mb-3">{data.currentWindow.ageRange}</p>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${data.currentWindow.progress * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {Math.round(data.currentWindow.progress * 100)}% complete
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Milestones</h4>
          <div className="space-y-2">
            {data.milestones.map((milestone, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded ${
                  milestone.completed
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div>
                  <span className={`text-sm font-medium ${
                    milestone.completed ? 'text-green-800' : 'text-gray-700'
                  }`}>
                    {milestone.name}
                  </span>
                  {milestone.date && (
                    <p className="text-xs text-gray-500">{milestone.date}</p>
                  )}
                </div>
                <span className={`text-sm font-bold ${
                  milestone.completed ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {milestone.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Windows */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Upcoming Windows</h4>
          <div className="space-y-2">
            {data.upcomingWindows.map((window, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded">
                <div>
                  <span className="text-sm font-medium text-purple-800">{window.name}</span>
                  <p className="text-xs text-purple-600">{window.ageRange}</p>
                </div>
                <span className="text-xs text-purple-700">Starts in {window.startsIn}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Forecasting Panel Component
interface ForecastingPanelProps {
  data: ForecastData | null | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  error: Error | null;
}

const ForecastingPanel: React.FC<ForecastingPanelProps> = ({
  data,
  isExpanded,
  onToggle,
  error,
}) => {
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Forecasting</h3>
        <p className="text-red-600">Forecast data unavailable</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Forecasting</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Forecasting</h3>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Trait Predictions */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Trait Predictions</h4>
          <div className="space-y-3">
            {data.predictions.map((prediction, index) => (
              <div key={index} className="p-3 bg-indigo-50 rounded border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-indigo-800">{prediction.trait}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-indigo-600">
                      {Math.round(prediction.probability * 100)}%
                    </span>
                    <span className="text-xs text-indigo-500">
                      ({Math.round(prediction.confidence * 100)}% confidence)
                    </span>
                  </div>
                </div>
                <p className="text-xs text-indigo-700">Expected in {prediction.timeframe}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-700 mb-3">Recommendations</h4>
          <div className="space-y-3">
            {data.recommendations.map((recommendation, index) => (
              <div key={index} className="p-3 bg-amber-50 rounded border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800">{recommendation.action}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(recommendation.priority)}`}>
                    {recommendation.priority.charAt(0).toUpperCase() + recommendation.priority.slice(1)} Priority
                  </span>
                </div>
                <p className="text-xs text-amber-700">{recommendation.expectedBenefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Assessment */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Risk Assessment</h4>
          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Overall Risk: </span>
              <span className={`text-sm font-bold ${getRiskColor(data.riskAssessment.overall)}`}>
                {data.riskAssessment.overall.charAt(0).toUpperCase() + data.riskAssessment.overall.slice(1)}
              </span>
            </div>
            <div className="space-y-1">
              {data.riskAssessment.factors.map((factor, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded mr-1 mb-1"
                >
                  {factor}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedEpigeneticDashboard;
