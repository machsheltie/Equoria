/**
 * CompetitionBrowser Component
 * 
 * Competition browsing interface providing:
 * - Competition listing with filtering and search capabilities
 * - Discipline-based filtering and sorting options
 * - Real-time entry eligibility checking and validation
 * - Competition status updates and entry management
 * - Responsive design with mobile and desktop layouts
 * - Error handling and loading states
 * - Accessibility support with ARIA labels and keyboard navigation
 * 
 * Integrates with backend APIs:
 * - GET /api/competitions - List available competitions
 * - GET /api/competitions/:id/eligibility - Check entry eligibility
 * - POST /api/competitions/:id/enter - Enter horse in competition
 * - GET /api/disciplines - Get available disciplines
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  Calendar, 
  Trophy, 
  DollarSign, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface Competition {
  id: number;
  name: string;
  description: string;
  discipline: string;
  date: string;
  entryDeadline: string;
  prizePool: number;
  entryFee: number;
  maxEntries: number;
  currentEntries: number;
  status: 'upcoming' | 'open' | 'closed' | 'completed';
  requirements: {
    minAge: number;
    maxAge: number;
    minLevel: number;
    requiredTraits?: string[];
  };
}

interface Horse {
  id: number;
  name: string;
  age: number;
  level: number;
  traits: string[];
  eligible: boolean;
  reason?: string;
}

interface EligibilityResponse {
  eligible: boolean;
  horses: Horse[];
  reasons: string[];
}

const CompetitionBrowser: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);

  // Fetch competitions
  const { 
    data: competitions = [], 
    isLoading: competitionsLoading, 
    error: competitionsError 
  } = useQuery<Competition[]>({
    queryKey: ['competitions'],
    queryFn: async () => {
      const response = await fetch('/api/competitions');
      if (!response.ok) {
        throw new Error('Failed to fetch competitions');
      }
      return response.json();
    },
  });

  // Fetch disciplines
  const { 
    data: disciplines = [], 
    isLoading: disciplinesLoading 
  } = useQuery<string[]>({
    queryKey: ['disciplines'],
    queryFn: async () => {
      const response = await fetch('/api/disciplines');
      if (!response.ok) {
        throw new Error('Failed to fetch disciplines');
      }
      return response.json();
    },
  });

  // Fetch eligibility for selected competition
  const { 
    data: eligibility, 
    isLoading: eligibilityLoading 
  } = useQuery<EligibilityResponse>({
    queryKey: ['eligibility', selectedCompetition],
    queryFn: async () => {
      if (!selectedCompetition) return null;
      const response = await fetch(`/api/competitions/${selectedCompetition}/eligibility`);
      if (!response.ok) {
        throw new Error('Failed to fetch eligibility');
      }
      return response.json();
    },
    enabled: !!selectedCompetition,
  });

  // Entry mutation
  const entryMutation = useMutation({
    mutationFn: async ({ competitionId, horseId }: { competitionId: number; horseId: number }) => {
      const response = await fetch(`/api/competitions/${competitionId}/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ horseId }),
      });
      if (!response.ok) {
        throw new Error('Failed to enter competition');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['competitions']);
      queryClient.invalidateQueries(['eligibility']);
    },
  });

  // Filter and sort competitions
  const filteredCompetitions = useMemo(() => {
    let filtered = competitions.filter(competition => {
      const matchesSearch = competition.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           competition.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDiscipline = selectedDiscipline === 'all' || competition.discipline === selectedDiscipline;
      
      return matchesSearch && matchesDiscipline;
    });

    // Sort competitions
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'prize':
          return b.prizePool - a.prizePool;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [competitions, searchQuery, selectedDiscipline, sortBy]);

  // Handle competition entry
  const handleEntry = (competitionId: number, horseId: number) => {
    entryMutation.mutate({ competitionId, horseId });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'closed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'upcoming':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  // Check if mobile view
  const isMobile = window.innerWidth < 768;

  return (
    <main 
      role="main"
      className="competition-browser p-6 max-w-7xl mx-auto"
      data-testid="competition-browser"
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Competition Browser</h1>
        <p className="text-gray-600">Find and enter competitions for your horses</p>
      </div>

      {/* Filters and Search */}
      <div 
        className="bg-white rounded-lg shadow-md p-6 mb-6"
        data-testid="competition-filters"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              role="searchbox"
              aria-label="Search competitions"
              placeholder="Search competitions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Discipline Filter */}
          <div>
            <select
              data-testid="discipline-filter"
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Disciplines</option>
              {disciplines.map((discipline) => (
                <option key={discipline} value={discipline}>
                  {discipline}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Options */}
          <div>
            <select
              data-testid="sort-options"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="prize">Sort by Prize Money</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Competition List */}
      <div 
        className={`competition-list ${isMobile ? 'mobile-view' : 'desktop-view'}`}
        data-testid="competition-list"
      >
        {competitionsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading competitions...</p>
          </div>
        ) : competitionsError ? (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">Failed to load competitions</p>
            <button
              onClick={() => queryClient.invalidateQueries(['competitions'])}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : filteredCompetitions.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No competitions found matching your criteria</p>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}
            data-testid={isMobile ? 'mobile-competition-view' : 'desktop-competition-view'}
          >
            {filteredCompetitions.map((competition) => (
              <div
                key={competition.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {competition.name}
                    </h3>
                    <p className="text-gray-600 text-sm">{competition.discipline}</p>
                  </div>
                  <div className="flex items-center space-x-2" data-testid="competition-status">
                    {getStatusIcon(competition.status)}
                    <span className="text-sm font-medium capitalize">{competition.status}</span>
                  </div>
                </div>

                <p className="text-gray-700 mb-4">{competition.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span>{formatDate(competition.date)}</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                    <span>{formatCurrency(competition.prizePool)}</span>
                  </div>
                  <div className="flex items-center" data-testid="entry-count">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <span>{competition.currentEntries}/{competition.maxEntries} entries</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-gray-400 mr-2" />
                    <span>Entry: {formatDate(competition.entryDeadline)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div data-testid="eligibility-status">
                    {selectedCompetition === competition.id && eligibility ? (
                      <span className={`text-sm font-medium ${
                        eligibility.eligible ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {eligibility.eligible ? 'Horses eligible' : 'No eligible horses'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">Click to check eligibility</span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setSelectedCompetition(competition.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    role="button"
                    aria-label="Enter Competition"
                  >
                    Enter Competition
                  </button>
                </div>

                {/* Eligible Horses */}
                {selectedCompetition === competition.id && eligibility && (
                  <div className="mt-4 pt-4 border-t border-gray-200" data-testid="eligible-horses">
                    <h4 className="font-medium text-gray-900 mb-2">Eligible Horses:</h4>
                    {eligibility.horses.length > 0 ? (
                      <div className="space-y-2">
                        {eligibility.horses.map((horse) => (
                          <div
                            key={horse.id}
                            className="flex justify-between items-center p-2 bg-gray-50 rounded"
                          >
                            <span className="font-medium">{horse.name}</span>
                            <button
                              onClick={() => handleEntry(competition.id, horse.id)}
                              disabled={entryMutation.isLoading}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {entryMutation.isLoading ? 'Entering...' : 'Enter'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm">No eligible horses found</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entry Confirmation */}
      {entryMutation.isSuccess && (
        <div 
          className="fixed bottom-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg"
          data-testid="entry-confirmation"
        >
          <CheckCircle className="w-5 h-5 inline mr-2" />
          Horse entered successfully!
        </div>
      )}
    </main>
  );
};

export default CompetitionBrowser;
