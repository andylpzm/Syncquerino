// react context provider and hook to manage colors and theme states (light vs dark mode)
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radii, typography } from './tokens';

type ThemeType = typeof colors.light;
type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextProps {
  theme: ThemeType;
  isDark: boolean;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

// storage key for user choice
const THEME_STORAGE_KEY = '@syncquerino_theme_pref';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  // read theme settings from local storage on mount
  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved) {
          setThemePreferenceState(saved as ThemePreference);
        }
      } catch (e) {
        // fail silently for storage errors
      }
    }
    loadSavedTheme();
  }, []);

  // check if dark mode should be enabled based on user preference or system scheme
  const isDark =
    themePreference === 'system'
      ? systemScheme === 'dark'
      : themePreference === 'dark';

  const theme = isDark ? colors.dark : colors.light;

  // update local state and save preference to disk
  const setThemePreference = async (pref: ThemePreference) => {
    try {
      setThemePreferenceState(pref);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch (e) {
      // fail silently for storage errors
    }
  };

  // toggle between light and dark settings
  const toggleTheme = async () => {
    const nextPref = isDark ? 'light' : 'dark';
    await setThemePreference(nextPref);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        themePreference,
        setThemePreference,
        toggleTheme,
        spacing,
        radii,
        typography,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// custom hook to make accessing theme tokens easier in components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
