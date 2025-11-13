import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type {
  MainTabParamList,
  HomeStackParamList,
  SearchStackParamList,
  MyGroomsStackParamList,
  ProfileStackParamList,
} from './types';
import { HomeScreen } from '@screens/home/HomeScreen';
import { SearchScreen } from '@screens/search/SearchScreen';
import { MyGroomsScreen } from '@screens/my-grooms/MyGroomsScreen';
import { ProfileScreen } from '@screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const MyGroomsStack = createNativeStackNavigator<MyGroomsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// ============================================================================
// STACK NAVIGATORS FOR EACH TAB
// ============================================================================

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
        }}
      />
    </HomeStack.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <SearchStack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search Grooms',
        }}
        initialParams={{
          initialFilters: undefined,
        }}
      />
    </SearchStack.Navigator>
  );
}

function MyGroomsStackNavigator() {
  return (
    <MyGroomsStack.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <MyGroomsStack.Screen
        name="MyGrooms"
        component={MyGroomsScreen}
        options={{
          title: 'My Grooms',
        }}
        initialParams={{
          tab: undefined,
        }}
      />
    </MyGroomsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </ProfileStack.Navigator>
  );
}

// ============================================================================
// MAIN TAB NAVIGATOR
// ============================================================================

/**
 * MainNavigator - Bottom tab navigator for authenticated users
 * Tabs: Home, Search, MyGrooms, Profile
 * Each tab has its own stack navigator
 */
export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
      initialRouteName="HomeTab"
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStackNavigator}
        options={{
          title: 'Search',
        }}
      />
      <Tab.Screen
        name="MyGroomsTab"
        component={MyGroomsStackNavigator}
        options={{
          title: 'My Grooms',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}
