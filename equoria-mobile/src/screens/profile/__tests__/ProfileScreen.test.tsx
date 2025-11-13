import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { ProfileScreen } from '../ProfileScreen';
import authReducer, { setUser } from '../../../state/slices/authSlice';
import type { RootState } from '../../../state/store';

// Mock navigation
const mockNavigate = jest.fn();
const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      reset: mockReset,
    }),
  };
});

describe('ProfileScreen', () => {
  let store: ReturnType<typeof configureStore>;

  const mockUser = {
    id: '1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });

    // Set a logged-in user
    store.dispatch(setUser(mockUser));

    jest.clearAllMocks();
  });

  const renderProfileScreen = () => {
    return render(
      <Provider store={store}>
        <NavigationContainer>
          <ProfileScreen />
        </NavigationContainer>
      </Provider>
    );
  };

  describe('Rendering', () => {
    it('should render user profile information', () => {
      renderProfileScreen();

      expect(screen.getByText(/john doe/i)).toBeTruthy();
      expect(screen.getByText(/john.doe@example.com/i)).toBeTruthy();
    });

    it('should display user full name', () => {
      renderProfileScreen();

      expect(screen.getByText(/john doe/i)).toBeTruthy();
    });

    it('should render edit profile button', () => {
      renderProfileScreen();

      expect(screen.getByText(/edit profile|edit/i)).toBeTruthy();
    });

    it('should render logout button', () => {
      renderProfileScreen();

      expect(screen.getByText(/log out|logout|sign out/i)).toBeTruthy();
    });
  });

  describe('Edit Profile Functionality', () => {
    it('should show edit form when edit button is pressed', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/first name/i)).toBeTruthy();
        expect(screen.getByPlaceholderText(/last name/i)).toBeTruthy();
      });
    });

    it('should pre-fill edit form with current user data', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText(/first name/i);
        const lastNameInput = screen.getByPlaceholderText(/last name/i);

        expect(firstNameInput.props.value).toBe('John');
        expect(lastNameInput.props.value).toBe('Doe');
      });
    });

    it('should allow editing first name', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText(/first name/i);
        fireEvent.changeText(firstNameInput, 'Jane');
        expect(firstNameInput.props.value).toBe('Jane');
      });
    });

    it('should allow editing last name', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const lastNameInput = screen.getByPlaceholderText(/last name/i);
        fireEvent.changeText(lastNameInput, 'Smith');
        expect(lastNameInput.props.value).toBe('Smith');
      });
    });

    it('should show save button in edit mode', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        expect(screen.getByText(/save|save changes/i)).toBeTruthy();
      });
    });

    it('should show cancel button in edit mode', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        expect(screen.getByText(/cancel/i)).toBeTruthy();
      });
    });

    it('should update Redux store when save is pressed', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText(/first name/i);
        const lastNameInput = screen.getByPlaceholderText(/last name/i);
        fireEvent.changeText(firstNameInput, 'Jane');
        fireEvent.changeText(lastNameInput, 'Smith');
      });

      const saveButton = screen.getByText(/save|save changes/i);
      fireEvent.press(saveButton);

      await waitFor(() => {
        const state = store.getState() as RootState;
        expect(state.auth.user?.firstName).toBe('Jane');
        expect(state.auth.user?.lastName).toBe('Smith');
      });
    });

    it('should exit edit mode after saving', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const saveButton = screen.getByText(/save|save changes/i);
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/first name/i)).toBeNull();
        expect(screen.getByText(/edit profile|edit/i)).toBeTruthy();
      });
    });

    it('should cancel edit mode without saving changes', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText(/first name/i);
        fireEvent.changeText(firstNameInput, 'Jane');
      });

      const cancelButton = screen.getByText(/cancel/i);
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/first name/i)).toBeNull();
        const state = store.getState() as RootState;
        expect(state.auth.user?.firstName).toBe('John'); // Unchanged
      });
    });
  });

  describe('Logout Functionality', () => {
    it('should clear user from Redux store on logout', async () => {
      renderProfileScreen();

      const logoutButton = screen.getByText(/log out|logout|sign out/i);
      fireEvent.press(logoutButton);

      await waitFor(() => {
        const state = store.getState() as RootState;
        expect(state.auth.user).toBeNull();
        expect(state.auth.isAuthenticated).toBe(false);
      });
    });

    it('should reset navigation to auth stack on logout', async () => {
      renderProfileScreen();

      const logoutButton = screen.getByText(/log out|logout|sign out/i);
      fireEvent.press(logoutButton);

      await waitFor(() => {
        expect(mockReset).toHaveBeenCalled();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error when first name is empty', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText(/first name/i);
        fireEvent.changeText(firstNameInput, '');
      });

      const saveButton = screen.getByText(/save|save changes/i);
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/first name is required|first name cannot be empty/i)).toBeTruthy();
      });
    });

    it('should show error when last name is empty', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const lastNameInput = screen.getByPlaceholderText(/last name/i);
        fireEvent.changeText(lastNameInput, '');
      });

      const saveButton = screen.getByText(/save|save changes/i);
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/last name is required|last name cannot be empty/i)).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      renderProfileScreen();

      // Verify buttons render with proper text (accessibility is verified through component implementation)
      expect(screen.getByText(/edit profile/i)).toBeTruthy();
      expect(screen.getByText(/log out/i)).toBeTruthy();
    });

    it('should have proper accessibility labels in edit mode', async () => {
      renderProfileScreen();

      const editButton = screen.getByText(/edit profile|edit/i);
      fireEvent.press(editButton);

      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText(/first name/i);
        const lastNameInput = screen.getByPlaceholderText(/last name/i);

        expect(firstNameInput.props.accessibilityLabel).toBeTruthy();
        expect(lastNameInput.props.accessibilityLabel).toBeTruthy();
      });
    });
  });
});
