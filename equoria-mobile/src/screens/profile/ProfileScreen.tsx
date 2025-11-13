import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { useAppDispatch, useAppSelector } from '../../state/hooks';
import { setUser, clearUser } from '../../state/slices/authSlice';

// Error messages
const ERROR_MESSAGES = {
  FIRST_NAME_REQUIRED: 'First name is required',
  LAST_NAME_REQUIRED: 'Last name is required',
};

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Main: undefined;
};

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FormErrors {
  firstName?: string;
  lastName?: string;
}

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = ERROR_MESSAGES.FIRST_NAME_REQUIRED;
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = ERROR_MESSAGES.LAST_NAME_REQUIRED;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEdit = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    });
    setErrors({});
    setIsEditMode(true);
  };

  const handleSave = () => {
    setErrors({});

    if (!validateForm()) {
      return;
    }

    if (user) {
      const updatedUser = {
        ...user,
        firstName: formData.firstName,
        lastName: formData.lastName,
      };
      dispatch(setUser(updatedUser));
    }

    setIsEditMode(false);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    });
    setErrors({});
    setIsEditMode(false);
  };

  const handleLogout = () => {
    dispatch(clearUser());
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleFirstNameChange = (text: string) => {
    setFormData((prev) => ({ ...prev, firstName: text }));
    if (errors.firstName) {
      setErrors((prev) => ({ ...prev, firstName: undefined }));
    }
  };

  const handleLastNameChange = (text: string) => {
    setFormData((prev) => ({ ...prev, lastName: text }));
    if (errors.lastName) {
      setErrors((prev) => ({ ...prev, lastName: undefined }));
    }
  };

  if (!user) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={styles.title}>No user data</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>Profile</Text>

            {!isEditMode ? (
              // View Mode
              <View style={styles.viewMode}>
                <View style={styles.infoSection}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>
                    {user.firstName} {user.lastName}
                  </Text>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.value}>{user.email}</Text>
                </View>

                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEdit}
                  accessibilityLabel="Edit profile button"
                  accessibilityHint="Press to edit your profile information"
                >
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  accessibilityLabel="Logout button"
                  accessibilityHint="Press to log out of your account"
                >
                  <Text style={styles.logoutButtonText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Edit Mode
              <View style={styles.editMode}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, errors.firstName && styles.inputError]}
                    placeholder="First Name"
                    placeholderTextColor="#999"
                    value={formData.firstName}
                    onChangeText={handleFirstNameChange}
                    autoCapitalize="words"
                    autoCorrect={false}
                    accessibilityLabel="First name input"
                    accessibilityHint="Enter your first name"
                  />
                  {errors.firstName && (
                    <Text style={styles.fieldError}>{errors.firstName}</Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, errors.lastName && styles.inputError]}
                    placeholder="Last Name"
                    placeholderTextColor="#999"
                    value={formData.lastName}
                    onChangeText={handleLastNameChange}
                    autoCapitalize="words"
                    autoCorrect={false}
                    accessibilityLabel="Last name input"
                    accessibilityHint="Enter your last name"
                  />
                  {errors.lastName && (
                    <Text style={styles.fieldError}>{errors.lastName}</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  accessibilityLabel="Save changes button"
                  accessibilityHint="Press to save your profile changes"
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  accessibilityLabel="Cancel button"
                  accessibilityHint="Press to cancel editing"
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 32,
  },
  viewMode: {
    width: '100%',
  },
  infoSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  editMode: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputError: {
    borderColor: '#c33',
  },
  fieldError: {
    color: '#c33',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
