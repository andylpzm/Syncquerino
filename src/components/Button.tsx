// customizable button component styled using theme tokens
import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

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
  let textColor = theme.surface;
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'secondary') {
    backgroundColor = theme.secondary;
    textColor = theme.surface;
  } else if (variant === 'danger') {
    backgroundColor = theme.danger;
    textColor = theme.surface;
  } else if (variant === 'outline') {
    backgroundColor = 'transparent';
    textColor = theme.primary;
    borderColor = theme.primary;
    borderWidth = 1;
  }

  const isBtnDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBtnDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          padding: spacing.md,
          borderRadius: radii.full,
          opacity: isBtnDisabled ? 0.6 : pressed ? 0.9 : 1.0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor, ...typography.body }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
