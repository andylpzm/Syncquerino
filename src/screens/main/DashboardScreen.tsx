// Dashboard screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { auth, db } from '../../services/firebase';
import { GroupsBottomSheet, GroupItem } from '../../components/GroupsBottomSheet';
import { SettingsBottomSheet } from '../../components/SettingsBottomSheet';

import Animated, { FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';

type DashboardNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Dashboard'> &
  NativeStackNavigationProp<RootStackParamList>;

interface DashboardScreenProps {
  navigation: DashboardNavigationProp;
}

export function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { theme, spacing, radii, typography } = useTheme();
  const { activeGroup, setActiveGroup } = useActiveGroup();
  const [counts, setCounts] = useState({ groceries: 0, reminders: 0, notes: 0 });
  const [loading, setLoading] = useState(true);

  // modal visibility states
  const [groupsModalVisible, setGroupsModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // user groups state
  const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // subscribe to items collection for active group stats
  useEffect(() => {
    if (!activeGroup) return;

    const q = query(collection(db, 'items'), where('groupId', '==', activeGroup.id));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let groceryCount = 0;
        let reminderCount = 0;
        let noteCount = 0;

        snapshot.forEach((docSnap) => {
          const item = docSnap.data();
          if (item.category === 'grocery' && item.status === 'active') {
            groceryCount++;
          } else if (item.category === 'reminder' && item.status === 'active') {
            reminderCount++;
          } else if (item.category === 'note') {
            noteCount++;
          }
        });

        setCounts({
          groceries: groceryCount,
          reminders: reminderCount,
          notes: noteCount,
        });
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsubscribe;
  }, [activeGroup]);

  // subscribe to user's joined groups for "My Groups" modal
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    setLoadingGroups(true);
    const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: GroupItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loaded.push({
            id: docSnap.id,
            name: data.name,
            code: data.code,
          });
        });
        setMyGroups(loaded);
        setLoadingGroups(false);
      },
      () => setLoadingGroups(false)
    );

    return unsubscribe;
  }, []);

  // trigger toast banner notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // copy invite code to clipboard with tactile feedback
  const handleCopyCode = async (group: GroupItem) => {
    try {
      await Clipboard.setStringAsync(group.code);
      await Haptics.selectionAsync();
      setCopiedCodeId(group.id);
      showToast(`Invite code ${group.code} copied!`);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch (e) {
      Alert.alert('Error', 'failed to copy code.');
    }
  };

  // switch active household group
  const handleSwitchGroup = async (group: GroupItem) => {
    await Haptics.selectionAsync();
    await setActiveGroup(group);
    setGroupsModalVisible(false);
    showToast(`Switched to ${group.name}`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* toast notification banner */}
      {toastMessage && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          exiting={FadeOutUp.duration(300)}
          style={[styles.toastBanner, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.toastText, { color: '#FFFFFF', ...typography.small }]}>
            {toastMessage}
          </Text>
        </Animated.View>
      )}

      <View style={[styles.container, { padding: spacing.lg }]}>
        {/* top navigation header */}
        <View style={styles.topHeader}>
          {/* left: Group Dropdown Switcher Button */}
          <Pressable
            onPress={() => setGroupsModalVisible(true)}
            style={({ pressed }) => [
              styles.groupDropdownBtn,
              { opacity: pressed ? 0.75 : 1.0 },
            ]}
          >
            <Text style={[styles.groupDropdownKicker, { color: theme.primary, ...typography.small, fontWeight: '700', letterSpacing: 1 }]}>
              ACTIVE CIRCLE
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.groupDropdownTitle, { color: theme.text, ...typography.h1 }]} numberOfLines={1}>
                {activeGroup?.name || 'Syncquerino'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.primary} />
            </View>
          </Pressable>

          {/* right: Round Settings Button */}
          <Pressable
            onPress={() => setSettingsModalVisible(true)}
            style={({ pressed }) => [
              styles.floatingRoundBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1.0,
              },
            ]}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </Pressable>
        </View>

        {/* dashboard stats card container */}
        <View style={styles.statsGrid}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
          ) : (
            <>
              {/* groceries counter - tap to navigate */}
              <Pressable onPress={() => navigation.navigate('Groceries')}>
                {({ pressed }) => (
                  <Animated.View
                    entering={FadeInDown.delay(100).duration(400).springify()}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        borderRadius: radii.lg,
                        opacity: pressed ? 0.85 : 1.0,
                      },
                    ]}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={[styles.iconBadge, { backgroundColor: theme.primary + '18' }]}>
                        <Ionicons name="cart-outline" size={22} color={theme.primary} />
                      </View>
                      <View style={styles.cardCounterBox}>
                        <Text style={[styles.cardNum, { color: theme.primary, ...typography.display }]}>
                          {counts.groceries}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                      </View>
                    </View>
                    <Text style={[styles.cardLabel, { color: theme.text, ...typography.body }]}>
                      Groceries
                    </Text>
                    <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.caption }]}>
                      Active items on shopping list
                    </Text>
                  </Animated.View>
                )}
              </Pressable>

              {/* reminders counter - tap to navigate */}
              <Pressable onPress={() => navigation.navigate('Reminders')}>
                {({ pressed }) => (
                  <Animated.View
                    entering={FadeInDown.delay(200).duration(400).springify()}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        borderRadius: radii.lg,
                        opacity: pressed ? 0.85 : 1.0,
                      },
                    ]}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={[styles.iconBadge, { backgroundColor: theme.secondary + '18' }]}>
                        <Ionicons name="checkbox-outline" size={22} color={theme.secondary} />
                      </View>
                      <View style={styles.cardCounterBox}>
                        <Text style={[styles.cardNum, { color: theme.secondary, ...typography.display }]}>
                          {counts.reminders}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                      </View>
                    </View>
                    <Text style={[styles.cardLabel, { color: theme.text, ...typography.body }]}>
                      Chores & Tasks
                    </Text>
                    <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.caption }]}>
                      Pending shared responsibilities
                    </Text>
                  </Animated.View>
                )}
              </Pressable>

              {/* whiteboard notes counter - tap to navigate */}
              <Pressable onPress={() => navigation.navigate('Notes')}>
                {({ pressed }) => (
                  <Animated.View
                    entering={FadeInDown.delay(300).duration(400).springify()}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        borderRadius: radii.lg,
                        opacity: pressed ? 0.85 : 1.0,
                      },
                    ]}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={[styles.iconBadge, { backgroundColor: theme.text + '12' }]}>
                        <Ionicons name="document-text-outline" size={22} color={theme.text} />
                      </View>
                      <View style={styles.cardCounterBox}>
                        <Text style={[styles.cardNum, { color: theme.text, ...typography.display }]}>
                          {counts.notes}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                      </View>
                    </View>
                    <Text style={[styles.cardLabel, { color: theme.text, ...typography.body }]}>
                      Whiteboard Notes
                    </Text>
                    <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.caption }]}>
                      Bulletins & photos on shared board
                    </Text>
                  </Animated.View>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Modular Bottom Sheet 1: My Groups */}
      <GroupsBottomSheet
        visible={groupsModalVisible}
        onClose={() => setGroupsModalVisible(false)}
        myGroups={myGroups}
        activeGroupId={activeGroup?.id}
        loadingGroups={loadingGroups}
        onSelectGroup={handleSwitchGroup}
        onCopyCode={handleCopyCode}
        copiedCodeId={copiedCodeId}
        onCreateOrJoin={() => {
          setGroupsModalVisible(false);
          navigation.navigate('GroupSelect');
        }}
      />

      {/* Modular Bottom Sheet 2: Account Settings */}
      <SettingsBottomSheet
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        onToast={showToast}
        onOpenGroupSettings={() => navigation.navigate('GroupSettings')}
      />
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
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
  },
  groupDropdownBtn: {
    flex: 1,
    paddingRight: 12,
  },
  groupDropdownKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  groupDropdownTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  floatingRoundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statsGrid: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  spinner: {
    alignSelf: 'center',
  },
  card: {
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCounterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardNum: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardLabel: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
  },
  toastBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    zIndex: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    fontWeight: '600',
  },
});
