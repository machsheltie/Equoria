import React from 'react';
import { View, Text, Button } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useRootNavigation,
  useAuthNavigation,
  useHomeNavigation,
  useSearchNavigation,
  useMyGroomsNavigation,
  useProfileNavigation,
  useTypedRoute,
} from '../hooks';
import type {
  RootStackParamList,
  AuthStackParamList,
  HomeStackParamList,
  SearchStackParamList,
  MyGroomsStackParamList,
  ProfileStackParamList,
} from '../types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a test navigator with NavigationContainer
 */
function createTestNavigator<T extends Record<string, object | undefined>>(
  ParamList: T,
  screens: Array<{ name: keyof T; component: React.ComponentType<any> }>
) {
  const Stack = createNativeStackNavigator();

  return function TestNavigator() {
    return (
      <NavigationContainer>
        <Stack.Navigator>
          {screens.map((screen) => (
            <Stack.Screen
              key={String(screen.name)}
              name={String(screen.name)}
              component={screen.component}
            />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    );
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Navigation Hooks', () => {
  // ==========================================================================
  // useRootNavigation TESTS
  // ==========================================================================

  describe('useRootNavigation', () => {
    it('should return navigation object', () => {
      const TestScreen = () => {
        const navigation = useRootNavigation();
        return (
          <View testID="test-screen">
            <Text>Test Screen</Text>
            <Text testID="navigation-exists">{navigation ? 'true' : 'false'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<RootStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Auth" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('navigation-exists')).toHaveTextContent('true');
    });

    it('should return navigation with correct type', () => {
      const TestScreen = () => {
        const navigation = useRootNavigation();

        // Type check - these methods should exist
        const hasNavigate = typeof navigation.navigate === 'function';
        const hasGoBack = typeof navigation.goBack === 'function';
        const hasCanGoBack = typeof navigation.canGoBack === 'function';

        return (
          <View testID="test-screen">
            <Text testID="has-navigate">{hasNavigate.toString()}</Text>
            <Text testID="has-go-back">{hasGoBack.toString()}</Text>
            <Text testID="can-go-back">{hasCanGoBack.toString()}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<RootStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Auth" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-navigate')).toHaveTextContent('true');
      expect(getByTestId('has-go-back')).toHaveTextContent('true');
      expect(getByTestId('can-go-back')).toHaveTextContent('true');
    });

    it('should work within NavigationContainer', () => {
      const TestScreen = () => {
        const navigation = useRootNavigation();
        return (
          <View testID="test-screen">
            <Text testID="can-navigate">{navigation.canGoBack().toString()}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<RootStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Auth" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('test-screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // useAuthNavigation TESTS
  // ==========================================================================

  describe('useAuthNavigation', () => {
    it('should return navigation object', () => {
      const TestScreen = () => {
        const navigation = useAuthNavigation();
        return (
          <View testID="test-screen">
            <Text testID="navigation-exists">{navigation ? 'true' : 'false'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<AuthStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Login" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('navigation-exists')).toHaveTextContent('true');
    });

    it('should return navigation with correct type', () => {
      const TestScreen = () => {
        const navigation = useAuthNavigation();

        const hasNavigate = typeof navigation.navigate === 'function';
        const hasGoBack = typeof navigation.goBack === 'function';

        return (
          <View testID="test-screen">
            <Text testID="has-navigate">{hasNavigate.toString()}</Text>
            <Text testID="has-go-back">{hasGoBack.toString()}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<AuthStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Login" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-navigate')).toHaveTextContent('true');
      expect(getByTestId('has-go-back')).toHaveTextContent('true');
    });

    it('should enable navigation to auth screens', async () => {
      const LoginScreen = () => {
        const navigation = useAuthNavigation();
        return (
          <View testID="login-screen">
            <Button
              title="Go to Register"
              onPress={() => navigation.navigate('Register')}
              testID="register-button"
            />
          </View>
        );
      };

      const RegisterScreen = () => (
        <View testID="register-screen">
          <Text>Register</Text>
        </View>
      );

      const Stack = createNativeStackNavigator<AuthStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('login-screen')).toBeOnTheScreen();

      fireEvent.press(getByTestId('register-button'));

      await waitFor(() => {
        expect(getByTestId('register-screen')).toBeOnTheScreen();
      });
    });
  });

  // ==========================================================================
  // useHomeNavigation TESTS
  // ==========================================================================

  describe('useHomeNavigation', () => {
    it('should return navigation object', () => {
      const TestScreen = () => {
        const navigation = useHomeNavigation();
        return (
          <View testID="test-screen">
            <Text testID="navigation-exists">{navigation ? 'true' : 'false'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<HomeStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('navigation-exists')).toHaveTextContent('true');
    });

    it('should return navigation with correct type', () => {
      const TestScreen = () => {
        const navigation = useHomeNavigation();

        const hasNavigate = typeof navigation.navigate === 'function';

        return (
          <View testID="test-screen">
            <Text testID="has-navigate">{hasNavigate.toString()}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<HomeStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-navigate')).toHaveTextContent('true');
    });
  });

  // ==========================================================================
  // useSearchNavigation TESTS
  // ==========================================================================

  describe('useSearchNavigation', () => {
    it('should return navigation object', () => {
      const TestScreen = () => {
        const navigation = useSearchNavigation();
        return (
          <View testID="test-screen">
            <Text testID="navigation-exists">{navigation ? 'true' : 'false'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<SearchStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="Search"
              component={TestScreen}
              initialParams={{ initialFilters: undefined }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('navigation-exists')).toHaveTextContent('true');
    });

    it('should return navigation with correct type', () => {
      const TestScreen = () => {
        const navigation = useSearchNavigation();

        const hasNavigate = typeof navigation.navigate === 'function';

        return (
          <View testID="test-screen">
            <Text testID="has-navigate">{hasNavigate.toString()}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<SearchStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="Search"
              component={TestScreen}
              initialParams={{ initialFilters: undefined }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-navigate')).toHaveTextContent('true');
    });
  });

  // ==========================================================================
  // useMyGroomsNavigation TESTS
  // ==========================================================================

  describe('useMyGroomsNavigation', () => {
    it('should return navigation object', () => {
      const TestScreen = () => {
        const navigation = useMyGroomsNavigation();
        return (
          <View testID="test-screen">
            <Text testID="navigation-exists">{navigation ? 'true' : 'false'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<MyGroomsStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="MyGrooms"
              component={TestScreen}
              initialParams={{ tab: undefined }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('navigation-exists')).toHaveTextContent('true');
    });

    it('should return navigation with correct type', () => {
      const TestScreen = () => {
        const navigation = useMyGroomsNavigation();

        const hasNavigate = typeof navigation.navigate === 'function';

        return (
          <View testID="test-screen">
            <Text testID="has-navigate">{hasNavigate.toString()}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<MyGroomsStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="MyGrooms"
              component={TestScreen}
              initialParams={{ tab: undefined }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-navigate')).toHaveTextContent('true');
    });
  });

  // ==========================================================================
  // useProfileNavigation TESTS
  // ==========================================================================

  describe('useProfileNavigation', () => {
    it('should return navigation object', () => {
      const TestScreen = () => {
        const navigation = useProfileNavigation();
        return (
          <View testID="test-screen">
            <Text testID="navigation-exists">{navigation ? 'true' : 'false'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<ProfileStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Profile" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('navigation-exists')).toHaveTextContent('true');
    });

    it('should return navigation with correct type', () => {
      const TestScreen = () => {
        const navigation = useProfileNavigation();

        const hasNavigate = typeof navigation.navigate === 'function';

        return (
          <View testID="test-screen">
            <Text testID="has-navigate">{hasNavigate.toString()}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<ProfileStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Profile" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-navigate')).toHaveTextContent('true');
    });
  });

  // ==========================================================================
  // useTypedRoute TESTS
  // ==========================================================================

  describe('useTypedRoute', () => {
    it('should return route object with params', () => {
      const TestScreen = () => {
        const route = useTypedRoute<HomeStackParamList, 'GroomDetails'>();
        return (
          <View testID="test-screen">
            <Text testID="groom-id">{route.params?.groomId || 'no-id'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<HomeStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="GroomDetails"
              component={TestScreen}
              initialParams={{ groomId: 'test-123' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('groom-id')).toHaveTextContent('test-123');
    });

    it('should return route with correct param types', () => {
      const TestScreen = () => {
        const route = useTypedRoute<SearchStackParamList, 'GroomDetails'>();
        return (
          <View testID="test-screen">
            <Text testID="groom-id">{route.params?.groomId || 'no-id'}</Text>
            <Text testID="from-screen">{route.params?.fromScreen || 'no-from'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<SearchStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="GroomDetails"
              component={TestScreen}
              initialParams={{ groomId: 'groom-456', fromScreen: 'search' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('groom-id')).toHaveTextContent('groom-456');
      expect(getByTestId('from-screen')).toHaveTextContent('search');
    });

    it('should return route with name', () => {
      const TestScreen = () => {
        const route = useTypedRoute<HomeStackParamList, 'Home'>();
        return (
          <View testID="test-screen">
            <Text testID="route-name">{route.name}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<HomeStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('route-name')).toHaveTextContent('Home');
    });

    it('should handle screens with no params', () => {
      const TestScreen = () => {
        const route = useTypedRoute<AuthStackParamList, 'Login'>();
        return (
          <View testID="test-screen">
            <Text testID="route-name">{route.name}</Text>
            <Text testID="has-params">{route.params ? 'true' : 'false'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<AuthStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Login" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('route-name')).toHaveTextContent('Login');
    });

    it('should handle optional params', () => {
      const TestScreen = () => {
        const route = useTypedRoute<MyGroomsStackParamList, 'MyGrooms'>();
        return (
          <View testID="test-screen">
            <Text testID="tab-param">{route.params?.tab || 'no-tab'}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<MyGroomsStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="MyGrooms"
              component={TestScreen}
              initialParams={{ tab: 'active' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('tab-param')).toHaveTextContent('active');
    });

    it('should handle complex param objects', () => {
      const TestScreen = () => {
        const route = useTypedRoute<SearchStackParamList, 'Search'>();
        return (
          <View testID="test-screen">
            <Text testID="has-filters">
              {route.params?.initialFilters ? 'true' : 'false'}
            </Text>
            <Text testID="skill-level">
              {route.params?.initialFilters?.skillLevel || 'no-skill'}
            </Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<SearchStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="Search"
              component={TestScreen}
              initialParams={{
                initialFilters: {
                  skillLevel: 'expert',
                  specialty: ['dressage'],
                  location: 'New York',
                },
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-filters')).toHaveTextContent('true');
      expect(getByTestId('skill-level')).toHaveTextContent('expert');
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Integration', () => {
    it('should work together in a single component', () => {
      const TestScreen = () => {
        const navigation = useAuthNavigation();
        const route = useTypedRoute<AuthStackParamList, 'Login'>();

        return (
          <View testID="test-screen">
            <Text testID="has-navigation">{navigation ? 'true' : 'false'}</Text>
            <Text testID="has-route">{route ? 'true' : 'false'}</Text>
            <Text testID="route-name">{route.name}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<AuthStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Login" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('has-navigation')).toHaveTextContent('true');
      expect(getByTestId('has-route')).toHaveTextContent('true');
      expect(getByTestId('route-name')).toHaveTextContent('Login');
    });

    it('should enable navigation with params', async () => {
      const HomeScreen = () => {
        const navigation = useHomeNavigation();
        return (
          <View testID="home-screen">
            <Button
              title="View Groom"
              onPress={() => navigation.navigate('GroomDetails', { groomId: 'groom-789' })}
              testID="view-groom-button"
            />
          </View>
        );
      };

      const GroomDetailsScreen = () => {
        const route = useTypedRoute<HomeStackParamList, 'GroomDetails'>();
        return (
          <View testID="groom-details-screen">
            <Text testID="groom-id">{route.params?.groomId}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<HomeStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="GroomDetails" component={GroomDetailsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('home-screen')).toBeOnTheScreen();

      fireEvent.press(getByTestId('view-groom-button'));

      await waitFor(() => {
        expect(getByTestId('groom-details-screen')).toBeOnTheScreen();
        expect(getByTestId('groom-id')).toHaveTextContent('groom-789');
      });
    });
  });

  // ==========================================================================
  // TYPE SAFETY TESTS
  // ==========================================================================

  describe('Type Safety', () => {
    it('should enforce param types at compile time', () => {
      const TestScreen = () => {
        const route = useTypedRoute<HomeStackParamList, 'GroomDetails'>();

        // This should be type-safe - groomId is string
        const groomId: string = route.params?.groomId || '';

        return (
          <View testID="test-screen">
            <Text testID="groom-id">{groomId}</Text>
          </View>
        );
      };

      const Stack = createNativeStackNavigator<HomeStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="GroomDetails"
              component={TestScreen}
              initialParams={{ groomId: 'test-id' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('test-screen')).toBeOnTheScreen();
    });

    it('should enforce navigation param types', () => {
      const TestScreen = () => {
        const navigation = useHomeNavigation();

        // This should be type-safe at compile time
        return (
          <View testID="test-screen">
            <Button
              title="Navigate"
              onPress={() => {
                // TypeScript enforces correct param types
                navigation.navigate('GroomDetails', { groomId: 'test' });
              }}
              testID="navigate-button"
            />
          </View>
        );
      };

      const Stack = createNativeStackNavigator<HomeStackParamList>();
      const { getByTestId } = render(
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={TestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      );

      expect(getByTestId('test-screen')).toBeOnTheScreen();
    });
  });
});
