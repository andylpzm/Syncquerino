// welcome screen containing app branding and links to log in or sign up
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/Button';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

export function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { theme, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { padding: spacing.xl }]}>
        <View style={styles.brandContainer}>
          <Text style={[styles.logoText, { color: theme.primary }]}>⚡</Text>
          <Text style={[styles.title, { color: theme.text, ...typography.display }]}>
            Syncquerino
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted, ...typography.body }]}>
            keep shared needs, groceries, reminders, and notes synced in real time.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Log In"
            onPress={() => navigation.navigate('Login')}
            style={styles.button}
          />
          <Button
            title="Create Account"
            onPress={() => navigation.navigate('SignUp')}
            variant="outline"
            style={styles.button}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 72,
    marginBottom: 16,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    marginVertical: 4,
  },
});
