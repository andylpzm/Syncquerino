import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import Animated, { FadeInDown, FadeOutDown, Layout, LinearTransition } from 'react-native-reanimated';
import { Swipeable, FlatList } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { useAppState } from '../../context/StateContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { auth, db } from '../../services/firebase';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AnimatedCheckbox } from '../../components/AnimatedCheckbox';
import { formatEuropeanDate } from '../../utils/dateFormatter';
import * as Haptics from 'expo-haptics';

// validation schema for adding chores
const reminderSchema = z.object({
  title: z.string().min(1, 'what needs to get done? chore name is required').max(100, 'chore name too long'),
  assigneeName: z.string().max(50, 'assignee name too long').optional(),
  dueDate: z.string().max(20, 'date string too long').optional(),
});

type ReminderFormData = z.infer<typeof reminderSchema>;

interface ReminderItem {
  id: string;
  title: string;
  status: 'active' | 'completed';
  assigneeName?: string;
  dueDate?: string;
  isDraft?: boolean;
}

function getInitials(name: string): string {
  if (!name || name === 'Anyone') return '👥';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function RemindersScreen() {
  const { theme, spacing, radii, typography } = useTheme();
  const { activeGroup } = useActiveGroup();
  const { drafts, addDraft, removeDraft } = useAppState();
  const isOnline = useIsOnline();
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentlyOpenId, setCurrentlyOpenId] = useState<string | null>(null);
  const swipeableRefs = React.useRef<Map<string, any>>(new Map());

  // group members list for assignee selection
  const [groupMembers, setGroupMembers] = useState<string[]>(['Anyone']);
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string>>({});

  const dismissSwipeables = () => {
    if (currentlyOpenId) {
      swipeableRefs.current.forEach((ref) => ref.close());
      setCurrentlyOpenId(null);
    }
  };

  // calendar selector state
  const [calendarVisible, setCalendarVisible] = useState(false);

  // states for modal-based editing
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isEditingCalendarVisible, setIsEditingCalendarVisible] = useState(false);
  const [isEditingAssigneeVisible, setIsEditingAssigneeVisible] = useState(false);

  // modal state for add form assignee selection
  const [isAddAssigneeModalVisible, setIsAddAssigneeModalVisible] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: { title: '', assigneeName: 'Anyone', dueDate: '' },
  });

  const selectedDueDate = watch('dueDate');
  const selectedAssignee = watch('assigneeName');

  // reset open forms and modals whenever the screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setShowAddForm(false);
        closeEditModal();
        setCalendarVisible(false);
        setIsAddAssigneeModalVisible(false);
        reset({ title: '', assigneeName: 'Anyone', dueDate: '' });
      };
    }, [reset])
  );

  // subscribe to active group document and fetch member profile names
  useEffect(() => {
    if (!activeGroup) return;

    const unsubscribe = onSnapshot(
      doc(db, 'groups', activeGroup.id),
      async (snapshot) => {
        if (!snapshot.exists()) return;
        const groupData = snapshot.data();
        const memberUids: string[] = groupData.members || [];

        const loadedNames: string[] = ['Anyone'];
        for (const uid of memberUids) {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists() && userDoc.data().name) {
              loadedNames.push(userDoc.data().name);
            } else if (uid === auth.currentUser?.uid && auth.currentUser?.displayName) {
              loadedNames.push(auth.currentUser.displayName);
            } else {
              loadedNames.push('Roommate');
            }
          } catch (e) {
            loadedNames.push('Roommate');
          }
        }
        setGroupMembers(Array.from(new Set(loadedNames)));
      }
    );

    return unsubscribe;
  }, [activeGroup]);

  // subscribe to reminders collection in firestore
  useEffect(() => {
    if (!activeGroup) return;

    const q = query(
      collection(db, 'items'),
      where('groupId', '==', activeGroup.id),
      where('category', '==', 'reminder')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedReminders: ReminderItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedReminders.push({
            id: docSnap.id,
            title: data.title,
            status: data.status || 'active',
            assigneeName: data.assigneeName,
            dueDate: data.dueDate,
          });
        });
        // sort chores: active first, then earliest due dates first, fallback to title
        loadedReminders.sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === 'active' ? -1 : 1;
          }
          const dateA = a.dueDate && a.dueDate.trim() ? a.dueDate.trim() : '9999-99-99';
          const dateB = b.dueDate && b.dueDate.trim() ? b.dueDate.trim() : '9999-99-99';
          if (dateA !== dateB) {
            return dateA.localeCompare(dateB);
          }
          return a.title.localeCompare(b.title);
        });

        setItems(loadedReminders);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [activeGroup]);

  // write chore to database or local write queue depending on network status
  const onSubmit = async (data: ReminderFormData) => {
    if (!activeGroup) return;

    if (!isOnline) {
      // offline mode: save to local useReducer draft queue
      addDraft({
        category: 'reminder',
        title: data.title.trim(),
        assigneeName: data.assigneeName?.trim() || 'Anyone',
        dueDate: data.dueDate?.trim() || '',
      });
      reset();
      setShowAddForm(false);
      return;
    }

    try {
      const docData = {
        groupId: activeGroup.id,
        category: 'reminder',
        title: data.title.trim(),
        assigneeName: data.assigneeName?.trim() || 'Anyone',
        dueDate: data.dueDate?.trim() || '',
        status: 'active',
        createdAt: new Date(),
      };
      await addDoc(collection(db, 'items'), docData);
      setShowAddForm(false);
      setTimeout(() => reset(), 250);
    } catch (e) {
      Alert.alert('database error', 'could not save this chore right now.');
    }
  };

  // initialize edit modal state
  const startEditChore = (item: ReminderItem) => {
    dismissSwipeables();
    setEditingReminderId(item.id);
    setEditTitle(item.title);
    setEditAssignee(item.assigneeName || 'Anyone');
    setEditDueDate(item.dueDate || '');
    setIsEditModalVisible(true);
    setIsEditingCalendarVisible(false);
    setIsEditingAssigneeVisible(false);
  };

  // save chore edits to database
  const saveChoreEdit = async () => {
    if (!editingReminderId) return;
    if (!editTitle.trim()) {
      Alert.alert('Validation Error', 'chore name is required.');
      return;
    }
    const editedFields = {
      title: editTitle.trim(),
      assigneeName: editAssignee.trim() || 'Anyone',
      dueDate: editDueDate.trim() || '',
    };

    if (!isOnline) {
      // offline mode: queue the edit and apply it when the connection returns
      addDraft({
        category: 'reminder',
        itemId: editingReminderId,
        title: editedFields.title,
        assigneeName: editedFields.assigneeName,
        dueDate: editedFields.dueDate,
      });
      closeEditModal();
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'items', editingReminderId), editedFields);
      closeEditModal();
    } catch (e: any) {
      Alert.alert('Database Error', `failed to save chore. error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const closeEditModal = () => {
    setIsEditModalVisible(false);
    setEditingReminderId(null);
    setEditTitle('');
    setEditAssignee('');
    setEditDueDate('');
    setIsEditingCalendarVisible(false);
    setIsEditingAssigneeVisible(false);
    dismissSwipeables();
  };

  // toggle chore completion status
  const toggleChoreStatus = async (item: ReminderItem) => {
    if (item.isDraft) {
      Alert.alert('sync pending', 'hang on, we are syncing this chore to the cloud.');
      return;
    }
    try {
      const nextStatus = item.status === 'active' ? 'completed' : 'active';
      Haptics.selectionAsync();
      await updateDoc(doc(db, 'items', item.id), {
        status: nextStatus,
      });
    } catch (e) {
      Alert.alert('error', 'could not update task completion.');
    }
  };

  // delete chore from database
  const deleteChore = async (item: ReminderItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (item.isDraft) {
      removeDraft(item.id);
      return;
    }
    try {
      await deleteDoc(doc(db, 'items', item.id));
    } catch (e) {
      Alert.alert('error', 'failed to remove chore card.');
    }
  };

  // combine local pending drafts with loaded firestore chores
  const localDrafts = drafts
    .filter((d) => d.category === 'reminder' && !d.itemId)
    .map((d) => ({
      id: d.id,
      title: d.title,
      assigneeName: d.assigneeName,
      dueDate: d.dueDate,
      status: 'active' as const,
      isDraft: true,
    }));

  // overlay any edits still queued offline so the user sees their own change immediately
  const itemsWithPendingEdits = items.map((item) => {
    const queued = drafts.filter((d) => d.itemId === item.id);
    if (queued.length === 0) return item;
    const latest = queued[queued.length - 1];
    return {
      ...item,
      title: latest.title,
      assigneeName: latest.assigneeName,
      dueDate: latest.dueDate,
    };
  });

  const combinedData = [...localDrafts, ...itemsWithPendingEdits].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1;
    }
    const dateA = a.dueDate && a.dueDate.trim() ? a.dueDate.trim() : '9999-99-99';
    const dateB = b.dueDate && b.dueDate.trim() ? b.dueDate.trim() : '9999-99-99';
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    return a.title.localeCompare(b.title);
  });

  const renderChoreItem = useCallback(
    ({ item }: { item: ReminderItem }) => (
      <Animated.View
        entering={FadeInDown.duration(300)}
        exiting={FadeOutDown.duration(300)}
        layout={Layout.springify().mass(0.8)}
      >
        <Swipeable
          ref={(ref) => {
            if (ref) {
              swipeableRefs.current.set(item.id, ref);
            } else {
              swipeableRefs.current.delete(item.id);
            }
          }}
          onSwipeableWillOpen={() => {
            swipeableRefs.current.forEach((sRef, sId) => {
              if (sId !== item.id) {
                sRef.close();
              }
            });
            setCurrentlyOpenId(item.id);
          }}
          onSwipeableClose={() => {
            if (currentlyOpenId === item.id) {
              setCurrentlyOpenId(null);
            }
          }}
          containerStyle={{ borderRadius: radii.md, overflow: 'hidden' }}
          renderRightActions={(progress, dragX) => {
            const panelWidth = item.isDraft ? 80 : 160;
            const trans = dragX.interpolate({
              inputRange: [-panelWidth - 100, -panelWidth, 0],
              outputRange: [-100, 0, panelWidth],
              extrapolateRight: 'clamp',
            });
            return (
              <RNAnimated.View style={{ flexDirection: 'row', width: panelWidth, height: '100%', transform: [{ translateX: trans }] }}>
                {!item.isDraft && (
                  <Pressable
                    style={[styles.swipeRightAction, { backgroundColor: theme.primary, width: 80, height: '100%' }]}
                    onPress={() => {
                      swipeableRefs.current.get(item.id)?.close();
                      startEditChore(item);
                    }}
                  >
                    <Ionicons name="create-outline" size={22} color="#ffffff" />
                    <Text style={[styles.swipeActionText, { ...typography.caption }]}>Edit</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.swipeRightAction, { backgroundColor: theme.danger, width: 80, height: '100%', borderTopRightRadius: radii.md, borderBottomRightRadius: radii.md }]}
                  onPress={() => {
                    swipeableRefs.current.get(item.id)?.close();
                    deleteChore(item);
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#ffffff" />
                  <Text style={[styles.swipeActionText, { ...typography.caption }]}>Delete</Text>
                </Pressable>
              </RNAnimated.View>
            );
          }}
        >
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md }]}>
            <View style={styles.choreHeader}>
              <Pressable
                onPress={() => {
                  if (currentlyOpenId) {
                    dismissSwipeables();
                  } else {
                    toggleChoreStatus(item);
                  }
                }}
                style={styles.checkboxContainer}
              >
                <View pointerEvents="none">
                  <AnimatedCheckbox
                    checked={item.status === 'completed'}
                    isDraft={item.isDraft}
                    onPress={() => {}}
                  />
                </View>
                <Text
                  style={[
                    styles.choreTitle,
                    {
                      color: item.status === 'completed' || item.isDraft ? theme.textMuted : theme.text,
                      textDecorationLine: item.status === 'completed' ? 'line-through' : 'none',
                      fontStyle: item.isDraft ? 'italic' : 'normal',
                      ...typography.body,
                    },
                  ]}
                >
                  {item.title}
                </Text>
                {item.isDraft && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: spacing.xs }}>
                    <Ionicons name="time-outline" size={14} color="#f59e0b" />
                    <Text style={{ color: theme.textMuted, fontStyle: 'italic', marginLeft: 2, ...typography.caption }}>
                      (sync pending)
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
            <View style={[styles.choreFooter, { borderTopColor: theme.border }]}>
              <Text style={[styles.metaText, { color: theme.textMuted, ...typography.small }]}>
                Assigned to: {item.assigneeName}
              </Text>
              <Text style={[styles.metaText, { color: theme.textMuted, ...typography.small }]}>
                Target Date: {formatEuropeanDate(item.dueDate)}
              </Text>
            </View>
          </View>
        </Swipeable>
      </Animated.View>
    ),
    [currentlyOpenId, theme, radii, spacing, typography, startEditChore, deleteChore, toggleChoreStatus, dismissSwipeables]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Animated.View
        style={[styles.container, { paddingHorizontal: spacing.lg }]}
        layout={LinearTransition.duration(200)}
        onStartShouldSetResponder={() => {
          dismissSwipeables();
          return false;
        }}
      >
        {/* network status header badge */}
        {!isOnline && (
          <View style={[styles.offlineBanner, { backgroundColor: theme.warning, borderRadius: radii.sm }]}>
            <Text style={[styles.offlineText, { ...typography.caption }]}>
              Offline Mode: additions will sync once connected
            </Text>
          </View>
        )}

        {/* toggleable add chore form */}
        {showAddForm ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutDown.duration(200)}
            style={[styles.formContainer, { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md }]}
          >
            <Text style={[styles.formTitle, { color: theme.text, ...typography.h2 }]}>
              Assign a Task
            </Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="What needs to get done?"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.title?.message}
                  autoCorrect={false}
                />
              )}
            />
            {/* assignee selector */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted, ...typography.caption, marginBottom: 4 }]}>
                assigned member:
              </Text>
              <Pressable
                onPress={() => setIsAddAssigneeModalVisible(true)}
                style={({ pressed }) => [
                  styles.assigneeSelectorRow,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    borderRadius: radii.md,
                    opacity: pressed ? 0.75 : 1.0,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.avatarInitials, { color: theme.surface }]}>
                      {getInitials(selectedAssignee || 'Anyone')}
                    </Text>
                  </View>
                  <Text style={[styles.assigneeRowText, { color: theme.text, ...typography.body }]}>
                    {selectedAssignee || 'Anyone'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
              </Pressable>
            </View>
            <Controller
              control={control}
              name="dueDate"
              render={({ field: { value } }) => (
                <Pressable onPress={() => setCalendarVisible(true)}>
                  <View pointerEvents="none">
                    <Input
                      placeholder="Pick a chore deadline..."
                      value={formatEuropeanDate(value)}
                      autoCorrect={false}
                      editable={false}
                    />
                  </View>
                </Pressable>
              )}
            />

            <View style={styles.formActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddForm(false);
                  setTimeout(() => reset(), 250);
                }}
                variant="outline"
                style={styles.formBtn}
              />
              <Button
                title="Save Task"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                style={styles.formBtn}
              />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(150).duration(200)}>
            <Button
              title="Create Chore Task"
              onPress={() => setShowAddForm(true)}
              variant="outline"
              style={styles.addTriggerBtn}
            />
          </Animated.View>
        )}

        {/* virtualized list of chore cards */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
        ) : (
          <FlatList
            data={combinedData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={renderChoreItem}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={{ color: theme.textMuted, ...typography.body, textAlign: 'center' }}>
                  All clean! No house chores scheduled right now. Time to relax!
                </Text>
              </View>
            )}
          />
        )}
      </Animated.View>

      {/* edit task modal */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalCloseArea} onPress={closeEditModal} />
          <View style={[styles.editPopup, { backgroundColor: theme.surface, borderRadius: radii.lg, padding: spacing.lg }]}>
            
            {isEditingCalendarVisible ? (
              // inline react-native-calendars inside editing modal (bypasses modal stacking issues)
              <View>
                <Text style={[styles.formTitle, { color: theme.text, ...typography.h2, marginBottom: 12, textAlign: 'center' }]}>
                  Select Target Date
                </Text>
                <Calendar
                  firstDay={1}
                  onDayPress={(day) => {
                    setEditDueDate(day.dateString);
                    setIsEditingCalendarVisible(false);
                  }}
                  markedDates={
                    editDueDate ? {
                      [editDueDate]: { selected: true, selectedColor: theme.primary }
                    } : {}
                  }
                  theme={{
                    backgroundColor: theme.surface,
                    calendarBackground: theme.surface,
                    textSectionTitleColor: theme.textMuted,
                    selectedDayBackgroundColor: theme.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: theme.primary,
                    dayTextColor: theme.text,
                    textDisabledColor: theme.textMuted,
                    arrowColor: theme.primary,
                    monthTextColor: theme.text,
                    indicatorColor: theme.primary,
                  }}
                  style={{ borderRadius: radii.md, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}
                />

                <Button
                  title="Back to Form"
                  onPress={() => setIsEditingCalendarVisible(false)}
                  variant="outline"
                  style={styles.closeModalBtn}
                />
              </View>
            ) : isEditingAssigneeVisible ? (
              // inline roommate assignee picker inside editing modal (bypasses modal stacking issues)
              <View>
                <View style={styles.editPopupHeader}>
                  <Text style={{ color: theme.text, ...typography.h2, fontWeight: '700' }}>Select Assignee</Text>
                  <Pressable onPress={() => setIsEditingAssigneeVisible(false)}>
                    <Ionicons name="close" size={24} color={theme.textMuted} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={{ gap: 10, maxHeight: 300 }}>
                  {groupMembers.map((member) => {
                    const isSelected = (editAssignee || 'Anyone') === member;
                    const initials = getInitials(member);

                    return (
                      <Pressable
                        key={member}
                        onPress={() => {
                          setEditAssignee(member);
                          setIsEditingAssigneeVisible(false);
                        }}
                        style={({ pressed }) => [
                          styles.sheetMemberRow,
                          {
                            backgroundColor: isSelected ? theme.primary + '15' : theme.background,
                            borderColor: isSelected ? theme.primary : theme.border,
                            borderWidth: isSelected ? 2 : 1,
                            borderRadius: radii.md,
                            opacity: pressed ? 0.75 : 1.0,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={[styles.avatarCircle, { backgroundColor: isSelected ? theme.primary : theme.border, width: 36, height: 36, borderRadius: 18 }]}>
                            <Text style={[styles.avatarInitials, { color: isSelected ? theme.surface : theme.text, fontSize: 13 }]}>
                              {initials}
                            </Text>
                          </View>
                          <Text style={[styles.sheetMemberName, { color: theme.text, ...typography.body, fontWeight: isSelected ? '700' : '500' }]}>
                            {member}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Button
                  title="Back to Form"
                  onPress={() => setIsEditingAssigneeVisible(false)}
                  variant="outline"
                  style={{ width: '100%', marginTop: 12 }}
                />
              </View>
            ) : (
              // standard edit inputs view
              <View>
                <View style={styles.editPopupHeader}>
                  <Text style={{ color: theme.text, ...typography.h2, fontWeight: '700' }}>Edit Chore Task</Text>
                  <Pressable onPress={closeEditModal}>
                    <Ionicons name="close" size={24} color={theme.textMuted} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
                  <View>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, ...typography.small }]}>Chore Title</Text>
                    <TextInput
                      style={[styles.inlineInput, { color: theme.text, borderColor: theme.border, borderRadius: radii.sm, padding: spacing.sm, ...typography.body }]}
                      placeholder="Task name"
                      placeholderTextColor={theme.textMuted}
                      value={editTitle}
                      onChangeText={setEditTitle}
                    />
                  </View>

                  <View style={{ marginVertical: 4 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, ...typography.small, marginBottom: 4 }]}>
                      Assigned Roommate
                    </Text>
                    <Pressable
                      onPress={() => setIsEditingAssigneeVisible(true)}
                      style={({ pressed }) => [
                        styles.assigneeSelectorRow,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.border,
                          borderRadius: radii.md,
                          opacity: pressed ? 0.75 : 1.0,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                          <Text style={[styles.avatarInitials, { color: theme.surface }]}>
                            {getInitials(editAssignee || 'Anyone')}
                          </Text>
                        </View>
                        <Text style={[styles.assigneeRowText, { color: theme.text, ...typography.body }]}>
                          {editAssignee || 'Anyone'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>

                  <View>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, ...typography.small }]}>Target Date</Text>
                    <Pressable onPress={() => setIsEditingCalendarVisible(true)}>
                      <View pointerEvents="none">
                        <TextInput
                          style={[styles.inlineInput, { color: theme.text, borderColor: theme.border, borderRadius: radii.sm, padding: spacing.sm, ...typography.body }]}
                          placeholder="Pick target date..."
                          placeholderTextColor={theme.textMuted}
                          value={formatEuropeanDate(editDueDate)}
                          editable={false}
                        />
                      </View>
                    </Pressable>
                  </View>

                  <View style={[styles.formActions, { marginTop: 12 }]}>
                    <Button title="Cancel" onPress={closeEditModal} variant="outline" style={styles.formBtn} />
                    <Button title="Save Changes" onPress={saveChoreEdit} loading={loading} style={styles.formBtn} />
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assignee Picker Bottom Sheet Modal (For Add Chore Form) */}
      <Modal
        visible={isAddAssigneeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddAssigneeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalCloseArea} onPress={() => setIsAddAssigneeModalVisible(false)} />
          <View style={[styles.editPopup, { backgroundColor: theme.surface, borderRadius: radii.lg, padding: spacing.lg }]}>
            <View style={styles.editPopupHeader}>
              <Text style={{ color: theme.text, ...typography.h2, fontWeight: '700' }}>Select Assignee</Text>
              <Pressable onPress={() => setIsAddAssigneeModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, maxHeight: 300 }}>
              {groupMembers.map((member) => {
                const isSelected = (selectedAssignee || 'Anyone') === member;
                const initials = getInitials(member);

                return (
                  <Pressable
                    key={member}
                    onPress={() => {
                      setValue('assigneeName', member);
                      setIsAddAssigneeModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.sheetMemberRow,
                      {
                        backgroundColor: isSelected ? theme.primary + '15' : theme.background,
                        borderColor: isSelected ? theme.primary : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                        borderRadius: radii.md,
                        opacity: pressed ? 0.75 : 1.0,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.avatarCircle, { backgroundColor: isSelected ? theme.primary : theme.border, width: 36, height: 36, borderRadius: 18 }]}>
                        <Text style={[styles.avatarInitials, { color: isSelected ? theme.surface : theme.text, fontSize: 13 }]}>
                          {initials}
                        </Text>
                      </View>
                      <Text style={[styles.sheetMemberName, { color: theme.text, ...typography.body, fontWeight: isSelected ? '700' : '500' }]}>
                        {member}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Button
              title="Close"
              onPress={() => setIsAddAssigneeModalVisible(false)}
              variant="outline"
              style={{ width: '100%', marginTop: 12 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* custom interactive calendar picker modal for new chore creation */}
      <Modal visible={calendarVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalCloseArea} onPress={() => setCalendarVisible(false)} />
          <View style={[styles.calendarContainer, { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radii.lg }]}>
            <Text style={[styles.formTitle, { color: theme.text, ...typography.h2, marginBottom: 12, textAlign: 'center' }]}>
              Select Chore Deadline
            </Text>
             <Calendar
              firstDay={1}
              onDayPress={(day) => {
                setValue('dueDate', day.dateString);
                setCalendarVisible(false);
              }}
              markedDates={
                selectedDueDate ? {
                  [selectedDueDate]: { selected: true, selectedColor: theme.primary }
                } : {}
              }
              theme={{
                backgroundColor: theme.surface,
                calendarBackground: theme.surface,
                textSectionTitleColor: theme.textMuted,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: theme.primary,
                dayTextColor: theme.text,
                textDisabledColor: theme.textMuted,
                arrowColor: theme.primary,
                monthTextColor: theme.text,
                indicatorColor: theme.primary,
              }}
              style={{ width: 280, borderRadius: radii.md, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}
            />

            <Button
              title="Close Calendar"
              onPress={() => setCalendarVisible(false)}
              variant="outline"
              style={styles.closeModalBtn}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 12,
  },
  offlineBanner: {
    padding: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  offlineText: {
    fontWeight: '700',
    color: '#ffffff',
  },
  addTriggerBtn: {
    marginBottom: 16,
  },
  formContainer: {
    borderWidth: 1,
    marginBottom: 16,
  },
  formTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  formBtn: {
    flex: 1,
  },
  spinner: {
    marginTop: 32,
  },
  listContainer: {
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  rightSwipeActions: {
    flexDirection: 'row',
    width: 160,
    height: '100%',
  },
  swipeRightAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },

  swipeActionText: {
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 2,
  },
  choreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  choreTitle: {
    flex: 1,
    fontWeight: '600',
  },

  choreFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  metaText: {
    fontStyle: 'italic',
  },
  emptyState: {
    marginTop: 48,
    paddingHorizontal: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    ...StyleSheet.absoluteFill,
  },
  calendarContainer: {
    width: '90%',
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  closeModalBtn: {
    width: '100%',
  },
  inlineInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 6,
  },
  editPopup: {
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  editPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fieldLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  avatarMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 24,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 11,
    fontWeight: '700',
  },
  avatarMemberName: {
    fontSize: 14,
  },
  assigneeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  assigneeRowText: {
    fontWeight: '600',
    fontSize: 15,
  },
  sheetMemberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  sheetMemberName: {
    fontWeight: '600',
    fontSize: 15,
  },
});
