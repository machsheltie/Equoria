import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

/**
 * FoalDevelopmentTab Component
 * Displays foal development progress, activities, and status meters
 * @param {Object} props - Component props
 * @param {number} props.foalId - ID of the foal to display development for
 */
const FoalDevelopmentTab = ({ foalId }) => {
  const [developmentData, setDevelopmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingActivity, setCompletingActivity] = useState(null);

  // Fetch foal development data from API
  const fetchDevelopmentData = useCallback(async () => {
    try {
      const response = await fetch(`/api/foals/${foalId}/development`);
      const data = await response.json();

      if (data.success) {
        setDevelopmentData(data.data);
      } else {
        Alert.alert(
          'Error',
          data.message || 'Failed to load foal development data'
        );
      }
    } catch (error) {
      console.error('Error fetching foal development data:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [foalId]);

  // Initial data load
  useEffect(() => {
    if (foalId) {
      fetchDevelopmentData();
    }
  }, [foalId, fetchDevelopmentData]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDevelopmentData();
  }, [fetchDevelopmentData]);

  // Complete an activity
  const completeActivity = async (activityType) => {
    setCompletingActivity(activityType);

    try {
      const response = await fetch(`/api/foals/${foalId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activityType }),
      });

      const data = await response.json();

      if (data.success) {
        setDevelopmentData(data.data);
        Alert.alert('Activity Completed!', data.message);
      } else {
        Alert.alert('Error', data.message || 'Failed to complete activity');
      }
    } catch (error) {
      console.error('Error completing activity:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setCompletingActivity(null);
    }
  };

  // Progress bar component
  const ProgressBar = ({ current, max, label, color = '#3B82F6' }) => {
    const progress = Math.min(current / max, 1);

    return (
      <View className="mb-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-medium text-gray-700">{label}</Text>
          <Text className="text-sm text-gray-500">
            {current}/{max}
          </Text>
        </View>
        <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
    );
  };

  // Meter component for bonding and stress levels
  const Meter = ({ value, label, color, maxValue = 100 }) => {
    const percentage = Math.min(value / maxValue, 1);

    return (
      <View className="flex-1 mx-2">
        <Text className="text-center text-sm font-medium text-gray-700 mb-2">
          {label}
        </Text>
        <View className="h-32 w-8 bg-gray-200 rounded-full mx-auto relative overflow-hidden">
          <View
            className="absolute bottom-0 w-full rounded-full"
            style={{
              height: `${percentage * 100}%`,
              backgroundColor: color,
            }}
          />
        </View>
        <Text className="text-center text-xs text-gray-500 mt-1">
          {value}/{maxValue}
        </Text>
      </View>
    );
  };

  // Activity card component
  const ActivityCard = ({ activity, onPress, disabled }) => (
    <TouchableOpacity
      className={`p-4 rounded-lg border-2 mb-3 ${
        disabled
          ? 'bg-gray-100 border-gray-300'
          : 'bg-white border-blue-300 shadow-sm'
      }`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Complete ${activity.name} activity`}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text
            className={`font-semibold text-base ${
              disabled ? 'text-gray-500' : 'text-gray-800'
            }`}
          >
            {activity.name}
          </Text>
          <Text
            className={`text-sm mt-1 ${
              disabled ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {activity.description}
          </Text>
          <View className="flex-row mt-2">
            <Text className="text-xs text-green-600 mr-3">
              Bonding: +{activity.bondingRange[0]}-{activity.bondingRange[1]}
            </Text>
            <Text className="text-xs text-orange-600">
              Stress: {activity.stressRange[0] >= 0 ? '+' : ''}
              {activity.stressRange[0]} to{' '}
              {activity.stressRange[1] >= 0 ? '+' : ''}
              {activity.stressRange[1]}
            </Text>
          </View>
        </View>
        {completingActivity === activity.type && (
          <ActivityIndicator size="small" color="#3B82F6" />
        )}
      </View>
    </TouchableOpacity>
  );

  // Activity log item component
  const ActivityLogItem = ({ activity }) => {
    const getOutcomeColor = (outcome) => {
      switch (outcome) {
        case 'excellent':
          return 'text-green-600';
        case 'success':
          return 'text-blue-600';
        case 'challenging':
          return 'text-orange-600';
        default:
          return 'text-gray-600';
      }
    };

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return (
        date.toLocaleDateString() +
        ' ' +
        date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };

    return (
      <View className="p-3 bg-gray-50 rounded-lg mb-2">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="font-medium text-gray-800">
            Day {activity.day}:{' '}
            {activity.activityType
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase())}
          </Text>
          <Text
            className={`text-sm font-medium ${getOutcomeColor(activity.outcome)}`}
          >
            {activity.outcome.charAt(0).toUpperCase() +
              activity.outcome.slice(1)}
          </Text>
        </View>
        <Text className="text-sm text-gray-600 mb-2">
          {activity.description}
        </Text>
        <View className="flex-row justify-between">
          <View className="flex-row">
            <Text className="text-xs text-green-600 mr-3">
              Bonding: {activity.bondingChange >= 0 ? '+' : ''}
              {activity.bondingChange}
            </Text>
            <Text className="text-xs text-orange-600">
              Stress: {activity.stressChange >= 0 ? '+' : ''}
              {activity.stressChange}
            </Text>
          </View>
          <Text className="text-xs text-gray-400">
            {formatDate(activity.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600">Loading foal development...</Text>
      </View>
    );
  }

  if (!developmentData) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-6">
        <Text className="text-lg text-gray-600 text-center">
          No foal development data available
        </Text>
        <TouchableOpacity
          className="mt-4 px-6 py-3 bg-blue-500 rounded-lg"
          onPress={fetchDevelopmentData}
        >
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { foal, development, activityHistory, availableActivities } =
    developmentData;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#3B82F6', '#1E40AF']}
        className="p-6 rounded-b-3xl"
      >
        <Text className="text-2xl font-bold text-white text-center">
          {foal.name}'s Development
        </Text>
        <Text className="text-blue-100 text-center mt-1">
          {foal.breed} • {foal.age} year{foal.age !== 1 ? 's' : ''} old
        </Text>
      </LinearGradient>

      <View className="p-6">
        {/* Progress Section */}
        <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">
            Development Progress
          </Text>
          <ProgressBar
            current={development.currentDay}
            max={development.maxDay}
            label="Development Day"
            color="#10B981"
          />
          <Text className="text-sm text-gray-600 text-center">
            Day {development.currentDay} of {development.maxDay}(
            {development.maxDay - development.currentDay} days remaining)
          </Text>
        </View>

        {/* Status Meters */}
        <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4 text-center">
            Current Status
          </Text>
          <View className="flex-row justify-center">
            <Meter
              value={development.bondingLevel}
              label="Bonding"
              color="#10B981"
            />
            <Meter
              value={development.stressLevel}
              label="Stress"
              color="#EF4444"
            />
          </View>
        </View>

        {/* Available Activities */}
        {availableActivities.length > 0 && (
          <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-800 mb-4">
              Today's Activities (Day {development.currentDay})
            </Text>
            {availableActivities.map((activity) => (
              <ActivityCard
                key={activity.type}
                activity={activity}
                onPress={() => completeActivity(activity.type)}
                disabled={completingActivity === activity.type}
              />
            ))}
          </View>
        )}

        {/* No Activities Available */}
        {availableActivities.length === 0 && (
          <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-800 mb-2">
              Today's Activities
            </Text>
            <Text className="text-gray-600 text-center py-4">
              All activities for today have been completed!
            </Text>
          </View>
        )}

        {/* Activity History */}
        <View className="bg-white rounded-xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">
            Activity History
          </Text>
          {activityHistory.length > 0 ? (
            activityHistory.map((activity) => (
              <ActivityLogItem key={activity.id} activity={activity} />
            ))
          ) : (
            <Text className="text-gray-600 text-center py-4">
              No activities completed yet
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default FoalDevelopmentTab;
