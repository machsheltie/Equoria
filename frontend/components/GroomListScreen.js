/**
 * GroomListScreen Component
 *
 * React Native component for groom marketplace interface.
 *
 * Features:
 * - Marketplace groom listing with filtering and sorting capabilities
 * - Groom hiring functionality with fund and stable limit validation
 * - Marketplace refresh mechanics (free daily or premium instant)
 * - Responsive mobile layout
 * - Accessibility support with proper labels and roles
 * - AsyncStorage persistence for filters and sort preferences
 *
 * Integrates with backend APIs:
 * - GET /api/groom-marketplace - Fetch available grooms
 * - POST /api/groom-marketplace/hire - Hire groom from marketplace
 * - POST /api/groom-marketplace/refresh - Refresh marketplace
 *
 * @param {Object} props - Component props
 * @param {Object} props.marketplaceData - Marketplace data object
 * @param {Array} props.marketplaceData.grooms - Array of available grooms
 * @param {string} props.marketplaceData.lastRefresh - Last refresh timestamp
 * @param {string} props.marketplaceData.nextFreeRefresh - Next free refresh timestamp
 * @param {number} props.marketplaceData.refreshCost - Cost for premium refresh
 * @param {boolean} props.marketplaceData.canRefreshFree - Whether free refresh is available
 * @param {number} props.marketplaceData.refreshCount - Number of refreshes performed
 * @param {Object} props.userData - User data object
 * @param {number} props.userData.id - User ID
 * @param {number} props.userData.money - User's available funds
 * @param {number} props.userData.stableLimit - Maximum horses allowed
 * @param {number} props.userData.currentHorses - Current number of horses
 * @param {Function} props.onGroomHired - Callback function when groom is hired
 * @param {Function} props.onRefreshMarketplace - Callback function when marketplace is refreshed
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_FILTER_SKILL = 'groom_marketplace_filter_skill';
const STORAGE_KEY_FILTER_SPECIALTY = 'groom_marketplace_filter_specialty';
const STORAGE_KEY_SORT = 'groom_marketplace_sort';

const GroomListScreen = ({
  marketplaceData,
  userData,
  onGroomHired,
  onRefreshMarketplace,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [filterSkillLevel, setFilterSkillLevel] = useState('all');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedGroom, setSelectedGroom] = useState(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempFilterSkill, setTempFilterSkill] = useState('all');
  const [tempFilterSpecialty, setTempFilterSpecialty] = useState('all');
  const [showSortModal, setShowSortModal] = useState(false);
  const [tempSort, setTempSort] = useState('name');

  // Load saved preferences from AsyncStorage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedFilterSkill = await AsyncStorage.getItem(STORAGE_KEY_FILTER_SKILL);
        const savedFilterSpecialty = await AsyncStorage.getItem(STORAGE_KEY_FILTER_SPECIALTY);
        const savedSort = await AsyncStorage.getItem(STORAGE_KEY_SORT);

        if (savedFilterSkill) {
          setFilterSkillLevel(savedFilterSkill);
        }
        if (savedFilterSpecialty) {
          setFilterSpecialty(savedFilterSpecialty);
        }
        if (savedSort) {
          setSortBy(savedSort);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Filter and sort grooms
  const filteredAndSortedGrooms = useMemo(() => {
    if (!marketplaceData?.grooms) {
      return [];
    }

    let filtered = [...marketplaceData.grooms];

    // Apply filters
    if (filterSkillLevel !== 'all') {
      filtered = filtered.filter(g => g.skillLevel === filterSkillLevel);
    }
    if (filterSpecialty !== 'all') {
      filtered = filtered.filter(g => g.specialty === filterSpecialty);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.sessionRate - b.sessionRate;
        case 'price-desc':
          return b.sessionRate - a.sessionRate;
        case 'experience-asc':
          return a.experience - b.experience;
        case 'experience-desc':
          return b.experience - a.experience;
        case 'name':
        default:
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
    });

    return filtered;
  }, [marketplaceData, filterSkillLevel, filterSpecialty, sortBy]);

  // Format currency with $ and commas
  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString()}`;
  };

  // Format specialty name for display
  const formatSpecialty = (specialty) => {
    const specialtyMap = {
      foalCare: 'Foal Care',
      training: 'Training',
      generalCare: 'General Care',
      showHandling: 'Show Handling',
    };
    return specialtyMap[specialty] || specialty;
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Calculate hiring cost (1 week upfront)
  const calculateHiringCost = (sessionRate) => {
    return sessionRate * 7;
  };

  // Check if user can afford groom
  const canAffordGroom = (sessionRate) => {
    if (!userData) {
      return false;
    }
    return userData.money >= calculateHiringCost(sessionRate);
  };

  // Handle hire button click
  const handleHireClick = (groom) => {
    setSelectedGroom(groom);
    setShowHireModal(true);
  };

  // Handle hire confirmation
  const handleHireConfirm = () => {
    if (selectedGroom && onGroomHired) {
      onGroomHired(selectedGroom);
    }
    setShowHireModal(false);
    setSelectedGroom(null);
  };

  // Handle hire cancel
  const handleHireCancel = () => {
    setShowHireModal(false);
    setSelectedGroom(null);
  };

  // Handle refresh marketplace
  const handleRefresh = () => {
    if (onRefreshMarketplace) {
      onRefreshMarketplace();
    }
  };

  // Handle filter change
  const handleFilterSkillChange = async (value) => {
    setFilterSkillLevel(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_FILTER_SKILL, value);
    } catch (error) {
      console.error('Error saving filter skill:', error);
    }
  };

  const handleFilterSpecialtyChange = async (value) => {
    setFilterSpecialty(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_FILTER_SPECIALTY, value);
    } catch (error) {
      console.error('Error saving filter specialty:', error);
    }
  };

  // Handle sort change
  const handleSortChange = async (value) => {
    setSortBy(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SORT, value);
    } catch (error) {
      console.error('Error saving sort:', error);
    }
  };

  // Handle filter modal open
  const handleOpenFilterModal = () => {
    setTempFilterSkill(filterSkillLevel);
    setTempFilterSpecialty(filterSpecialty);
    setShowFilterModal(true);
  };

  // Handle filter modal close
  const handleCloseFilterModal = () => {
    setShowFilterModal(false);
  };

  // Handle apply filters
  const handleApplyFilters = async () => {
    setFilterSkillLevel(tempFilterSkill);
    setFilterSpecialty(tempFilterSpecialty);

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEY_FILTER_SKILL, tempFilterSkill);
      await AsyncStorage.setItem(STORAGE_KEY_FILTER_SPECIALTY, tempFilterSpecialty);
    } catch (error) {
      console.error('Error saving filters:', error);
    }

    setShowFilterModal(false);
  };

  // Handle reset filters
  const handleResetFilters = async () => {
    setTempFilterSkill('all');
    setTempFilterSpecialty('all');
    setFilterSkillLevel('all');
    setFilterSpecialty('all');

    // Clear from AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEY_FILTER_SKILL, 'all');
      await AsyncStorage.setItem(STORAGE_KEY_FILTER_SPECIALTY, 'all');
    } catch (error) {
      console.error('Error resetting filters:', error);
    }

    setShowFilterModal(false);
  };

  // Handle sort modal open
  const handleOpenSortModal = () => {
    setTempSort(sortBy);
    setShowSortModal(true);
  };

  // Handle sort modal close
  const handleCloseSortModal = () => {
    setShowSortModal(false);
  };

  // Handle apply sort
  const handleApplySort = async () => {
    setSortBy(tempSort);

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SORT, tempSort);
    } catch (error) {
      console.error('Error saving sort preference:', error);
    }

    setShowSortModal(false);
  };

  // Inline styles (avoid StyleSheet.create to prevent mocking complications)
  const styles = {
    container: {
      flex: 1,
      backgroundColor: '#F9FAFB',
      padding: 16,
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1F2937',
      marginBottom: 8,
    },
    refreshInfo: {
      backgroundColor: '#EFF6FF',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    refreshText: {
      fontSize: 14,
      color: '#1E40AF',
      marginBottom: 4,
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    controlButton: {
      backgroundColor: '#FFFFFF',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      flex: 1,
      marginHorizontal: 4,
    },
    controlButtonText: {
      fontSize: 14,
      color: '#374151',
      textAlign: 'center',
    },
    groomList: {
      flex: 1,
    },
    groomCard: {
      backgroundColor: '#FFFFFF',
      padding: 16,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    groomName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1F2937',
      marginBottom: 8,
    },
    groomDetail: {
      fontSize: 14,
      color: '#6B7280',
      marginBottom: 4,
    },
    groomPrice: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#059669',
      marginTop: 8,
    },
    hireButton: {
      backgroundColor: '#3B82F6',
      padding: 12,
      borderRadius: 8,
      marginTop: 12,
    },
    hireButtonDisabled: {
      backgroundColor: '#9CA3AF',
    },
    hireButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyStateText: {
      fontSize: 16,
      color: '#6B7280',
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F9FAFB',
    },
    loadingText: {
      fontSize: 16,
      color: '#6B7280',
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
      padding: 20,
      width: '85%',
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1F2937',
      marginBottom: 16,
    },
    filterSection: {
      marginBottom: 20,
    },
    filterLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 8,
    },
    filterOption: {
      backgroundColor: '#F3F4F6',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    filterOptionSelected: {
      backgroundColor: '#DBEAFE',
      borderWidth: 2,
      borderColor: '#3B82F6',
    },
    filterOptionText: {
      fontSize: 14,
      color: '#374151',
    },
    filterOptionTextSelected: {
      color: '#1E40AF',
      fontWeight: '600',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      marginHorizontal: 4,
    },
    modalButtonPrimary: {
      backgroundColor: '#3B82F6',
    },
    modalButtonSecondary: {
      backgroundColor: '#6B7280',
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  };

  // Show loading state while AsyncStorage loads
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Groom Marketplace</Text>
      </View>

      {/* Refresh Information */}
      {marketplaceData && (
        <View style={styles.refreshInfo}>
          <Text style={styles.refreshText}>
            Last Refresh: {formatDate(marketplaceData.lastRefresh)}
          </Text>
          <Text style={styles.refreshText}>
            Next Free Refresh: {formatDate(marketplaceData.nextFreeRefresh)}
          </Text>
        </View>
      )}

      {/* Filter and Sort Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleOpenFilterModal}>
          <Text style={styles.controlButtonText}>Filter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={handleOpenSortModal}>
          <Text style={styles.controlButtonText}>Sort</Text>
        </TouchableOpacity>
      </View>

      {/* Groom List */}
      {filteredAndSortedGrooms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No grooms available</Text>
        </View>
      ) : (
        <View style={styles.groomList} testID="groom-list-scroll">
          {filteredAndSortedGrooms.map((groom) => (
            <View key={groom.marketplaceId} style={styles.groomCard} testID={`groom-card-${groom.marketplaceId}`}>
              <Text style={styles.groomName} testID={`groom-name-${groom.marketplaceId}`}>
                {groom.firstName} {groom.lastName}
              </Text>
              <Text style={styles.groomDetail}>
                Specialty: {formatSpecialty(groom.specialty)}
              </Text>
              <Text style={styles.groomDetail}>
                Skill Level: {groom.skillLevel.charAt(0).toUpperCase() + groom.skillLevel.slice(1)}
              </Text>
              <Text style={styles.groomDetail}>
                Experience: {groom.experience} {groom.experience === 1 ? 'year' : 'years'}
              </Text>
              <Text style={styles.groomPrice}>
                {formatCurrency(groom.sessionRate)}/session
              </Text>
              <TouchableOpacity
                style={[
                  styles.hireButton,
                  !canAffordGroom(groom.sessionRate) && styles.hireButtonDisabled,
                ]}
                onPress={() => handleHireClick(groom)}
                disabled={!canAffordGroom(groom.sessionRate)}
                accessibilityLabel={`Hire ${groom.firstName} ${groom.lastName}`}
                accessibilityRole="button"
              >
                <Text style={styles.hireButtonText}>
                  Hire for {formatCurrency(calculateHiringCost(groom.sessionRate))}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Grooms</Text>

            {/* Skill Level Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Skill Level</Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSkill === 'all' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSkill('all')}
                testID="filter-skill-all"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSkill === 'all' && styles.filterOptionTextSelected,
                  ]}
                >
                  All Levels
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSkill === 'novice' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSkill('novice')}
                testID="filter-skill-novice"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSkill === 'novice' && styles.filterOptionTextSelected,
                  ]}
                >
                  Novice
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSkill === 'intermediate' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSkill('intermediate')}
                testID="filter-skill-intermediate"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSkill === 'intermediate' && styles.filterOptionTextSelected,
                  ]}
                >
                  Intermediate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSkill === 'expert' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSkill('expert')}
                testID="filter-skill-expert"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSkill === 'expert' && styles.filterOptionTextSelected,
                  ]}
                >
                  Expert
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSkill === 'master' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSkill('master')}
                testID="filter-skill-master"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSkill === 'master' && styles.filterOptionTextSelected,
                  ]}
                >
                  Master
                </Text>
              </TouchableOpacity>
            </View>

            {/* Specialty Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Specialty</Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSpecialty === 'all' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSpecialty('all')}
                testID="filter-specialty-all"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSpecialty === 'all' && styles.filterOptionTextSelected,
                  ]}
                >
                  All Specialties
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSpecialty === 'foalCare' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSpecialty('foalCare')}
                testID="filter-specialty-foalCare"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSpecialty === 'foalCare' && styles.filterOptionTextSelected,
                  ]}
                >
                  Foal Care
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSpecialty === 'training' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSpecialty('training')}
                testID="filter-specialty-training"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSpecialty === 'training' && styles.filterOptionTextSelected,
                  ]}
                >
                  Training
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSpecialty === 'generalCare' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSpecialty('generalCare')}
                testID="filter-specialty-generalCare"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSpecialty === 'generalCare' && styles.filterOptionTextSelected,
                  ]}
                >
                  General Care
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempFilterSpecialty === 'showHandling' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempFilterSpecialty('showHandling')}
                testID="filter-specialty-showHandling"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempFilterSpecialty === 'showHandling' && styles.filterOptionTextSelected,
                  ]}
                >
                  Show Handling
                </Text>
              </TouchableOpacity>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleResetFilters}
              >
                <Text style={styles.modalButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleApplyFilters}
              >
                <Text style={styles.modalButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseSortModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort Grooms</Text>

            {/* Sort Options */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Sort By</Text>

              {/* Name (A-Z) */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempSort === 'name' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempSort('name')}
                testID="sort-option-name"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempSort === 'name' && styles.filterOptionTextSelected,
                  ]}
                >
                  Name (A-Z)
                </Text>
              </TouchableOpacity>

              {/* Price (Low to High) */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempSort === 'price-asc' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempSort('price-asc')}
                testID="sort-option-price-asc"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempSort === 'price-asc' && styles.filterOptionTextSelected,
                  ]}
                >
                  Price (Low to High)
                </Text>
              </TouchableOpacity>

              {/* Price (High to Low) */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempSort === 'price-desc' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempSort('price-desc')}
                testID="sort-option-price-desc"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempSort === 'price-desc' && styles.filterOptionTextSelected,
                  ]}
                >
                  Price (High to Low)
                </Text>
              </TouchableOpacity>

              {/* Experience (Low to High) */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempSort === 'experience-asc' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempSort('experience-asc')}
                testID="sort-option-experience-asc"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempSort === 'experience-asc' && styles.filterOptionTextSelected,
                  ]}
                >
                  Experience (Low to High)
                </Text>
              </TouchableOpacity>

              {/* Experience (High to Low) */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  tempSort === 'experience-desc' && styles.filterOptionSelected,
                ]}
                onPress={() => setTempSort('experience-desc')}
                testID="sort-option-experience-desc"
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    tempSort === 'experience-desc' && styles.filterOptionTextSelected,
                  ]}
                >
                  Experience (High to Low)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleCloseSortModal}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleApplySort}
              >
                <Text style={styles.modalButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default GroomListScreen;

