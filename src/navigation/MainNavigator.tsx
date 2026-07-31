// bottom tabs and setting stack navigators for the logged-in user area
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList, RootStackParamList } from './types';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { GroceryListScreen } from '../screens/main/GroceryListScreen';
import { RemindersScreen } from '../screens/main/RemindersScreen';
import { NotesScreen } from '../screens/main/NotesScreen';
import { GroupSettingsScreen } from '../screens/main/GroupSettingsScreen';
import { GroupSelectScreen } from '../screens/main/GroupSelectScreen';
import { useActiveGroup } from '../context/ActiveGroupContext';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// bottom tab navigator containing dashboard, list pages, and notes
function MainTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string = 'home-outline';
          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Groceries') {
            iconName = focused ? 'cart' : 'cart-outline';
          } else if (route.name === 'Reminders') {
            iconName = focused ? 'checkbox' : 'checkbox-outline';
          } else if (route.name === 'Notes') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          }
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        headerStyle: {
          backgroundColor: theme.surface,
        },
        headerTintColor: theme.text,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Groceries" component={GroceryListScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Notes" component={NotesScreen} />
    </Tab.Navigator>
  );
}

// main stack wrapper for screens accessible when inside a group
export function MainNavigator() {
  const { activeGroup } = useActiveGroup();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName={activeGroup ? 'MainTabs' : 'GroupSelect'}
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      {activeGroup ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="GroupSettings"
            component={GroupSettingsScreen}
            options={{
              headerShown: true,
              title: 'Group Settings',
            }}
          />
          <Stack.Screen
            name="GroupSelect"
            component={GroupSelectScreen}
            options={{
              headerShown: true,
              title: 'Select Group',
            }}
          />
        </>
      ) : (
        <Stack.Screen name="GroupSelect" component={GroupSelectScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}
