/**
 * GroomAssignmentManager Component
 * Manages groom assignments for foals with UI for viewing and managing assignments
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { useGroomManagement } from '../hooks/useGroomManagement';

/**
 * GroomAssignmentManager Component
 * @param {Object} props - Component props
 * @param {number} props.foalId - ID of the foal
 * @param {string} props.foalName - Name of the foal
 * @param {string} props.playerId - ID of the player
 * @param {Function} props.onAssignmentChange - Callback when assignment changes
 */
/**
 * Component to manage groom assignments for a foal.
 *
 * @param {string} foalId - The ID of the foal.
 * @param {string} foalName - The name of the foal.
 * @param {string} playerId - The ID of the player.
 * @param {Function} onAssignmentChange - Callback when assignment changes.
 * @returns {JSX.Element} The GroomAssignmentManager component.
 */
const GroomAssignmentManager = ({ foalId, foalName, playerId, onAssignmentChange }) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showGroomDetails, setShowGroomDetails] = useState(false);
  const [selectedGroom, setSelectedGroom] = useState(null);

  const {
    grooms,
    assignments,
    isLoading,
    error,
    fetchFoalAssignments,
    assignGroom,
    ensureDefaultAssignment,
    getActiveAssignment,
    getGroomById,
    clearError,
    definitions,
  } = useGroomManagement(playerId);

  // Load assignments when component mounts
  useEffect(() => {
    if (foalId) {
      fetchFoalAssignments(foalId);
    }
  }, [foalId, fetchFoalAssignments]);

  // Ensure default assignment if none exists
  useEffect(() => {
    const activeAssignment = getActiveAssignment(foalId);
    if (foalId && !activeAssignment && !isLoading) {
      ensureDefaultAssignment(foalId).catch(console.error);
    }
  }, [foalId, getActiveAssignment, ensureDefaultAssignment, isLoading]);

  const activeAssignment = getActiveAssignment(foalId);
  const activeGroom = activeAssignment ? getGroomById(activeAssignment.groomId) : null;

  // Handle groom assignment
  /**
   * Handles assigning a groom to a foal.
   *
   * @param {string} groomId - The ID of the groom to assign.
   * @returns {Promise<void>} A promise that resolves when assignment is complete.
   */
  const handleAssignGroom = async (groomId) => {
    try {
      await assignGroom(foalId, groomId, { priority: 1 });
      setShowAssignModal(false);
      onAssignmentChange?.();
      Alert.alert('Success', 'Groom assigned successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to assign groom');
    }
  };

  // Get specialty icon
  /**
   * Returns the icon for a given specialty.
   *
   * @param {string} specialty - The specialty key.
   * @returns {string} The corresponding icon.
   */
  const getSpecialtyIcon = (specialty) => {
    const icons = {
      foal_care: '🍼',
      general: '🐎',
      training: '🏃',
      medical: '🏥',
    };
    return icons[specialty] || '👤';
  };

  // Get skill level color
  /**
   * Returns the color class for a given skill level.
   *
   * @param {string} skillLevel - The skill level key.
   * @returns {string} The corresponding color class.
   */
  const getSkillLevelColor = (skillLevel) => {
    const colors = {
      novice: 'text-gray-600',
      intermediate: 'text-blue-600',
      expert: 'text-purple-600',
      master: 'text-gold-600',
    };
    return colors[skillLevel] || 'text-gray-600';
  };

  // Get personality badge color
  /**
   * Returns the color classes for a given personality.
   *
   * @param {string} personality - The personality key.
   * @returns {string} The corresponding badge color classes.
   */
  const getPersonalityColor = (personality) => {
    const colors = {
      gentle: 'bg-green-100 text-green-800',
      energetic: 'bg-orange-100 text-orange-800',
      patient: 'bg-blue-100 text-blue-800',
      strict: 'bg-red-100 text-red-800',
    };
    return colors[personality] || 'bg-gray-100 text-gray-800';
  };

  /**
   * Renders the assignment card showing the current groom assignment.
   *
   * @returns {JSX.Element} The AssignmentCard component.
   */
  const AssignmentCard = () => (
    <View className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-gray-800">Assigned Groom</Text>
        <TouchableOpacity
          onPress={() => setShowAssignModal(true)}
          className="bg-blue-500 rounded-lg px-3 py-1"
        >
          <Text className="text-white text-sm font-medium">
            {activeGroom ? 'Change' : 'Assign'}
const AssignedGroomHeader = ({ activeGroom, onAssign }) => (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-lg font-bold text-gray-800">Assigned Groom</Text>
      <TouchableOpacity onPress={onAssign} className="bg-blue-500 rounded-lg px-3 py-1">
        <Text className="text-white text-sm font-medium">
          {activeGroom ? 'Change' : 'Assign'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const GroomDetails = ({ activeGroom, onSelect }) => (
    <TouchableOpacity onPress={onSelect} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <View className="flex-row items-center">
        <Text className="text-2xl mr-3">{getSpecialtyIcon(activeGroom.speciality)}</Text>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">{activeGroom.name}</Text>
          <Text className="text-gray-600 text-sm">
            {definitions.specialties[activeGroom.speciality]?.name || activeGroom.speciality}
          </Text>
        </TouchableOpacity>
          <View className="flex-row items-center mt-1">
            <View className={`px-2 py-1 rounded-full mr-2 ${getPersonalityColor(activeGroom.personality)}`}>
              <Text className="text-xs font-medium">{activeGroom.personality}</Text>
            </View>
            <Text className={`text-sm font-medium ${getSkillLevelColor(activeGroom.skill_level)}`}>
              {activeGroom.skill_level}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-gray-600 text-sm">${activeGroom.hourly_rate}/hr</Text>
          <Text className="text-gray-500 text-xs">{activeGroom.experience} years exp.</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const NoGroomAssigned = ({ foalName }) => (
    <View className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
      <Text className="text-yellow-800 text-center">
        No groom assigned. Tap "Assign" to select a groom for {foalName}.
      </Text>
    </View>
  );

  const AssignmentInfo = ({ activeAssignment }) => (
    <View className="mt-3 pt-3 border-t border-gray-200">
      <Text className="text-gray-600 text-sm">
        Assigned: {new Date(activeAssignment.startDate).toLocaleDateString()}
      </Text>
      {activeAssignment.notes && (
        <Text className="text-gray-600 text-sm mt-1">Notes: {activeAssignment.notes}</Text>
      )}
    </View>
  );

  const AssignmentCard = () => (
    <View className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4">
      <AssignedGroomHeader activeGroom={activeGroom} onAssign={() => setShowAssignModal(true)} />
      {activeGroom ? (
        <GroomDetails
          activeGroom={activeGroom}
          onSelect={() => {
            setSelectedGroom(activeGroom);
            setShowGroomDetails(true);
          }}
        />
      ) : (
        <View className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <Text className="text-yellow-800 text-center">
            No groom assigned. Tap "Assign" to select a groom for {foalName}.
          </Text>
        </View>
        <NoGroomAssigned foalName={foalName} />
      )}

      {activeAssignment && (
        <View className="mt-3 pt-3 border-t border-gray-200">
          <Text className="text-gray-600 text-sm">
            Assigned: {new Date(activeAssignment.startDate).toLocaleDateString()}
          </Text>
          {activeAssignment.notes && (
            <Text className="text-gray-600 text-sm mt-1">Notes: {activeAssignment.notes}</Text>
          )}
        </View>
      )}
      {activeAssignment && <AssignmentInfo activeAssignment={activeAssignment} />}
    </View>
  );

  /**
   * Renders the modal for selecting and assigning a groom.
   *
   * @returns {JSX.Element} The AssignmentModal component.
   */
  const AssignmentModal = () => (
    <Modal
      visible={showAssignModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAssignModal(false)}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-blue-500 px-4 py-6 pt-12">
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-bold text-xl">Assign Groom</Text>
            <TouchableOpacity
              onPress={() => setShowAssignModal(false)}
              className="bg-white bg-opacity-20 rounded-full w-10 h-10 items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">×</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-white opacity-90 mt-1">Select a groom for {foalName}</Text>
        </View>

        <ScrollView className="flex-1 p-4">
          {grooms.length === 0 ? (
            <View className="bg-gray-50 rounded-lg p-6 text-center">
              <Text className="text-gray-600 text-lg mb-2">No Grooms Available</Text>
              <Text className="text-gray-500">
                You need to hire grooms before you can assign them to foals.
              </Text>
            </View>
          ) : (
            grooms.map((groom) => (
              <TouchableOpacity
                key={groom.id}
                onPress={() => handleAssignGroom(groom.id)}
                className={`bg-white rounded-lg p-4 mb-3 border-2 ${
                  activeGroom?.id === groom.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">{getSpecialtyIcon(groom.speciality)}</Text>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-800">{groom.name}</Text>
                    <Text className="text-gray-600 text-sm">
                      {definitions.specialties[groom.speciality]?.name || groom.speciality}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <View
                        className={`px-2 py-1 rounded-full mr-2 ${getPersonalityColor(groom.personality)}`}
                      >
                        <Text className="text-xs font-medium">{groom.personality}</Text>
                      </View>
                      <Text
                        className={`text-sm font-medium ${getSkillLevelColor(groom.skill_level)}`}
                      >
                        {groom.skill_level}
                      </Text>
                    </View>
                    {groom.bio && (
                      <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>
                        {groom.bio}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-gray-600 text-sm font-medium">
                      ${groom.hourly_rate}/hr
                    </Text>
                    <Text className="text-gray-500 text-xs">{groom.experience} years</Text>
                    {activeGroom?.id === groom.id && (
                      <Text className="text-blue-600 text-xs font-medium mt-1">
                        Currently Assigned
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  /**
   * Renders the modal displaying details of the selected groom.
   *
   * @returns {JSX.Element} The GroomDetailsModal component.
   */
  const GroomDetailsModal = () => (
    <Modal
      visible={showGroomDetails}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowGroomDetails(false)}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-6 pt-12">
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-bold text-xl">Groom Details</Text>
            <TouchableOpacity
              onPress={() => setShowGroomDetails(false)}
              className="bg-white bg-opacity-20 rounded-full w-10 h-10 items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">×</Text>
            </TouchableOpacity>
          </View>
        </View>

        {selectedGroom && (
          <ScrollView className="flex-1 p-4">
            <View className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4">
              <View className="flex-row items-center mb-4">
                <Text className="text-3xl mr-4">{getSpecialtyIcon(selectedGroom.speciality)}</Text>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-800">{selectedGroom.name}</Text>
                  <Text className="text-gray-600">
                    {definitions.specialties[selectedGroom.speciality]?.name ||
                      selectedGroom.speciality}
                  </Text>
                </View>
              </View>

              {selectedGroom.bio && (
                <View className="mb-4">
                  <Text className="text-gray-700">{selectedGroom.bio}</Text>
                </View>
              )}

              <View className="space-y-3">
                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Experience:</Text>
                  <Text className="font-medium">{selectedGroom.experience} years</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Skill Level:</Text>
                  <Text className={`font-medium ${getSkillLevelColor(selectedGroom.skill_level)}`}>
                    {selectedGroom.skill_level}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Personality:</Text>
                  <View
                    className={`px-2 py-1 rounded-full ${getPersonalityColor(selectedGroom.personality)}`}
                  >
                    <Text className="text-xs font-medium">{selectedGroom.personality}</Text>
                  </View>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Hourly Rate:</Text>
                  <Text className="font-medium">${selectedGroom.hourly_rate}/hour</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Hired:</Text>
                  <Text className="font-medium">
                    {new Date(selectedGroom.hired_date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Specialty Details */}
            {definitions.specialties[selectedGroom.speciality] && (
              <View className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <Text className="font-semibold text-blue-800 mb-2">Specialty Benefits</Text>
                <Text className="text-blue-700">
                  {definitions.specialties[selectedGroom.speciality].description}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  if (error) {
    return (
      <View className="bg-red-50 rounded-lg p-4 border border-red-200">
        <Text className="text-red-800 font-medium mb-2">Error Loading Groom Data</Text>
        <Text className="text-red-700 mb-3">{error}</Text>
        <TouchableOpacity
          onPress={clearError}
          className="bg-red-500 rounded-lg py-2 px-4 self-start"
        >
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <AssignmentCard />
      <AssignmentModal />
      <GroomDetailsModal />
    </View>
  );
};

export default GroomAssignmentManager;
