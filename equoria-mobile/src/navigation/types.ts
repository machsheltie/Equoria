import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ============================================================================
// ROOT NAVIGATOR TYPES
// ============================================================================

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  // Modal screens that appear on top of everything
  Modal?: {
    type: 'booking-confirmation' | 'payment' | 'error';
    data?: Record<string, unknown>;
  };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// ============================================================================
// AUTH NAVIGATOR TYPES
// ============================================================================

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Onboarding?: undefined; // Optional onboarding flow
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

// ============================================================================
// MAIN TAB NAVIGATOR TYPES
// ============================================================================

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  MyGroomsTab: NavigatorScreenParams<MyGroomsStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

// ============================================================================
// HOME STACK TYPES
// ============================================================================

export type HomeStackParamList = {
  Home: undefined;
  GroomDetails: {
    groomId: string;
  };
  BookingDetails: {
    bookingId: string;
  };
  HorseDetails: {
    horseId: string;
  };
  TrainingSession: {
    sessionId: string;
  };
};

export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  NativeStackScreenProps<HomeStackParamList, T>;

// ============================================================================
// SEARCH STACK TYPES
// ============================================================================

export type SearchStackParamList = {
  Search: {
    initialFilters?: {
      skillLevel?: string;
      specialty?: string[];
      location?: string;
    };
  };
  GroomList: {
    filters: {
      skillLevel?: string;
      specialty?: string[];
      location?: string;
      sortBy?: 'rating' | 'price' | 'availability';
    };
  };
  GroomDetails: {
    groomId: string;
    fromScreen?: 'search' | 'home' | 'favorites';
  };
  BookGroom: {
    groomId: string;
    selectedDate?: string;
  };
};

export type SearchStackScreenProps<T extends keyof SearchStackParamList> =
  NativeStackScreenProps<SearchStackParamList, T>;

// ============================================================================
// MY GROOMS STACK TYPES
// ============================================================================

export type MyGroomsStackParamList = {
  MyGrooms: {
    tab?: 'active' | 'pending' | 'completed';
  };
  GroomDetails: {
    groomId: string;
  };
  BookingDetails: {
    bookingId: string;
  };
  LeaveReview: {
    bookingId: string;
    groomId: string;
  };
};

export type MyGroomsStackScreenProps<T extends keyof MyGroomsStackParamList> =
  NativeStackScreenProps<MyGroomsStackParamList, T>;

// ============================================================================
// PROFILE STACK TYPES
// ============================================================================

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
  PaymentMethods: undefined;
  AddPaymentMethod: {
    method: 'card' | 'bank' | 'digital-wallet';
  };
  HorseManagement: undefined;
  AddHorse: undefined;
  EditHorse: {
    horseId: string;
  };
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  Help: undefined;
  ContactSupport: {
    subject?: string;
  };
};

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

// Extract all possible screen names
export type AllScreenNames =
  | keyof RootStackParamList
  | keyof AuthStackParamList
  | keyof MainTabParamList
  | keyof HomeStackParamList
  | keyof SearchStackParamList
  | keyof MyGroomsStackParamList
  | keyof ProfileStackParamList;

// Deep linking configuration type
export type LinkingConfig = {
  prefixes: string[];
  config: {
    screens: Record<string, unknown>;
  };
};

// Navigation theme type
export type NavigationTheme = {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
};

// Global navigation refs (for navigation outside React components)
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
