import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { RegisterScreen } from '../RegisterScreen';
import authReducer from '../../../state/slices/authSlice';
import { register } from '../../../api/queries/auth';
import type { RootState } from '../../../state/store';

// Mock the auth API
jest.mock('../../../api/queries/auth', () => ({
  register: jest.fn(),
}));

const mockRegister = register as jest.MockedFunction<typeof register>;

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: mockReplace,
    }),
  };
});

describe('RegisterScreen', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });

    jest.clearAllMocks();
    mockRegister.mockReset();
  });

  const renderRegisterScreen = () => {
    return render(
      <Provider store={store}>
        <NavigationContainer>
          <RegisterScreen />
        </NavigationContainer>
      </Provider>
    );
  };

  describe('Rendering', () => {
    it('should render registration form with all required inputs', () => {
      renderRegisterScreen();

      expect(screen.getByPlaceholderText(/first name/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/last name/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/^password$/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/confirm password/i)).toBeTruthy();
    });

    it('should render register button', () => {
      renderRegisterScreen();

      const registerButton = screen.getByTestId('register-button');
      expect(registerButton).toBeTruthy();
      expect(screen.getByText(/^register$/i)).toBeTruthy();
    });

    it('should render link to login screen', () => {
      renderRegisterScreen();

      expect(screen.getByText(/^log in$/i)).toBeTruthy();
    });

    it('should have both password inputs with secure text entry', () => {
      renderRegisterScreen();

      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

      expect(passwordInput.props.secureTextEntry).toBe(true);
      expect(confirmPasswordInput.props.secureTextEntry).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should show error when first name is empty', async () => {
      renderRegisterScreen();

      const registerButton = screen.getByTestId('register-button');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/first name is required|please enter your first name/i)).toBeTruthy();
      });
    });

    it('should show error when last name is empty', async () => {
      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/last name is required|please enter your last name/i)).toBeTruthy();
      });
    });

    it('should show error when email is empty', async () => {
      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required|please enter your email/i)).toBeTruthy();
      });
    });

    it('should show error when email is invalid', async () => {
      renderRegisterScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email|please enter a valid email/i)).toBeTruthy();
      });
    });

    it('should show error when password is empty', async () => {
      renderRegisterScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required|please enter your password/i)).toBeTruthy();
      });
    });

    it('should show error when password is too short', async () => {
      renderRegisterScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, '123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least|password too short/i)).toBeTruthy();
      });
    });

    it('should show error when passwords do not match', async () => {
      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password456');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match|passwords must match/i)).toBeTruthy();
      });
    });

    it('should not show errors when form is valid', async () => {
      mockRegister.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
        accessToken: 'token123',
        refreshToken: 'refresh123',
      });

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.queryByText(/is required/i)).toBeNull();
        expect(screen.queryByText(/invalid email/i)).toBeNull();
      });
    });
  });

  describe('Registration Functionality', () => {
    it('should call register API with correct credentials', async () => {
      mockRegister.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
        accessToken: 'token123',
        refreshToken: 'refresh123',
      });

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should show loading indicator during registration', async () => {
      mockRegister.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  user: { id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
                  accessToken: 'token123',
                  refreshToken: 'refresh123',
                }),
              100
            )
          )
      );

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      expect(screen.getByTestId('loading-indicator')).toBeTruthy();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).toBeNull();
      });
    });

    it('should disable register button during submission', async () => {
      mockRegister.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  user: { id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
                  accessToken: 'token123',
                  refreshToken: 'refresh123',
                }),
              100
            )
          )
      );

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        const button = screen.getByTestId('register-button');
        expect(button.props.accessibilityState.disabled).toBe(true);
      });

      await waitFor(() => {
        const button = screen.getByTestId('register-button');
        expect(button.props.accessibilityState.disabled).toBe(false);
      });
    });

    it('should update Redux store on successful registration', async () => {
      mockRegister.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
        accessToken: 'token123',
        refreshToken: 'refresh123',
      });

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        const state = store.getState() as RootState;
        expect(state.auth.user).toEqual({
          id: '1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        });
        expect(state.auth.isAuthenticated).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on registration failure', async () => {
      mockRegister.mockRejectedValue(new Error('Registration failed'));

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/registration failed|error|try again/i)).toBeTruthy();
      });
    });

    it('should show error when email already exists', async () => {
      mockRegister.mockRejectedValue(new Error('Email already exists'));

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(screen.getByText(/email already exists|email is taken|already registered/i)).toBeTruthy();
      });
    });

    it('should show network error message', async () => {
      mockRegister.mockRejectedValue(new Error('Network request failed'));

      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
      const registerButton = screen.getByTestId('register-button');

      fireEvent.changeText(firstNameInput, 'John');
      fireEvent.changeText(lastNameInput, 'Doe');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(registerButton);

      await waitFor(() => {
        expect(
          screen.getByText(/network error|connection failed|check your internet/i)
        ).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to login screen when link is pressed', () => {
      renderRegisterScreen();

      const loginLink = screen.getByText(/log in|sign in/i);
      fireEvent.press(loginLink);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);
      const registerButton = screen.getByTestId('register-button');

      expect(firstNameInput.props.accessibilityLabel).toBeTruthy();
      expect(lastNameInput.props.accessibilityLabel).toBeTruthy();
      expect(emailInput.props.accessibilityLabel).toBeTruthy();
      expect(passwordInput.props.accessibilityLabel).toBeTruthy();
      expect(registerButton.props.accessibilityLabel).toBeTruthy();
    });

    it('should have proper keyboard types', () => {
      renderRegisterScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      expect(emailInput.props.keyboardType).toBe('email-address');
    });

    it('should have autocomplete settings', () => {
      renderRegisterScreen();

      const firstNameInput = screen.getByPlaceholderText(/first name/i);
      const lastNameInput = screen.getByPlaceholderText(/last name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/^password$/i);

      expect(firstNameInput.props.autoComplete).toBe('name-given');
      expect(lastNameInput.props.autoComplete).toBe('name-family');
      expect(emailInput.props.autoComplete).toBe('email');
      expect(passwordInput.props.autoComplete).toBe('password-new');
    });
  });
});
