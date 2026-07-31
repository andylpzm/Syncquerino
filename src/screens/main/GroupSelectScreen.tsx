// group select screen allowing users to create, join, or select existing collaborative rooms
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, addDoc, updateDoc, arrayUnion, doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { auth, db } from '../../services/firebase';
import { useTheme } from '../../theme/ThemeContext';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { RootStackParamList } from '../../navigation/types';

interface GroupData {
  id: string;
  name: string;
  code: string;
}

type GroupSelectNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupSelect'>;

interface GroupSelectProps {
  navigation?: GroupSelectNavigationProp;
}

export function GroupSelectScreen({ navigation }: GroupSelectProps) {
  const { theme, spacing, radii, typography } = useTheme();
  const { setActiveGroup } = useActiveGroup();
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  // states for loading existing groups
  const [myGroups, setMyGroups] = useState<GroupData[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // subscribe to list of groups that the user is a member of in real time
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedGroups: GroupData[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedGroups.push({
            id: doc.id,
            name: data.name,
            code: data.code,
          });
        });
        setMyGroups(loadedGroups);
        setLoadingGroups(false);
      },
      (error) => {
        setLoadingGroups(false);
      }
    );

    return unsubscribe;
  }, []);

  // handle logging out from dev session
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      Alert.alert('Error', 'failed to sign out.');
    }
  };

  // create a new group document in firestore and generate a random code
  const handleCreateGroup = async () => {
    if (!createName.trim()) {
      Alert.alert('Validation Error', 'please enter a name for the new group.');
      return;
    }

    setLoadingCreate(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('user not authenticated');

      // generate a clean random 6-character uppercase room code
      const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // write group details to firestore
      const groupData = {
        name: createName.trim(),
        code: generatedCode,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'groups'), groupData);

      // set active group in app state
      await setActiveGroup({
        id: docRef.id,
        name: groupData.name,
        code: groupData.code,
      });
      if (navigation?.canGoBack()) {
        navigation.navigate('MainTabs');
      }
    } catch (e: any) {
      Alert.alert('Database Error', 'failed to create group. please try again.');
    } finally {
      setLoadingCreate(false);
    }
  };

  // find a group matching the code in firestore and add user to members array
  const handleJoinGroup = async () => {
    const cleanedCode = joinCode.trim().toUpperCase();
    if (!cleanedCode) {
      Alert.alert('Validation Error', 'please enter an invitation code.');
      return;
    }

    setLoadingJoin(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('user not authenticated');

      // query groups matching code
      const q = query(collection(db, 'groups'), where('code', '==', cleanedCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('Not Found', 'no group matches this invitation code.');
        setLoadingJoin(false);
        return;
      }

      // get matching document details
      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();

      // update members array in database
      await updateDoc(doc(db, 'groups', groupDoc.id), {
        members: arrayUnion(user.uid),
      });

      // save active group details in local context
      await setActiveGroup({
        id: groupDoc.id,
        name: groupData.name,
        code: groupData.code,
      });
      if (navigation?.canGoBack()) {
        navigation.navigate('MainTabs');
      }
    } catch (e) {
      Alert.alert('Database Error', 'failed to join group. please check connection.');
    } finally {
      setLoadingJoin(false);
    }
  };

  // select an existing group and navigate back to main tabs
  const handleSelectGroup = async (group: GroupData) => {
    await setActiveGroup(group);
    if (navigation?.canGoBack()) {
      navigation.navigate('MainTabs');
    }
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.container, { padding: spacing.lg }]}>
            <View style={styles.headerContainer}>
              <Text style={[styles.title, { color: theme.text, ...typography.h1 }]}>
                Welcome to Syncquerino
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted, ...typography.body }]}>
                to start sharing lists and notes, select an existing circle you belong to, create a new one, or join using an invite code.
              </Text>
            </View>

            <View style={styles.cardContainer}>
              {/* list of existing user circles */}
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text, ...typography.h2 }]}>
                  Select From Your Circles
                </Text>
                {loadingGroups ? (
                  <ActivityIndicator size="small" color={theme.primary} style={styles.groupLoader} />
                ) : myGroups.length > 0 ? (
                  <View style={styles.groupList}>
                    {myGroups.map((group) => (
                      <Pressable
                        key={group.id}
                        onPress={() => handleSelectGroup(group)}
                        style={({ pressed }) => [
                          styles.groupItem,
                          {
                            backgroundColor: theme.background,
                            borderColor: theme.border,
                            borderRadius: radii.md,
                            opacity: pressed ? 0.7 : 1.0,
                          },
                        ]}
                      >
                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.groupItemName, { color: theme.text, ...typography.body }]}>
                            {group.name}
                          </Text>
                          <Text style={[styles.groupItemCode, { color: theme.primary, ...typography.small, fontWeight: '700' }]}>
                            {group.code}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyGroupText, { color: theme.textMuted, ...typography.small }]}>
                    you do not belong to any circles yet. create or join one below.
                  </Text>
                )}
              </View>

              {/* create circle card */}
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text, ...typography.h2 }]}>
                  Create a New Circle
                </Text>
                <Input
                  placeholder="Circle Name"
                  value={createName}
                  onChangeText={setCreateName}
                  autoCorrect={false}
                />
                <Button
                  title="Create Circle"
                  onPress={handleCreateGroup}
                  loading={loadingCreate}
                />
              </View>

              {/* join circle card */}
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.text, ...typography.h2 }]}>
                  Join Existing Circle
                </Text>
                <Input
                  placeholder="enter 6-letter code"
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <Button
                  title="Join Circle"
                  onPress={handleJoinGroup}
                  variant="secondary"
                  loading={loadingJoin}
                />
              </View>
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
    flexGrow: 1,
  },
  headerContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  title: {
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.8,
    lineHeight: 22,
  },
  cardContainer: {
    gap: 20,
    marginBottom: 32,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  groupLoader: {
    marginVertical: 12,
  },
  groupList: {
    gap: 8,
  },
  groupItem: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupItemName: {
    fontWeight: '600',
  },
  groupItemCode: {
    fontWeight: '500',
  },
  emptyGroupText: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  signOutBtn: {
    marginBottom: 16,
  },
});
