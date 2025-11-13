import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type {
  RootStackParamList,
  AuthStackParamList,
  HomeStackParamList,
  SearchStackParamList,
  MyGroomsStackParamList,
  ProfileStackParamList,
} from './types';

// ============================================================================
// NAVIGATION HOOKS
// ============================================================================

/**
 * Type-safe navigation hook for RootNavigator
 * Use this when navigating between Auth and Main navigators
 */
export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

/**
 * Type-safe navigation hook for AuthNavigator
 * Use this in Login, Register, ForgotPassword screens
 */
export function useAuthNavigation() {
  return useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
}

/**
 * Type-safe navigation hook for HomeStack
 * Use this in Home tab screens
 */
export function useHomeNavigation() {
  return useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
}

/**
 * Type-safe navigation hook for SearchStack
 * Use this in Search tab screens
 */
export function useSearchNavigation() {
  return useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
}

/**
 * Type-safe navigation hook for MyGroomsStack
 * Use this in MyGrooms tab screens
 */
export function useMyGroomsNavigation() {
  return useNavigation<NativeStackNavigationProp<MyGroomsStackParamList>>();
}

/**
 * Type-safe navigation hook for ProfileStack
 * Use this in Profile tab screens
 */
export function useProfileNavigation() {
  return useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
}

// ============================================================================
// ROUTE HOOKS
// ============================================================================

/**
 * Type-safe route hook for getting route params
 *
 * @example
 * // In GroomDetails screen
 * const route = useTypedRoute<HomeStackParamList, 'GroomDetails'>();
 * const { groomId } = route.params; // groomId is typed as string
 */
export function useTypedRoute<
  StackParamList extends Record<string, object | undefined>,
  RouteName extends keyof StackParamList
>() {
  return useRoute<RouteProp<StackParamList, RouteName>>();
}
