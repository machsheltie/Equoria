/**
 * WeeklySalaryReminder Component
 *
 * React Native component for displaying weekly groom salary reminders.
 *
 * Features:
 * - Displays weekly salary cost and total paid amount
 * - Shows warning for unassigned grooms
 * - Dismissible notification with AsyncStorage persistence
 * - Navigation to groom management screen via callback
 * - Responsive mobile layout
 * - Accessibility support with proper labels and roles
 *
 * Integrates with backend API:
 * - GET /api/groom-salaries/summary - Fetch salary summary data
 *
 * @param {Object} props - Component props
 * @param {Object} props.salarySummaryData - Salary summary data object
 * @param {number} props.salarySummaryData.weeklyCost - Weekly salary cost
 * @param {number} props.salarySummaryData.totalPaid - Total paid this month
 * @param {number} props.salarySummaryData.groomCount - Number of hired grooms
 * @param {number} props.salarySummaryData.unassignedGroomsCount - Number of unassigned grooms
 * @param {Array} props.salarySummaryData.breakdown - Detailed breakdown by groom
 * @param {Function} props.onNavigateToGrooms - Callback function to navigate to groom management
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'salary_reminder_dismissed';

const WeeklySalaryReminder = ({ salarySummaryData, onNavigateToGrooms }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load dismissed state from AsyncStorage on mount
  useEffect(() => {
    const loadDismissedState = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(STORAGE_KEY);
        setIsDismissed(dismissed === 'true');
      } catch (error) {
        console.error('Error loading dismissed state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDismissedState();
  }, []);

  // Handle dismiss button press
  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      setIsDismissed(true);
    } catch (error) {
      console.error('Error saving dismissed state:', error);
    }
  };

  // Handle navigation to groom management
  const handleNavigateToGrooms = () => {
    if (onNavigateToGrooms) {
      onNavigateToGrooms();
    }
  };

  // Don't render if:
  // - Still loading
  // - No data provided
  // - No grooms hired
  // - Previously dismissed
  if (isLoading || !salarySummaryData || salarySummaryData.groomCount === 0 || isDismissed) {
    return null;
  }

  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString();
  };

  // Determine plural vs singular for unassigned grooms
  const unassignedText =
    salarySummaryData.unassignedGroomsCount === 1
      ? '1 groom with no assignments'
      : `${salarySummaryData.unassignedGroomsCount} grooms with no assignments`;

  const styles = {
    container: {
      backgroundColor: '#EFF6FF', // blue-50
      borderLeftWidth: 4,
      borderLeftColor: '#60A5FA', // blue-400
      borderRadius: 8,
      padding: 16,
      marginVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: '#1E3A8A', // blue-900
    },
    dismissButton: {
      padding: 4,
    },
    dismissIcon: {
      fontSize: 20,
      color: '#60A5FA', // blue-400
      fontWeight: 'bold',
    },
    body: {
      marginBottom: 16,
    },
    text: {
      fontSize: 14,
      color: '#1E40AF', // blue-800
      marginBottom: 8,
    },
    boldText: {
      fontWeight: 'bold',
    },
    warningText: {
      fontSize: 14,
      color: '#B45309', // yellow-700
      fontWeight: '500',
      marginTop: 8,
    },
    manageLink: {
      paddingVertical: 8,
    },
    manageLinkText: {
      fontSize: 14,
      color: '#2563EB', // blue-600
      fontWeight: '600',
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Groom Salaries</Text>
          <TouchableOpacity
            onPress={handleDismiss}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Dismiss salary reminder"
            style={styles.dismissButton}
          >
            <Text style={styles.dismissIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.text}>
            You paid{' '}
            <Text style={styles.boldText}>${formatCurrency(salarySummaryData.weeklyCost)}</Text> in
            groom salaries this week.
          </Text>

          <Text style={styles.text}>
            Total paid this month:{' '}
            <Text style={styles.boldText}>${formatCurrency(salarySummaryData.totalPaid)}</Text>
          </Text>

          {salarySummaryData.unassignedGroomsCount > 0 && (
            <Text style={styles.warningText}>
              ⚠️ {unassignedText} - consider assigning them to save money!
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleNavigateToGrooms}
          accessible={true}
          accessibilityRole="button"
          style={styles.manageLink}
        >
          <Text style={styles.manageLinkText}>Manage Grooms →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default WeeklySalaryReminder;
