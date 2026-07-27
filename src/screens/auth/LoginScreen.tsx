// user login screen utilizing react-hook-form, zod validation, and firebase auth
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { auth } from '../../services/firebase';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

// validation schema for login credentials
const loginSchema = z.object({
  email: z.string().min(1, 'email is required').email('must be a valid email address'),
  password: z.string().min(6, 'password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { theme, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // attempt authentication with firebase
  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } catch (e: any) {
      let message = 'unable to log in. please check your details.';
      if (e.code === 'auth/invalid-credential') {
        message = 'incorrect email or password.';
      } else if (e.code === 'auth/user-not-found') {
        message = 'no account found with this email.';
      }
      Alert.alert('Authentication Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.container, { padding: spacing.lg }]}>
            <View style={styles.headerContainer}>
              <Text style={[styles.title, { color: theme.text, ...typography.h1 }]}>
                Welcome Back
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted, ...typography.body }]}>
                sign in to connect with your group
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email Address"
                    placeholder="name@example.com"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Password"
                    placeholder="enter your password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.password?.message}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              />

              <Button
                title="Log In"
                onPress={handleSubmit(onSubmit)}
                loading={loading}
                style={styles.submitBtn}
              />
            </View>

            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: theme.textMuted, ...typography.small }]}>
                don't have an account?{' '}
              </Text>
              <Pressable onPress={() => navigation.replace('SignUp')}>
                <Text
                  style={[
                    styles.linkText,
                    { color: theme.primary, ...typography.small, fontWeight: '600' },
                  ]}
                >
                  sign up
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: 32,
  },
  title: {
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.8,
  },
  formContainer: {
    width: '100%',
    marginBottom: 24,
  },
  submitBtn: {
    marginTop: 12,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    textAlign: 'center',
  },
  linkText: {
    textDecorationLine: 'none',
  },
});
