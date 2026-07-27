// customizable button component styled using theme tokens
import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

import { LinearGradient } from 'expo-linear-gradient';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { theme, spacing, radii, typography } = useTheme();

  // compute background and text color based on variant
  let backgroundColor = theme.primary;
  let textColor = '#ffffff';
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'secondary') {
    backgroundColor = theme.secondary;
    textColor = '#ffffff';
  } else if (variant === 'danger') {
    backgroundColor = theme.danger;
    textColor = '#ffffff';
  } else if (variant === 'outline') {
    backgroundColor = 'transparent';
    textColor = theme.primary;
    borderColor = theme.primary;
    borderWidth = 1;
  }

  const isBtnDisabled = disabled || loading;
  const useGradient = variant === 'primary' || variant === 'secondary';
  const gradientColors = (variant === 'primary'
    ? [theme.primary, theme.secondary]
    : ['#10b981', '#06b6d4']) as [string, string, ...string[]]; // emerald to cyan gradient

  return (
    <Pressable
      onPress={onPress}
      disabled={isBtnDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor,
          borderWidth,
          borderRadius: radii.full,
          opacity: isBtnDisabled ? 0.6 : pressed ? 0.9 : 1.0,
        },
        !useGradient && {
          backgroundColor,
          padding: spacing.md,
        },
        style,
      ]}
    >
      {useGradient ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            {
              padding: spacing.md,
              borderRadius: radii.full,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={textColor} size="small" />
          ) : (
            <Text style={[styles.text, { color: textColor, ...typography.body }]}>
              {title}
            </Text>
          )}
        </LinearGradient>
      ) : (
        loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <Text style={[styles.text, { color: textColor, ...typography.body }]}>
            {title}
          </Text>
        )
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  gradient: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
