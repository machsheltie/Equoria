/**
 * TraitDiscoveryNotification Component
 * Displays trait discovery notifications with animations and details
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';

/**
 * TraitDiscoveryNotification Component
 * @param {Object} props - Component props
 * @param {Object} props.discovery - Discovery result object
 * @param {boolean} props.visible - Whether notification is visible
 * @param {Function} props.onClose - Callback when notification is closed
 * @param {Function} props.onViewDetails - Callback when view details is pressed
 * @param {string} props.horseName - Name of the horse
 */
const TraitDiscoveryNotification = ({
  discovery,
  visible,
  onClose,
  onViewDetails,
  horseName = 'Your Horse',
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  // Animation effects
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!discovery || !visible) return null;

  const { revealed = [], conditions = [], message } = discovery;
  const hasTraits = revealed.length > 0;

  // Get trait type icon
  const getTraitIcon = (trait) => {
    if (!trait.definition) return '🧬';

    switch (trait.definition.type) {
      case 'positive':
        return '✨';
      case 'negative':
        return '⚠️';
      default:
        return '🧬';
    }
  };

  // Get trait type color
  const getTraitColor = (trait) => {
    if (!trait.definition) return 'text-gray-600';

    switch (trait.definition.type) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get rarity badge color
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-purple-100 text-purple-800';
      case 'rare':
        return 'bg-blue-100 text-blue-800';
      case 'common':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const NotificationContent = () => (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
      className="bg-white rounded-lg shadow-lg border border-gray-200 mx-4 my-2"
    >
      {/* Header */}
      <View className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-lg px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-2xl mr-2">🔍</Text>
            <View>
              <Text className="text-white font-bold text-lg">
                {hasTraits ? 'Traits Discovered!' : 'Discovery Check'}
              </Text>
              <Text className="text-white opacity-90 text-sm">{horseName}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="bg-white bg-opacity-20 rounded-full w-8 h-8 items-center justify-center"
          >
            <Text className="text-white font-bold">×</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View className="p-4">
        {hasTraits ? (
          <>
            {/* Discovered Traits */}
            <Text className="text-gray-800 font-semibold mb-3">
              Discovered {revealed.length} new trait
              {revealed.length > 1 ? 's' : ''}:
            </Text>

            <View className="space-y-2 mb-4">
              {revealed.map((trait, index) => (
                <View
                  key={`${trait.trait}-${index}`}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <Text className="text-xl mr-2">
                        {getTraitIcon(trait)}
                      </Text>
                      <View className="flex-1">
                        <Text
                          className={`font-semibold ${getTraitColor(trait)}`}
                        >
                          {trait.definition?.name ||
                            trait.trait.replace(/_/g, ' ')}
                        </Text>
                        {trait.definition?.rarity && (
                          <View className="flex-row items-center mt-1">
                            <View
                              className={`px-2 py-1 rounded-full ${getRarityColor(trait.definition.rarity)}`}
                            >
                              <Text className="text-xs font-medium">
                                {trait.definition.rarity}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {trait.discoveryReason && (
                    <Text className="text-gray-600 text-sm mt-2 italic">
                      Discovered through: {trait.discoveryReason}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </>
        ) : (
          <View className="text-center py-4">
            <Text className="text-gray-600 text-lg mb-2">🔍</Text>
            <Text className="text-gray-800 font-medium">
              {message || 'No new traits discovered at this time'}
            </Text>
            {conditions.length > 0 && (
              <Text className="text-gray-600 text-sm mt-2">
                {conditions.length} discovery condition
                {conditions.length > 1 ? 's' : ''} met
              </Text>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View className="flex-row space-x-2 mt-4">
          {hasTraits && onViewDetails && (
            <TouchableOpacity
              onPress={() => {
                setShowDetails(true);
                onViewDetails(discovery);
              }}
              className="flex-1 bg-blue-500 rounded-lg py-3 px-4"
            >
              <Text className="text-white text-center font-semibold">
                View Details
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onClose}
            className={`${hasTraits ? 'flex-1' : 'w-full'} bg-gray-500 rounded-lg py-3 px-4`}
          >
            <Text className="text-white text-center font-semibold">
              {hasTraits ? 'Continue' : 'Close'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const DetailsModal = () => (
    <Modal
      visible={showDetails}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowDetails(false)}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-6 pt-12">
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-bold text-xl">
              Discovery Details
            </Text>
            <TouchableOpacity
              onPress={() => setShowDetails(false)}
              className="bg-white bg-opacity-20 rounded-full w-10 h-10 items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">×</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-white opacity-90 mt-1">{horseName}</Text>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Discovered Traits Details */}
          {hasTraits && (
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">
                Discovered Traits
              </Text>

              {revealed.map((trait, index) => (
                <View
                  key={`detail-${trait.trait}-${index}`}
                  className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200"
                >
                  <View className="flex-row items-center mb-3">
                    <Text className="text-2xl mr-3">{getTraitIcon(trait)}</Text>
                    <View className="flex-1">
                      <Text
                        className={`font-bold text-lg ${getTraitColor(trait)}`}
                      >
                        {trait.definition?.name ||
                          trait.trait.replace(/_/g, ' ')}
                      </Text>
                      {trait.definition?.rarity && (
                        <View
                          className={`self-start px-2 py-1 rounded-full mt-1 ${getRarityColor(trait.definition.rarity)}`}
                        >
                          <Text className="text-xs font-medium">
                            {trait.definition.rarity}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {trait.definition?.description && (
                    <Text className="text-gray-700 mb-2">
                      {trait.definition.description}
                    </Text>
                  )}

                  {trait.discoveryReason && (
                    <View className="bg-blue-50 rounded p-2 mt-2">
                      <Text className="text-blue-800 text-sm font-medium">
                        Discovery Reason:
                      </Text>
                      <Text className="text-blue-700 text-sm">
                        {trait.discoveryReason}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Discovery Conditions */}
          {conditions.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">
                Discovery Conditions Met
              </Text>

              {conditions.map((condition, index) => (
                <View
                  key={`condition-${index}`}
                  className="bg-green-50 rounded-lg p-3 mb-2 border border-green-200"
                >
                  <Text className="text-green-800 font-medium">
                    {condition.description}
                  </Text>
                  <Text className="text-green-600 text-sm mt-1">
                    Priority: {condition.priority} • Type: {condition.type}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Discovery Message */}
          {message && (
            <View className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <Text className="text-purple-800 font-medium mb-1">
                Discovery Summary
              </Text>
              <Text className="text-purple-700">{message}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <>
      <NotificationContent />
      <DetailsModal />
    </>
  );
};

export default TraitDiscoveryNotification;
