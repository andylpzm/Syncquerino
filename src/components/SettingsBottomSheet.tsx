// bottom sheet modal component for account profile settings, password reset, email change, and log out
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { auth, db } from '../services/firebase';
import { Button } from './Button';

interface SettingsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function SettingsBottomSheet({
  visible,
  onClose,
  onToast,
}: SettingsBottomSheetProps) {
  const { theme, spacing, radii, typography } = useTheme();

  // account settings editing states
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [loadingAuthAction, setLoadingAuthAction] = useState(false);

  const user = auth.currentUser;
  const userInitials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : user?.email
    ? user.email[0].toUpperCase()
    : 'U';

  // handle user log out
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'are you sure you want to log out of Syncquerino?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            onClose();
            await signOut(auth);
          } catch (e) {
            Alert.alert('Error', 'failed to sign out.');
          }
        },
      },
    ]);
  };

  // update display name in Auth and Firestore
  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('Validation Error', 'please enter a valid name.');
      return;
    }
    if (!user) return;

    setLoadingAuthAction(true);
    try {
      await updateProfile(user, { displayName: newName.trim() });
      await setDoc(doc(db, 'users', user.uid), { name: newName.trim() }, { merge: true });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingName(false);
      setNewName('');
      onToast('Name updated successfully!');
    } catch (e) {
      Alert.alert('Error', 'failed to update display name.');
    } finally {
      setLoadingAuthAction(false);
    }
  };

  // send password reset email via Firebase Auth
  const handleResetPassword = async () => {
    if (!user || !user.email) return;

    try {
      await sendPasswordResetEmail(auth, user.email);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Password Reset Email Sent',
        `we have sent a password reset link to ${user.email}. please check your inbox.`
      );
    } catch (e) {
      Alert.alert('Error', 'failed to send password reset email.');
    }
  };

  // update user email address in Firebase Auth & Firestore
  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || !reauthPassword) {
      Alert.alert('Validation Error', 'please enter your new email and current password.');
      return;
    }
    if (!user || !user.email) return;

    setLoadingAuthAction(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);

      if (typeof verifyBeforeUpdateEmail === 'function') {
        await verifyBeforeUpdateEmail(user, newEmail.trim());
      } else {
        await updateEmail(user, newEmail.trim());
      }

      await setDoc(doc(db, 'users', user.uid), { email: newEmail.trim() }, { merge: true });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingEmail(false);
      setNewEmail('');
      setReauthPassword('');
      Alert.alert(
        'Email Update Initiated',
        `a verification email has been sent to ${newEmail.trim()}. please verify your new address.`
      );
    } catch (e: any) {
      let message = 'failed to update email address.';
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        message = 'incorrect current password. please try again.';
      } else if (e.code === 'auth/email-already-in-use') {
        message = 'this email address is already in use by another account.';
      }
      Alert.alert('Authentication Error', message);
    } finally {
      setLoadingAuthAction(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.bottomSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text, ...typography.h2 }]}>
              Account & Settings
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetList} contentContainerStyle={{ gap: spacing.md }}>
            {/* User Profile Card */}
            <View style={[styles.profileCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: theme.text, ...typography.body }]}>
                  {user?.displayName || 'Syncquerino Roommate'}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.textMuted, ...typography.caption }]}>
                  {user?.email || 'authenticated user'}
                </Text>
              </View>
            </View>

            {/* Action 1: Change Name */}
            <View style={[styles.actionCard, { borderColor: theme.border }]}>
              <Pressable
                style={styles.actionCardHeader}
                onPress={() => setEditingName(!editingName)}
              >
                <Ionicons name="person-outline" size={18} color={theme.primary} />
                <Text style={[styles.actionCardTitle, { color: theme.text, ...typography.body }]}>
                  Change Display Name
                </Text>
              </Pressable>
              {editingName && (
                <View style={styles.formContainer}>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                    placeholder="enter new name"
                    placeholderTextColor={theme.textMuted}
                    maxLength={50}
                    value={newName}
                    onChangeText={setNewName}
                  />
                  <Button
                    title="Update Name"
                    onPress={handleUpdateName}
                    loading={loadingAuthAction}
                    style={{ marginTop: 8 }}
                  />
                </View>
              )}
            </View>

            {/* Action 2: Reset Password */}
            <View style={[styles.actionCard, { borderColor: theme.border }]}>
              <Pressable style={styles.actionCardHeader} onPress={handleResetPassword}>
                <Ionicons name="key-outline" size={18} color={theme.primary} />
                <Text style={[styles.actionCardTitle, { color: theme.text, ...typography.body }]}>
                  Send Password Reset Email
                </Text>
              </Pressable>
            </View>

            {/* Action 3: Change Email */}
            <View style={[styles.actionCard, { borderColor: theme.border }]}>
              <Pressable
                style={styles.actionCardHeader}
                onPress={() => setEditingEmail(!editingEmail)}
              >
                <Ionicons name="mail-outline" size={18} color={theme.primary} />
                <Text style={[styles.actionCardTitle, { color: theme.text, ...typography.body }]}>
                  Change Email Address
                </Text>
              </Pressable>
              {editingEmail && (
                <View style={styles.formContainer}>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                    placeholder="new email address"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newEmail}
                    onChangeText={setNewEmail}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, marginTop: 10 }]}
                    placeholder="current password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    value={reauthPassword}
                    onChangeText={setReauthPassword}
                  />
                  <Button
                    title="Update Email"
                    onPress={handleUpdateEmail}
                    loading={loadingAuthAction}
                    style={{ marginTop: 8 }}
                  />
                </View>
              )}
            </View>

            {/* Action 4: Sign Out Button */}
            <Button
              title="Sign Out"
              onPress={handleSignOut}
              variant="danger"
              style={styles.actionModalBtn}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  sheetList: {
    maxHeight: 350,
  },
  actionModalBtn: {
    marginTop: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  profileName: {
    fontWeight: '700',
  },
  profileEmail: {
    marginTop: 2,
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCardTitle: {
    fontWeight: '600',
    fontSize: 15,
  },
  formContainer: {
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
