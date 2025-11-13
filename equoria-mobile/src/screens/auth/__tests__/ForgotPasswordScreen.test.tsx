import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { forgotPassword } from '../../../api/queries/auth';

// Mock the auth API
jest.mock('../../../api/queries/auth', () => ({
  forgotPassword: jest.fn(),
}));

const mockForgotPassword = forgotPassword as jest.MockedFunction<typeof forgotPassword>;

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
  };
});

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockForgotPassword.mockReset();
  });

  const renderForgotPasswordScreen = () => {
    return render(
      <NavigationContainer>
        <ForgotPasswordScreen />
      </NavigationContainer>
    );
  };

  describe('Rendering', () => {
    it('should render email input field', () => {
      renderForgotPasswordScreen();

      expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    });

    it('should render submit button', () => {
      renderForgotPasswordScreen();

      expect(screen.getByText(/send reset link|reset password|submit/i)).toBeTruthy();
    });

    it('should render back to login link', () => {
      renderForgotPasswordScreen();

      expect(screen.getByText(/back to login|return to login/i)).toBeTruthy();
    });

    it('should have email input with email keyboard type', () => {
      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      expect(emailInput.props.keyboardType).toBe('email-address');
    });
  });

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      renderForgotPasswordScreen();

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required|please enter your email/i)).toBeTruthy();
      });
    });

    it('should show error when email is invalid', async () => {
      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email|please enter a valid email/i)).toBeTruthy();
      });
    });

    it('should not show errors when email is valid', async () => {
      mockForgotPassword.mockResolvedValue({
        message: 'Password reset link sent',
      });

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/email is required/i)).toBeNull();
        expect(screen.queryByText(/invalid email/i)).toBeNull();
      });
    });
  });

  describe('Reset Password Functionality', () => {
    it('should call forgotPassword API with correct email', async () => {
      mockForgotPassword.mockResolvedValue({
        message: 'Password reset link sent',
      });

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockForgotPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
        });
      });
    });

    it('should show loading indicator during submission', async () => {
      mockForgotPassword.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  message: 'Password reset link sent',
                }),
              100
            )
          )
      );

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(submitButton);

      expect(screen.getByTestId('loading-indicator')).toBeTruthy();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).toBeNull();
      });
    });

    it('should disable submit button during submission', async () => {
      mockForgotPassword.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  message: 'Password reset link sent',
                }),
              100
            )
          )
      );

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        const button = screen.getByTestId('submit-button');
        expect(button.props.accessibilityState.disabled).toBe(true);
      });

      await waitFor(() => {
        const button = screen.getByTestId('submit-button');
        expect(button.props.accessibilityState.disabled).toBe(false);
      });
    });

    it('should show success message after password reset link is sent', async () => {
      mockForgotPassword.mockResolvedValue({
        message: 'Password reset link sent to your email',
      });

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/password reset link sent|check your email|email sent/i)
        ).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on API failure', async () => {
      mockForgotPassword.mockRejectedValue(new Error('Request failed'));

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed|error|try again/i)).toBeTruthy();
      });
    });

    it('should show error when email not found', async () => {
      mockForgotPassword.mockRejectedValue(new Error('User not found'));

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'nonexistent@example.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/not found|no account|email not registered/i)
        ).toBeTruthy();
      });
    });

    it('should show network error message', async () => {
      mockForgotPassword.mockRejectedValue(new Error('Network request failed'));

      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/network error|connection failed|check your internet/i)
        ).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to login when link is pressed', () => {
      renderForgotPasswordScreen();

      const backLink = screen.getByText(/back to login|return to login/i);
      fireEvent.press(backLink);

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      const submitButton = screen.getByTestId('submit-button');

      expect(emailInput.props.accessibilityLabel).toBeTruthy();
      expect(submitButton.props.accessibilityLabel).toBeTruthy();
    });

    it('should have autocomplete settings', () => {
      renderForgotPasswordScreen();

      const emailInput = screen.getByPlaceholderText(/email/i);
      expect(emailInput.props.autoComplete).toBe('email');
    });
  });
});
