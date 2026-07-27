// screen to manage group settings, display room invite code, display members, and leave/remove members
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc, arrayRemove, onSnapshot, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../services/firebase';
import { useTheme } from '../../theme/ThemeContext';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { Button } from '../../components/Button';

interface MemberProfile {
  uid: string;
  name: string;
  email: string;
}

export function GroupSettingsScreen() {
  const { theme, spacing, radii, typography } = useTheme();
  const { activeGroup, setActiveGroup } = useActiveGroup();
  const [loadingLeave, setLoadingLeave] = useState(false);

  // states for loading group members
  const [membersInfo, setMembersInfo] = useState<MemberProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // subscribe to members list of this group and fetch user profile documents
  useEffect(() => {
    if (!activeGroup) return;

    const unsubscribe = onSnapshot(
      doc(db, 'groups', activeGroup.id),
      async (snapshot) => {
        if (!snapshot.exists()) return;
        const groupData = snapshot.data();
        const memberUids: string[] = groupData.members || [];

        // fetch profiles
        const loadedProfiles: MemberProfile[] = [];
        for (const uid of memberUids) {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              loadedProfiles.push({
                uid,
                name: userData.name || 'Roommate',
                email: userData.email || 'joined roommate',
              });
            } else {
              // fallback for legacy users or users created before profile storage
              loadedProfiles.push({
                uid,
                name: uid === auth.currentUser?.uid ? auth.currentUser.displayName || 'Me' : 'Roommate',
                email: uid === auth.currentUser?.uid ? auth.currentUser.email || 'active user' : 'active user',
              });
            }
          } catch (e) {
            loadedProfiles.push({
              uid,
              name: 'Roommate',
              email: 'active user',
            });
          }
        }
        setMembersInfo(loadedProfiles);
        setLoadingMembers(false);
      },
      (error) => {
        setLoadingMembers(false);
      }
    );

    return unsubscribe;
  }, [activeGroup]);

  // share invitation code via native share sheet
  const handleShareCode = async () => {
    if (!activeGroup) return;
    try {
      await Share.share({
        message: `join my household group on Syncquerino! use invitation code: ${activeGroup.code}`,
      });
    } catch (e) {
      Alert.alert('Error', 'failed to share group invitation code.');
    }
  };

  // remove a specific member from this group
  const handleRemoveMember = (memberUid: string, name: string) => {
    if (!activeGroup) return;

    Alert.alert(
      'Remove Member',
      `are you sure you want to remove ${name} from the group? they will lose access instantly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const groupDocRef = doc(db, 'groups', activeGroup.id);
              await updateDoc(groupDocRef, {
                members: arrayRemove(memberUid),
              });
            } catch (e) {
              Alert.alert('Database Error', 'failed to remove member.');
            }
          },
        },
      ]
    );
  };

  // remove user from group document members list in firestore
  const handleLeaveGroup = async () => {
    if (!activeGroup) return;

    Alert.alert(
      'Leave Group',
      `are you sure you want to leave ${activeGroup.name}? you will lose access to shared lists and notes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLoadingLeave(true);
            try {
              const user = auth.currentUser;
              if (!user) throw new Error('user not authenticated');

              // update database members array
              const groupDocRef = doc(db, 'groups', activeGroup.id);
              await updateDoc(groupDocRef, {
                members: arrayRemove(user.uid),
              });

              // clear app active group state
              await setActiveGroup(null);
            } catch (e) {
              Alert.alert('Database Error', 'failed to leave the group. please try again.');
            } finally {
              setLoadingLeave(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.container, { padding: spacing.lg }]}>
        <View style={styles.content}>
          {/* group summary */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textMuted, ...typography.small }]}>
              active group name
            </Text>
            <Text style={[styles.groupName, { color: theme.text, ...typography.h1 }]}>
              {activeGroup?.name}
            </Text>
          </View>

          {/* share codes */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textMuted, ...typography.small }]}>
              invitation code
            </Text>
            <Text style={[styles.groupCode, { color: theme.primary, ...typography.display }]}>
              {activeGroup?.code}
            </Text>
            <Text style={[styles.description, { color: theme.textMuted, ...typography.small }]}>
              share this code with your roommates or partner so they can join and sync items.
            </Text>
            <Button
              title="Share Invite Code"
              onPress={handleShareCode}
              style={styles.shareBtn}
            />
          </View>

          {/* members list */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textMuted, ...typography.small }]}>
              group members
            </Text>
            {loadingMembers ? (
              <ActivityIndicator size="small" color={theme.primary} style={styles.memberLoader} />
            ) : (
              <View style={styles.memberList}>
                {membersInfo.map((member) => {
                  const isMe = member.uid === auth.currentUser?.uid;
                  return (
                    <View
                      key={member.uid}
                      style={[styles.memberItem, { borderBottomColor: theme.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: theme.text, ...typography.body }]}>
                          {member.name} {isMe && '(me)'}
                        </Text>
                        <Text style={[styles.memberEmail, { color: theme.textMuted, ...typography.caption }]}>
                          {member.email}
                        </Text>
                      </View>
                      {!isMe && (
                        <Pressable
                          onPress={() => handleRemoveMember(member.uid, member.name)}
                          style={styles.removeBtn}
                        >
                          <Ionicons name="person-remove-outline" size={20} color={theme.danger} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        <Button
          title="Switch Active Group"
          onPress={() => setActiveGroup(null)}
          variant="outline"
          style={styles.switchBtn}
        />

        <Button
          title="Leave Group"
          onPress={handleLeaveGroup}
          variant="danger"
          loading={loadingLeave}
          style={styles.leaveBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    gap: 16,
    marginTop: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  groupName: {
    fontWeight: '800',
  },
  groupCode: {
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 16,
    letterSpacing: 2,
  },
  description: {
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  shareBtn: {
    marginTop: 8,
  },
  memberLoader: {
    marginVertical: 16,
  },
  memberList: {
    marginTop: 4,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberName: {
    fontWeight: '600',
  },
  memberEmail: {
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  leaveBtn: {
    marginTop: 12,
    marginBottom: 16,
  },
  switchBtn: {
    marginTop: 24,
  },
});
