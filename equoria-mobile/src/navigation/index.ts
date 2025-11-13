/**
 * Navigation exports
 *
 * Centralized export for all navigation-related components, types, and hooks
 */

// Navigators
export { RootNavigator } from './RootNavigator';
export { AuthNavigator } from './AuthNavigator';
export { MainNavigator } from './MainNavigator';

// Types
export type {
  RootStackParamList,
  RootStackScreenProps,
  AuthStackParamList,
  AuthStackScreenProps,
  MainTabParamList,
  MainTabScreenProps,
  HomeStackParamList,
  HomeStackScreenProps,
  SearchStackParamList,
  SearchStackScreenProps,
  MyGroomsStackParamList,
  MyGroomsStackScreenProps,
  ProfileStackParamList,
  ProfileStackScreenProps,
  AllScreenNames,
  LinkingConfig,
  NavigationTheme,
} from './types';

// Hooks
export {
  useRootNavigation,
  useAuthNavigation,
  useHomeNavigation,
  useSearchNavigation,
  useMyGroomsNavigation,
  useProfileNavigation,
  useTypedRoute,
} from './hooks';
