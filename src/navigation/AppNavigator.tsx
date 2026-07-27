// root navigation switcher that directs users based on authentication status
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { useActiveGroup } from '../context/ActiveGroupContext';
import { useTheme } from '../theme/ThemeContext';

export function AppNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { loading: groupLoading } = useActiveGroup();
  const { theme } = useTheme();

  // display loading indicator while restoring authentication session or active group details
  if (authLoading || groupLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <MainNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
