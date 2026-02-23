/**
 * MyGroomsDashboard Component
 *
 * Dashboard for managing all hired grooms and their assignments.
 * Displays groom details, current assignments, bond scores, and salary costs.
 * Integrates with AssignGroomModal for new assignments.
 */

import React, { useState } from 'react';
import { Users, DollarSign, AlertCircle, Calendar, Trash2 } from 'lucide-react';
import AssignGroomModal from './AssignGroomModal';
import GroomPersonalityBadge from './groom/GroomPersonalityBadge';
import GroomPersonalityDisplay from './groom/GroomPersonalityDisplay';
import {
  useUserGrooms,
  useGroomAssignments,
  useGroomSalaries,
  useDeleteAssignment,
  type Groom,
  type GroomAssignment,
  type SalarySummary,
} from '../hooks/api/useGrooms';

interface MyGroomsDashboardProps {
  userId: number;
  groomsData?: Groom[];
  assignmentsData?: GroomAssignment[];
  salaryCostsData?: SalarySummary;
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
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [selectedHorseName, setSelectedHorseName] = useState<string>('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [skillLevelFilter, setSkillLevelFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [expandedPersonalityId, setExpandedPersonalityId] = useState<number | null>(null);

  // Fetch grooms data using centralized hook
  const { data: groomsResponse, isLoading: groomsLoading } = useUserGrooms(userId);

  // Fetch assignments data using centralized hook
  const { data: assignmentsResponse, isLoading: assignmentsLoading } = useGroomAssignments();

  // Fetch salary costs data using centralized hook
  const { data: salaryCostsResponse, isLoading: salaryCostsLoading } = useGroomSalaries();

  // Unassign mutation using centralized hook
  const unassignMutation = useDeleteAssignment();

  // Unwrap data from API responses
  const groomsFromAPI = groomsResponse?.data ?? [];
  const assignmentsFromAPI = assignmentsResponse?.data ?? [];
  const salaryCostsFromAPI = salaryCostsResponse; // Already unwrapped - fetchSalarySummary returns SalarySummary directly

  // Use provided data or fetched data
  const finalGrooms = groomsData || groomsFromAPI;
  const finalAssignments = assignmentsData || assignmentsFromAPI;
  const finalSalaryCosts = salaryCostsData ||
    salaryCostsFromAPI || {
      totalWeeklyCost: 0,
      totalMonthlyCost: 0,
      groomCount: 0,
      breakdown: [],
    };

  // Loading state
  if (!groomsData && (groomsLoading || assignmentsLoading || salaryCostsLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg fantasy-body text-[rgb(148,163,184)]">Loading...</div>
      </div>
    );
  }

  // Empty state
  if (finalGrooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background">
        <Users className="w-16 h-16 text-[rgb(100,130,165)] mb-4" />
        <h2 className="fantasy-title text-2xl text-[rgb(212,168,67)] mb-2">No Grooms Hired</h2>
        <p className="fantasy-body text-[rgb(148,163,184)] text-center max-w-md">
          You haven't hired any grooms yet. Visit the marketplace to hire your first groom!
        </p>
      </div>
    );
  }

  // Get assignments for a specific groom
  const getGroomAssignments = (groomId: number): GroomAssignment[] => {
    return finalAssignments.filter((a) => a.groomId === groomId && a.isActive);
  };

  // Calculate unassigned grooms count
  const unassignedGroomsCount = finalGrooms.filter((groom) => {
    const groomAssignments = getGroomAssignments(groom.id);
    return groomAssignments.length === 0;
  }).length;

  // Handle assign button click
  const handleAssignClick = (_groomId: number) => {
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
    setSelectedHorseId(null);
    setSelectedHorseName('');
  };

  // Filter and sort grooms
  const filteredAndSortedGrooms = finalGrooms
    .filter((groom) => {
      if (skillLevelFilter !== 'all' && groom.skillLevel !== skillLevelFilter) return false;
      if (specialtyFilter !== 'all' && groom.specialty !== specialtyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
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
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="fantasy-title text-4xl text-[rgb(212,168,67)] mb-6">My Grooms</h1>

          {/* Salary Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fantasy-caption text-[rgb(148,163,184)] mb-1">Weekly Cost</p>
                  <p className="fantasy-title text-2xl text-[rgb(220,235,255)]">
                    ${finalSalaryCosts.totalWeeklyCost.toLocaleString()}
                  </p>
                </div>
                <div
                  className="p-3 rounded-full"
                  style={{
                    background: 'rgba(37,99,235,0.15)',
                    border: '1px solid rgba(37,99,235,0.3)',
                  }}
                >
                  <DollarSign className="w-8 h-8 text-[rgb(37,99,235)]" />
                </div>
              </div>
            </div>

            <div className="glass-panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fantasy-caption text-[rgb(148,163,184)] mb-1">Monthly Cost</p>
                  <p className="fantasy-title text-2xl text-[rgb(220,235,255)]">
                    ${finalSalaryCosts.totalMonthlyCost.toLocaleString()}
                  </p>
                </div>
                <div
                  className="p-3 rounded-full"
                  style={{
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                  }}
                >
                  <Calendar className="w-8 h-8 text-[rgb(16,185,129)]" />
                </div>
              </div>
            </div>

            <div className="glass-panel p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fantasy-caption text-[rgb(148,163,184)] mb-1">Total Grooms</p>
                  <p className="fantasy-title text-2xl text-[rgb(220,235,255)]">
                    {finalGrooms.length}
                  </p>
                </div>
                <div
                  className="p-3 rounded-full"
                  style={{
                    background: 'rgba(139,92,246,0.15)',
                    border: '1px solid rgba(139,92,246,0.3)',
                  }}
                >
                  <Users className="w-8 h-8 text-[rgb(139,92,246)]" />
                </div>
              </div>
            </div>
          </div>

          {/* Unassigned Grooms Warning */}
          {unassignedGroomsCount > 0 && (
            <div
              className="border-l-4 p-4 mb-8 rounded-r-lg"
              style={{
                background: 'rgba(212,168,67,0.08)',
                borderLeftColor: 'rgb(212,168,67)',
              }}
            >
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-[rgb(212,168,67)] mr-3 flex-shrink-0" />
                <p className="fantasy-body text-[rgb(220,235,255)]">
                  <span className="font-bold text-[rgb(212,168,67)]">
                    {unassignedGroomsCount} groom{unassignedGroomsCount > 1 ? 's' : ''}
                  </span>{' '}
                  with no assignments — consider assigning them to horses or releasing them to save
                  money.
                </p>
              </div>
            </div>
          )}

          {/* Filters and Sort */}
          <div
            className="flex flex-wrap gap-6 mb-8 p-4 rounded-lg"
            style={{ background: 'rgba(15,35,70,0.5)', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="skill-filter"
                className="fantasy-caption block text-[rgb(148,163,184)] mb-2"
              >
                Filter by Skill Level
              </label>
              <select
                id="skill-filter"
                value={skillLevelFilter}
                onChange={(e) => setSkillLevelFilter(e.target.value)}
                className="celestial-input w-full"
              >
                <option value="all">All Levels</option>
                <option value="novice">Novice</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
                <option value="master">Master</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="specialty-filter"
                className="fantasy-caption block text-[rgb(148,163,184)] mb-2"
              >
                Filter by Specialty
              </label>
              <select
                id="specialty-filter"
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="celestial-input w-full"
              >
                <option value="all">All Specialties</option>
                <option value="foalCare">Foal Care</option>
                <option value="generalCare">General Care</option>
                <option value="training">Training</option>
                <option value="showHandling">Show Handling</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="sort-by"
                className="fantasy-caption block text-[rgb(148,163,184)] mb-2"
              >
                Sort By
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="celestial-input w-full"
              >
                <option value="name">Name</option>
                <option value="salary">Salary</option>
                <option value="slots">Available Slots</option>
              </select>
            </div>
          </div>
        </div>

        {/* Groom Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          data-testid="groom-grid"
        >
          {filteredAndSortedGrooms.map((groom) => {
            const groomAssignments = getGroomAssignments(groom.id);
            const maxAssignments = getMaxAssignments(groom.skillLevel);
            const availableSlots = maxAssignments - groomAssignments.length;
            const isFullyAssigned = availableSlots === 0;

            return (
              <div
                key={groom.id}
                data-testid={`groom-card-${groom.id}`}
                aria-label={`Groom: ${groom.name}`}
                className="glass-panel p-6 hover:shadow-xl transition-all hover:-translate-y-1 group"
              >
                {/* Groom Header */}
                <div className="mb-6">
                  <h3
                    className="fantasy-title text-2xl text-[rgb(220,235,255)] group-hover:text-[rgb(212,168,67)] transition-colors"
                    data-testid="groom-name"
                  >
                    {groom.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-3">
                    <span
                      className="px-3 py-1 text-xs font-bold uppercase tracking-tighter rounded-md"
                      style={{
                        background: 'rgba(100,130,165,0.15)',
                        color: 'rgb(148,163,184)',
                        border: '1px solid rgba(100,130,165,0.3)',
                      }}
                    >
                      {groom.skillLevel}
                    </span>
                    <span
                      className="px-3 py-1 text-xs font-bold uppercase tracking-tighter rounded-md"
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: 'rgb(16,185,129)',
                        border: '1px solid rgba(16,185,129,0.25)',
                      }}
                    >
                      {formatSpecialty(groom.specialty)}
                    </span>
                  </div>
                </div>

                {/* Groom Details */}
                <div
                  className="space-y-3 mb-6 p-4 rounded-lg"
                  style={{
                    background: 'rgba(15,35,70,0.5)',
                    border: '1px solid rgba(37,99,235,0.12)',
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="fantasy-caption text-xs text-[rgb(148,163,184)]">
                      Experience
                    </span>
                    <span className="fantasy-body text-[rgb(220,235,255)] font-bold">
                      {groom.experience} years
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="fantasy-caption text-xs text-[rgb(148,163,184)]">
                      Personality
                    </span>
                    <GroomPersonalityBadge personality={groom.personality} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="fantasy-caption text-xs text-[rgb(148,163,184)]">Salary</span>
                    <span className="fantasy-body text-[rgb(16,185,129)] font-bold">
                      ${groom.sessionRate}/week
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs fantasy-caption text-[rgb(148,163,184)]">
                      <span>Assignments</span>
                      <span>
                        {groomAssignments.length} / {maxAssignments}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: 'rgba(37,99,235,0.15)' }}
                    >
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${(groomAssignments.length / maxAssignments) * 100}%`,
                          background: isFullyAssigned
                            ? 'rgb(100,130,165)'
                            : 'linear-gradient(90deg, rgb(37,99,235), rgb(29,78,216))',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Personality Toggle */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPersonalityId(expandedPersonalityId === groom.id ? null : groom.id)
                    }
                    className="w-full text-left text-xs fantasy-caption text-[rgb(100,130,165)] hover:text-[rgb(212,168,67)] transition-colors flex items-center justify-between py-1"
                    aria-expanded={expandedPersonalityId === groom.id}
                    data-testid={`personality-toggle-${groom.id}`}
                  >
                    <span>Personality Details</span>
                    <span>{expandedPersonalityId === groom.id ? '▲' : '▼'}</span>
                  </button>
                  {expandedPersonalityId === groom.id && (
                    <div className="mt-2" data-testid={`personality-panel-${groom.id}`}>
                      <GroomPersonalityDisplay
                        personality={groom.personality}
                        experience={groom.experience}
                        compact
                      />
                    </div>
                  )}
                </div>

                {/* Assignments */}
                <div className="mb-6">
                  <h4
                    className="fantasy-caption text-[rgb(148,163,184)] mb-3 pb-1"
                    style={{ borderBottom: '1px solid rgba(37,99,235,0.2)' }}
                  >
                    Current Assignments
                  </h4>
                  {groomAssignments.length === 0 ? (
                    <div
                      className="py-4 text-center rounded-lg border-2 border-dashed"
                      style={{ borderColor: 'rgba(37,99,235,0.2)' }}
                    >
                      <p className="fantasy-body text-[rgb(100,130,165)] text-sm italic">
                        Available for Hire
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groomAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between rounded-lg p-3 transition-colors"
                          style={{
                            background: 'rgba(15,35,70,0.4)',
                            border: '1px solid rgba(37,99,235,0.2)',
                          }}
                        >
                          <div className="flex-1">
                            <p className="fantasy-body text-sm font-bold text-[rgb(220,235,255)]">
                              Horse ID: {assignment.horseId}
                            </p>
                            <p className="text-[10px] fantasy-caption text-[rgb(100,130,165)]">
                              Priority: {assignment.priority} |{' '}
                              {new Date(assignment.startDate).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnassignClick(assignment.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full transition-all"
                            title="Unassign Groom"
                          >
                            <Trash2 className="w-4 h-4" />
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
                  className={isFullyAssigned ? 'btn-outline-celestial w-full' : 'btn-cobalt w-full'}
                >
                  {isFullyAssigned ? 'Max Assignments' : 'Assign to Horse'}
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
    </div>
  );
};

export default MyGroomsDashboard;
