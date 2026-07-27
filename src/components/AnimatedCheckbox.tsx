import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

interface AnimatedCheckboxProps {
  checked: boolean;
  onPress: () => void;
  isDraft?: boolean;
  theme: any;
}

export function AnimatedCheckbox({ checked, onPress, isDraft, theme }: AnimatedCheckboxProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    // play an instant, crisp spring bounce when checked state changes
    scale.value = 0.8;
    scale.value = withSpring(1, { damping: 8, stiffness: 380 });
  }, [checked]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={
            isDraft
              ? 'time-outline'
              : checked
              ? 'checkbox'
              : 'square-outline'
          }
          size={24}
          color={
            isDraft
              ? theme.warning
              : checked
              ? theme.success
              : theme.primary
          }
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
});
