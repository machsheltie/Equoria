/**
 * MyGroomsDashboardScreen Component
 *
 * React Native component for groom dashboard interface.
 *
 * Features:
 * - Groom roster display with assignment details
 * - Assignment management (assign/unassign functionality)
 * - Filtering by skill level and specialty
 * - Sorting by name, salary, available slots
 * - Salary cost summary display
 * - Unassigned grooms warning
 * - Responsive mobile layout
 * - Accessibility support with proper labels and roles
 *
 * Integrates with backend APIs:
 * - GET /api/grooms/user/:userId - Fetch user's hired grooms
 * - GET /api/groom-assignments - Fetch all assignments
 * - GET /api/groom-salaries/summary - Fetch salary summary
 * - DELETE /api/groom-assignments/:assignmentId - Unassign groom
 *
 * @param {Object} props.groomsData - Array of groom objects
 * @param {Object} props.assignmentsData - Array of assignment objects
 * @param {Object} props.salaryCostsData - Salary costs object
 * @param {Object} props.userData - User data object
 * @param {Function} props.onAssign - Callback function when groom is assigned
 * @param {Function} props.onUnassign - Callback function when groom is unassigned
 * @param {Function} props.onRefresh - Callback function when dashboard is refreshed
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';

const MyGroomsDashboardScreen = ({
  groomsData,
  assignmentsData,
  salaryCostsData,
  userData,
  onAssign,
  onUnassign,
  onRefresh,
}) => {
  // State for filtering and sorting
  const [skillLevelFilter, setSkillLevelFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [tempSkillLevelFilter, setTempSkillLevelFilter] = useState('all');
  const [tempSpecialtyFilter, setTempSpecialtyFilter] = useState('all');

  // Loading state
  if (!groomsData || !assignmentsData || !salaryCostsData) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (groomsData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Grooms</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No grooms hired yet</Text>
          <Text style={styles.emptySubtext}>Visit the marketplace to hire your first groom</Text>
        </View>
      </View>
    );
  }

  // Helper function to get groom assignments
  const getGroomAssignments = (groomId) => {
    return assignmentsData.filter(
      (assignment) => assignment.groomId === groomId && assignment.isActive
    );
  };

  // Helper function to get max assignments based on skill level
  const getMaxAssignments = (skillLevel) => {
    const limits = {
      novice: 1,
      intermediate: 2,
      expert: 3,
      master: 4,
    };
    return limits[skillLevel] || 1;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString()}`;
  };

  // Calculate unassigned grooms count
  const unassignedGroomsCount = groomsData.filter((groom) => {
    const groomAssignments = getGroomAssignments(groom.id);
    return groomAssignments.length === 0;
  }).length;

  // Handle unassign button click
  const handleUnassignClick = (assignmentId, horseName) => {
    Alert.alert(
      'Unassign Groom',
      `Are you sure you want to unassign this groom from ${horseName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: () => {
            if (onUnassign) {
              onUnassign(assignmentId);
            }
          },
        },
      ]
    );
  };

  // Handle filter button click
  const handleFilterClick = () => {
    setTempSkillLevelFilter(skillLevelFilter);
    setTempSpecialtyFilter(specialtyFilter);
    setIsFilterModalOpen(true);
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    setSkillLevelFilter(tempSkillLevelFilter);
    setSpecialtyFilter(tempSpecialtyFilter);
    setIsFilterModalOpen(false);
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setSkillLevelFilter('all');
    setSpecialtyFilter('all');
    setTempSkillLevelFilter('all');
    setTempSpecialtyFilter('all');
    setIsFilterModalOpen(false);
  };

  // Handle sort button click
  const handleSortClick = () => {
    setIsSortModalOpen(true);
  };

  // Handle sort selection
  const handleSortSelection = (sortOption) => {
    setSortBy(sortOption);
    setIsSortModalOpen(false);
  };

  // Filter and sort grooms
  const filteredAndSortedGrooms = groomsData
    .filter((groom) => {
      if (skillLevelFilter !== 'all' && groom.skillLevel !== skillLevelFilter) return false;
      if (specialtyFilter !== 'all' && groom.speciality !== specialtyFilter) return false;
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
    <ScrollView style={styles.container} testID="dashboard-scroll">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Grooms</Text>
      </View>

      {/* Filter and Sort Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleFilterClick}
          testID="filter-button"
        >
          <Text style={styles.controlButtonText}>Filter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleSortClick}
          testID="sort-button"
        >
          <Text style={styles.controlButtonText}>Sort</Text>
        </TouchableOpacity>
      </View>

      {/* Salary Summary */}
      <View style={styles.salarySummary} testID="salary-summary">
        <Text style={styles.salarySummaryTitle}>Salary Summary</Text>
        <View style={styles.salarySummaryRow}>
          <Text style={styles.salarySummaryLabel}>Weekly Cost:</Text>
          <Text style={styles.salarySummaryValue}>
            {formatCurrency(salaryCostsData.weeklyCost)}
          </Text>
        </View>
        <View style={styles.salarySummaryRow}>
          <Text style={styles.salarySummaryLabel}>Total Paid:</Text>
          <Text style={styles.salarySummaryValue}>{formatCurrency(salaryCostsData.totalPaid)}</Text>
        </View>
        <View style={styles.salarySummaryRow}>
          <Text style={styles.salarySummaryLabel}>Groom Count:</Text>
          <Text style={styles.salarySummaryValue}>{salaryCostsData.groomCount}</Text>
        </View>
      </View>

      {/* Unassigned Grooms Warning */}
      {unassignedGroomsCount > 0 && (
        <View style={styles.warningBox} testID="unassigned-warning">
          <Text style={styles.warningText}>
            ⚠️ {unassignedGroomsCount} groom{unassignedGroomsCount > 1 ? 's' : ''} with no
            assignments
          </Text>
          <Text style={styles.warningSubtext}>Assign grooms to horses to maximize their value</Text>
        </View>
      )}

      {/* Groom Grid */}
      <View style={styles.groomGrid} testID="groom-grid">
        {filteredAndSortedGrooms.map((groom) => {
          const groomAssignments = getGroomAssignments(groom.id);
          const maxAssignments = getMaxAssignments(groom.skillLevel);
          const availableSlots = maxAssignments - groomAssignments.length;

          return (
            <View key={groom.id} style={styles.groomCard} testID={`groom-card-${groom.id}`}>
              {/* Groom Header */}
              <View style={styles.groomHeader}>
                <Text style={styles.groomName}>{groom.name}</Text>
                <Text style={styles.groomSkillLevel}>{groom.skillLevel}</Text>
              </View>

              {/* Groom Details */}
              <View style={styles.groomDetails}>
                <Text style={styles.groomDetailText}>Specialty: {groom.speciality}</Text>
                <Text style={styles.groomDetailText}>Experience: {groom.experience} years</Text>
                <Text style={styles.groomDetailText}>
                  Session Rate: {formatCurrency(groom.sessionRate)}
                </Text>
                <Text style={styles.groomDetailText}>
                  Available Slots: {availableSlots}/{maxAssignments}
                </Text>
              </View>

              {/* Assignments */}
              {groomAssignments.length > 0 && (
                <View style={styles.assignmentsSection}>
                  <Text style={styles.assignmentsSectionTitle}>Current Assignments:</Text>
                  {groomAssignments.map((assignment) => (
                    <View
                      key={assignment.id}
                      style={styles.assignmentRow}
                      testID={`assignment-${assignment.id}`}
                    >
                      <View style={styles.assignmentInfo}>
                        <Text style={styles.assignmentHorseName}>{assignment.horse.name}</Text>
                        <Text style={styles.assignmentBondScore}>Bond: {assignment.bondScore}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.unassignButton}
                        onPress={() => handleUnassignClick(assignment.id, assignment.horse.name)}
                        testID={`unassign-button-${assignment.id}`}
                      >
                        <Text style={styles.unassignButtonText}>Unassign</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalOpen}
        transparent={true}
        animationType="slide"
        testID="filter-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Grooms</Text>

            {/* Skill Level Filter */}
            <Text style={styles.filterLabel}>Skill Level:</Text>
            <View style={styles.filterOptions}>
              {['all', 'novice', 'intermediate', 'expert', 'master'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.filterOption,
                    tempSkillLevelFilter === level && styles.filterOptionSelected,
                  ]}
                  onPress={() => setTempSkillLevelFilter(level)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      tempSkillLevelFilter === level && styles.filterOptionTextSelected,
                    ]}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Specialty Filter */}
            <Text style={styles.filterLabel}>Specialty:</Text>
            <View style={styles.filterOptions}>
              {['all', 'foal care', 'training', 'general care', 'show handling'].map(
                (specialty) => (
                  <TouchableOpacity
                    key={specialty}
                    style={[
                      styles.filterOption,
                      tempSpecialtyFilter === specialty && styles.filterOptionSelected,
                    ]}
                    onPress={() => setTempSpecialtyFilter(specialty)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        tempSpecialtyFilter === specialty && styles.filterOptionTextSelected,
                      ]}
                    >
                      {specialty.charAt(0).toUpperCase() + specialty.slice(1)}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={handleResetFilters}>
                <Text style={styles.modalButtonSecondaryText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleApplyFilters}>
                <Text style={styles.modalButtonPrimaryText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={isSortModalOpen} transparent={true} animationType="slide" testID="sort-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort Grooms</Text>

            <TouchableOpacity style={styles.sortOption} onPress={() => handleSortSelection('name')}>
              <Text style={styles.sortOptionText}>Name (A-Z)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOption}
              onPress={() => handleSortSelection('salary')}
            >
              <Text style={styles.sortOptionText}>Salary (High-Low)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOption}
              onPress={() => handleSortSelection('slots')}
            >
              <Text style={styles.sortOptionText}>Available Slots</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setIsSortModalOpen(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  controlButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  salarySummary: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  salarySummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  salarySummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  salarySummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  salarySummaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 12,
    color: '#92400E',
  },
  groomGrid: {
    padding: 16,
  },
  groomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  groomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  groomSkillLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  groomDetails: {
    marginBottom: 12,
  },
  groomDetailText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  assignmentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 12,
  },
  assignmentsSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentHorseName: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  assignmentBondScore: {
    fontSize: 12,
    color: '#6B7280',
  },
  unassignButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  unassignButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterOption: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  filterOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButtonPrimary: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sortOption: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  sortOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});

export default MyGroomsDashboardScreen;
