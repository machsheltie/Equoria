/**
 * MyGroomsDashboard Component
 * 
 * Dashboard for managing all hired grooms and their assignments.
 * Displays groom details, current assignments, bond scores, and salary costs.
 * Integrates with AssignGroomModal for new assignments.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import AssignGroomModal from './AssignGroomModal';

// TypeScript interfaces
interface Groom {
  id: number;
  firstName: string;
  lastName: string;
  speciality: string;
  skillLevel: string;
  personality: string;
  experience: number;
  sessionRate: number;
  bio: string;
  availability: boolean;
  userId: number;
}

interface Horse {
  id: number;
  name: string;
  age: number;
}

interface Assignment {
  id: number;
  groomId: number;
  foalId: number;
  bondScore: number;
  createdAt: string;
  isActive: boolean;
  priority: number;
  notes: string | null;
  horse: Horse;
}

interface SalaryCostBreakdown {
  groomId: number;
  groomName: string;
  weeklyCost: number;
  assignmentCount: number;
}

interface SalaryCosts {
  weeklyCost: number;
  totalPaid: number;
  groomCount: number;
  breakdown: SalaryCostBreakdown[];
}

interface MyGroomsDashboardProps {
  userId: number;
  groomsData?: Groom[];
  assignmentsData?: Assignment[];
  salaryCostsData?: SalaryCosts;
}

// Helper function to get max assignments by skill level
const getMaxAssignments = (skillLevel: string): number => {
  const maxAssignments: Record<string, number> = {
    novice: 2,
    intermediate: 3,
    expert: 4,
    master: 5,
  };
  return maxAssignments[skillLevel.toLowerCase()] || 2;
};

// Helper function to format specialty display
const formatSpecialty = (specialty: string): string => {
  return specialty.replace(/([A-Z])/g, ' $1').trim();
};

const MyGroomsDashboard: React.FC<MyGroomsDashboardProps> = ({
  userId,
  groomsData,
  assignmentsData,
  salaryCostsData,
}) => {
  const queryClient = useQueryClient();
  const [selectedGroomId, setSelectedGroomId] = useState<number | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [selectedHorseName, setSelectedHorseName] = useState<string>('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [skillLevelFilter, setSkillLevelFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  // Fetch grooms data (conditional based on props)
  const { data: grooms, isLoading: groomsLoading } = useQuery({
    queryKey: ['grooms', userId],
    queryFn: async () => {
      const response = await fetch(`/api/grooms/user/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch grooms');
      const result = await response.json();
      return result.data;
    },
    enabled: !groomsData && typeof fetch !== 'undefined',
  });

  // Fetch assignments data (conditional based on props)
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['groom-assignments', userId],
    queryFn: async () => {
      const response = await fetch('/api/groom-assignments', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch assignments');
      const result = await response.json();
      return result.data;
    },
    enabled: !assignmentsData && typeof fetch !== 'undefined',
  });

  // Fetch salary costs data (conditional based on props)
  const { data: salaryCosts, isLoading: salaryCostsLoading } = useQuery({
    queryKey: ['groom-salary-costs', userId],
    queryFn: async () => {
      const response = await fetch('/api/groom-salaries/summary', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch salary costs');
      const result = await response.json();
      return result.data;
    },
    enabled: !salaryCostsData && typeof fetch !== 'undefined',
  });

  // Unassign mutation
  const unassignMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const response = await fetch(`/api/groom-assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to unassign groom');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groom-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['groom-salary-costs'] });
    },
  });

  // Use provided data or fetched data
  const finalGrooms = groomsData || grooms || [];
  const finalAssignments = assignmentsData || assignments || [];
  const finalSalaryCosts = salaryCostsData || salaryCosts || {
    weeklyCost: 0,
    totalPaid: 0,
    groomCount: 0,
    breakdown: [],
  };

  // Loading state
  if (!groomsData && (groomsLoading || assignmentsLoading || salaryCostsLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Empty state
  if (finalGrooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <Users className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 mb-2">No Grooms Hired</h2>
        <p className="text-gray-600 text-center max-w-md">
          You haven't hired any grooms yet. Visit the marketplace to hire your first groom!
        </p>
      </div>
    );
  }

  // Get assignments for a specific groom
  const getGroomAssignments = (groomId: number): Assignment[] => {
    return finalAssignments.filter((a) => a.groomId === groomId && a.isActive);
  };

  // Calculate unassigned grooms count
  const unassignedGroomsCount = finalGrooms.filter((groom) => {
    const groomAssignments = getGroomAssignments(groom.id);
    return groomAssignments.length === 0;
  }).length;

  // Handle assign button click
  const handleAssignClick = (groomId: number) => {
    setSelectedGroomId(groomId);
    // In a real app, you'd open a horse selection modal here
    // For now, we'll just open the assign modal with a placeholder
    setSelectedHorseId(101); // Placeholder
    setSelectedHorseName('Select a horse'); // Placeholder
    setIsAssignModalOpen(true);
  };

  // Handle unassign button click
  const handleUnassignClick = (assignmentId: number) => {
    if (window.confirm('Are you sure you want to unassign this groom?')) {
      unassignMutation.mutate(assignmentId);
    }
  };

  // Handle assignment complete
  const handleAssignmentComplete = () => {
    setIsAssignModalOpen(false);
    setSelectedGroomId(null);
    setSelectedHorseId(null);
    setSelectedHorseName('');
  };

  // Filter and sort grooms
  const filteredAndSortedGrooms = finalGrooms
    .filter((groom) => {
      if (skillLevelFilter !== 'all' && groom.skillLevel !== skillLevelFilter) return false;
      if (specialtyFilter !== 'all' && groom.speciality !== specialtyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
      if (sortBy === 'salary') {
        return b.sessionRate - a.sessionRate;
      }
      if (sortBy === 'slots') {
        const aSlots = getMaxAssignments(a.skillLevel) - getGroomAssignments(a.id).length;
        const bSlots = getMaxAssignments(b.skillLevel) - getGroomAssignments(b.id).length;
        return bSlots - aSlots;
      }
      return 0;
    });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">My Grooms</h1>

        {/* Salary Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Weekly Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${finalSalaryCosts.weeklyCost.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${finalSalaryCosts.totalPaid.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Grooms</p>
                <p className="text-2xl font-bold text-gray-900">{finalGrooms.length}</p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Unassigned Grooms Warning */}
        {unassignedGroomsCount > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-400 mr-3" />
              <p className="text-sm text-yellow-700">
                {unassignedGroomsCount} groom{unassignedGroomsCount > 1 ? 's' : ''} with no
                assignments - consider assigning them to horses or releasing them to save money.
              </p>
            </div>
          </div>
        )}

        {/* Filters and Sort */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label htmlFor="skill-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Skill Level
            </label>
            <select
              id="skill-filter"
              value={skillLevelFilter}
              onChange={(e) => setSkillLevelFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Levels</option>
              <option value="novice">Novice</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
              <option value="master">Master</option>
            </select>
          </div>

          <div>
            <label htmlFor="specialty-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Specialty
            </label>
            <select
              id="specialty-filter"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Specialties</option>
              <option value="foalCare">Foal Care</option>
              <option value="generalCare">General Care</option>
              <option value="training">Training</option>
              <option value="showHandling">Show Handling</option>
            </select>
          </div>

          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="name">Name</option>
              <option value="salary">Salary</option>
              <option value="slots">Available Slots</option>
            </select>
          </div>
        </div>
      </div>

      {/* Groom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="groom-grid">
        {filteredAndSortedGrooms.map((groom) => {
          const groomAssignments = getGroomAssignments(groom.id);
          const maxAssignments = getMaxAssignments(groom.skillLevel);
          const availableSlots = maxAssignments - groomAssignments.length;
          const isFullyAssigned = availableSlots === 0;

          return (
            <div
              key={groom.id}
              data-testid={`groom-card-${groom.id}`}
              aria-label={`Groom: ${groom.firstName} ${groom.lastName}`}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              {/* Groom Header */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {groom.firstName} {groom.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                    {groom.skillLevel.charAt(0).toUpperCase() + groom.skillLevel.slice(1)}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                    {formatSpecialty(groom.speciality)}
                  </span>
                </div>
              </div>

              {/* Groom Details */}
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Experience:</span> {groom.experience} years
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Salary:</span> ${groom.sessionRate}/week
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Slots:</span> {groomAssignments.length} / {maxAssignments} slots
                </p>
              </div>

              {/* Assignments */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Assignments</h4>
                {groomAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No current assignments</p>
                ) : (
                  <div className="space-y-2">
                    {groomAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between bg-gray-50 rounded p-2"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{assignment.horse.name}</p>
                          <p className="text-xs text-gray-600">
                            Bond: {assignment.bondScore} | Priority: {assignment.priority}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnassignClick(assignment.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Unassign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign Button */}
              <button
                type="button"
                onClick={() => handleAssignClick(groom.id)}
                disabled={isFullyAssigned}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  isFullyAssigned
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Assign to Horse
              </button>
            </div>
          );
        })}
      </div>

      {/* Assign Groom Modal */}
      {isAssignModalOpen && selectedHorseId && (
        <AssignGroomModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          horseId={selectedHorseId}
          horseName={selectedHorseName}
          userId={userId}
          onAssignmentComplete={handleAssignmentComplete}
          availableGrooms={finalGrooms}
        />
      )}
    </div>
  );
};

export default MyGroomsDashboard;

