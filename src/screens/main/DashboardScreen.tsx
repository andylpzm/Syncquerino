// dashboard recap screen displaying active item counters and group metrics in real time
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { db } from '../../services/firebase';

import Animated, { FadeInDown } from 'react-native-reanimated';

type DashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DashboardScreenProps {
  navigation: DashboardScreenNavigationProp;
}

export function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { theme, spacing, radii, typography } = useTheme();
  const { activeGroup } = useActiveGroup();
  const [counts, setCounts] = useState({ groceries: 0, reminders: 0, notes: 0 });
  const [loading, setLoading] = useState(true);

  // subscribe to items collection and update counts in real time
  useEffect(() => {
    if (!activeGroup) return;

    // query items belonging to this specific household group
    const q = query(collection(db, 'items'), where('groupId', '==', activeGroup.id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let groceryCount = 0;
        let reminderCount = 0;
        let noteCount = 0;

        snapshot.forEach((doc) => {
          const item = doc.data();
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
      (error) => {
        // fail silently for queries during offline transitions
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [activeGroup]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { padding: spacing.lg }]}>
        {/* group branding header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.text, ...typography.h1 }]}>
              {activeGroup?.name || 'My Household'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted, ...typography.body }]}>
              room code: {activeGroup?.code || '------'}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('GroupSettings')}
            style={({ pressed }) => [
              styles.settingsBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderRadius: radii.md,
                opacity: pressed ? 0.7 : 1.0,
              },
            ]}
          >
            <Text style={{ ...typography.small, color: theme.primary, fontWeight: '600' }}>
              settings
            </Text>
          </Pressable>
        </View>

        {/* dashboard stats card container */}
        <View style={styles.statsGrid}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
          ) : (
            <>
              {/* groceries counter */}
              <Animated.View
                entering={FadeInDown.delay(100).duration(400).springify()}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radii.lg }]}
              >
                <Text style={[styles.cardNum, { color: theme.primary, ...typography.display }]}>
                  {counts.groceries}
                </Text>
                <Text style={[styles.cardLabel, { color: theme.text, ...typography.body }]}>
                  groceries
                </Text>
                <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.caption }]}>
                  active items on list
                </Text>
              </Animated.View>

              {/* reminders counter */}
              <Animated.View
                entering={FadeInDown.delay(200).duration(400).springify()}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radii.lg }]}
              >
                <Text style={[styles.cardNum, { color: theme.secondary, ...typography.display }]}>
                  {counts.reminders}
                </Text>
                <Text style={[styles.cardLabel, { color: theme.text, ...typography.body }]}>
                  chores
                </Text>
                <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.caption }]}>
                  pending responsibilities
                </Text>
              </Animated.View>

              {/* whiteboard notes counter */}
              <Animated.View
                entering={FadeInDown.delay(300).duration(400).springify()}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radii.lg }]}
              >
                <Text style={[styles.cardNum, { color: theme.text, ...typography.display }]}>
                  {counts.notes}
                </Text>
                <Text style={[styles.cardLabel, { color: theme.text, ...typography.body }]}>
                  notes
                </Text>
                <Text style={[styles.cardDesc, { color: theme.textMuted, ...typography.caption }]}>
                  bulletins on whiteboard
                </Text>
              </Animated.View>
            </>
          )}
        </View>

        {/* greeting and motivation banner */}
        <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radii.lg }]}>
          <Text style={[styles.bannerText, { color: theme.text, ...typography.small }]}>
            💡 coordinate chores and grocery shopping in real time. all updates made by roommates sync immediately to this dashboard.
          </Text>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  title: {
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    fontWeight: '500',
  },
  settingsBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  statsGrid: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  spinner: {
    alignSelf: 'center',
  },
  card: {
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardNum: {
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardLabel: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardDesc: {
    marginTop: 2,
  },
  banner: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  bannerText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
