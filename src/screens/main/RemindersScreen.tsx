// reminders screen to coordinate household chores and deadlines in real time with react-native-calendars selector
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import Animated, { FadeInDown, FadeOutDown, Layout, LinearTransition } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../theme/ThemeContext';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { useAppState } from '../../context/StateContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { db } from '../../services/firebase';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AnimatedCheckbox } from '../../components/AnimatedCheckbox';
import { formatEuropeanDate } from '../../utils/dateFormatter';
import * as Haptics from 'expo-haptics';

// validation schema for adding chores
const reminderSchema = z.object({
  title: z.string().min(1, 'what needs to get done? chore name is required'),
  assigneeName: z.string().optional(),
  dueDate: z.string().optional(),
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

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: { title: '', assigneeName: '', dueDate: '' },
  });

  const selectedDueDate = watch('dueDate');

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
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedReminders.push({
            id: doc.id,
            title: data.title,
            status: data.status || 'active',
            assigneeName: data.assigneeName,
            dueDate: data.dueDate,
          });
        });
        setItems(loadedReminders);
        setLoading(false);
      },
      (error) => {
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
        assigneeName: data.assigneeName?.trim() || 'anyone',
        dueDate: data.dueDate?.trim() || 'select date',
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
        assigneeName: data.assigneeName?.trim() || 'anyone',
        dueDate: data.dueDate?.trim() || 'select date',
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
    if (!isOnline) {
      Alert.alert('Offline Mode', 'editing existing chores is disabled while offline.');
      return;
    }
    setEditingReminderId(item.id);
    setEditTitle(item.title);
    setEditAssignee(item.assigneeName || 'anyone');
    setEditDueDate(item.dueDate || 'select date');
    setIsEditModalVisible(true);
    setIsEditingCalendarVisible(false);
  };

  // save chore edits to database
  const saveChoreEdit = async () => {
    if (!editingReminderId) return;
    if (!editTitle.trim()) {
      Alert.alert('Validation Error', 'chore name is required.');
      return;
    }
    if (!isOnline) {
      Alert.alert('Offline Mode', 'editing existing chores is disabled.');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'items', editingReminderId), {
        title: editTitle.trim(),
        assigneeName: editAssignee.trim() || 'anyone',
        dueDate: editDueDate.trim() || 'select date',
      });
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
    .filter((d) => d.category === 'reminder')
    .map((d) => ({
      id: d.id,
      title: d.title,
      assigneeName: d.assigneeName,
      dueDate: d.dueDate,
      status: 'active' as const,
      isDraft: true,
    }));

  const combinedData = [...localDrafts, ...items];

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
              Offline Mode: tasks will sync once back online
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
              Assign a House Chore
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
            <Controller
              control={control}
              name="assigneeName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="Assigned to"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  autoCorrect={false}
                />
              )}
            />
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
            renderItem={({ item }) => (
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
                    // Close any other open swipeables
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
                            theme={theme}
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
                          {item.title} {item.isDraft && '(sync pending)'}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.choreFooter}>
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
            )}
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

      {/* chore editor popup modal (industry standard centered overlay) */}
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

                  <View>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, ...typography.small }]}>Assigned To</Text>
                    <TextInput
                      style={[styles.inlineInput, { color: theme.text, borderColor: theme.border, borderRadius: radii.sm, padding: spacing.sm, ...typography.body }]}
                      placeholder="Sarah, John..."
                      placeholderTextColor={theme.textMuted}
                      value={editAssignee}
                      onChangeText={setEditAssignee}
                    />
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
    borderTopColor: '#e5e7eb',
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
    backgroundColor: '#f9fafb',
    marginTop: 4,
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
  },
});
