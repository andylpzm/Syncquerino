// main entrypoint of the application wrapping the stack with necessary providers
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { ActiveGroupProvider } from './src/context/ActiveGroupContext';
import { StateProvider } from './src/context/StateContext';
import { AppNavigator } from './src/navigation/AppNavigator';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

function MainAppContent() {
  const { isDark } = useTheme();

  return (
    <>
      <AppNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ActiveGroupProvider>
            <StateProvider>
              <MainAppContent />
            </StateProvider>
          </ActiveGroupProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
