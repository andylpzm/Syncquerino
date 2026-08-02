import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import Animated, { FadeInDown, FadeOutDown, Layout, LinearTransition } from 'react-native-reanimated';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { Swipeable, FlatList } from 'react-native-gesture-handler';
import { useAppState } from '../../context/StateContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { auth, db } from '../../services/firebase';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import * as Haptics from 'expo-haptics';

// validation schema for adding notes
const noteSchema = z.object({
  title: z.string().min(1, 'note title is required').max(100, 'title too long'),
  desc: z.string().min(1, 'note description is required').max(500, 'description too long'),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface NoteItem {
  id: string;
  title: string;
  desc: string;
  creatorName?: string;
  createdAtText?: string;
  imageUrl?: string;
  isDraft?: boolean;
}

export function NotesScreen() {
  const { theme, spacing, radii, typography } = useTheme();
  const { activeGroup } = useActiveGroup();
  const { drafts, addDraft, removeDraft } = useAppState();
  const isOnline = useIsOnline();
  const [items, setItems] = useState<NoteItem[]>([]);
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

  // states for modal-based editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // states for camera attachment (holds base64 data uri)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // states for full screen image viewer modal
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: '', desc: '' },
  });

  // reset transient open forms whenever screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setShowAddForm(false);
        setIsEditModalVisible(false);
        setEditingNoteId(null);
        setSelectedImage(null);
        setActivePhotoUrl(null);
        reset();
      };
    }, [reset])
  );

  // subscribe to shared notes in firestore
  useEffect(() => {
    if (!activeGroup) return;

    const q = query(
      collection(db, 'items'),
      where('groupId', '==', activeGroup.id),
      where('category', '==', 'note')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedNotes: NoteItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedNotes.push({
            id: doc.id,
            title: data.title,
            desc: data.desc,
            creatorName: data.creatorName || 'unknown user',
            createdAtText: data.createdAtText || 'recently',
            imageUrl: data.imageUrl,
          });
        });
        setItems(loadedNotes);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [activeGroup]);

  // unified helper to pick images from camera or gallery for creation or edit state
  const handlePickImage = async (mode: 'camera' | 'library', isEdit: boolean) => {
    const isCamera = mode === 'camera';
    const { status } = isCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Denied', `${isCamera ? 'camera' : 'gallery'} permission is required.`);
      return;
    }

    const result = isCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.3,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.3,
          base64: true,
        });

    if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
      const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (isEdit) {
        setEditImage(base64Uri);
      } else {
        setSelectedImage(base64Uri);
      }
    }
  };

  // initialize edit modal state
  const startEditNote = (item: NoteItem) => {
    setEditingNoteId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.desc);
    setEditImage(item.imageUrl || null);
    setIsEditModalVisible(true);
  };

  // save edits to database
  const saveNoteEdit = async () => {
    if (!editingNoteId) return;
    if (!editTitle.trim()) {
      Alert.alert('Validation Error', 'note title is required.');
      return;
    }
    if (!editDesc.trim()) {
      Alert.alert('Validation Error', 'note description is required.');
      return;
    }
    const editedFields = {
      title: editTitle.trim(),
      desc: editDesc.trim(),
      imageUrl: editImage || '',
    };

    if (!isOnline) {
      // offline mode: queue the edit and apply it when the connection returns
      addDraft({
        category: 'note',
        itemId: editingNoteId,
        title: editedFields.title,
        desc: editedFields.desc,
        imageUrl: editedFields.imageUrl,
      });
      closeEditModal();
      return;
    }

    setUploading(true);
    try {
      await updateDoc(doc(db, 'items', editingNoteId), editedFields);
      closeEditModal();
    } catch (e: any) {
      Alert.alert('Database Error', `failed to save note. error: ${e.message || String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const closeEditModal = () => {
    setIsEditModalVisible(false);
    setEditingNoteId(null);
    setEditTitle('');
    setEditDesc('');
    setEditImage(null);
  };

  // create a new note
  const onSubmitNew = async (data: NoteFormData) => {
    if (!activeGroup) return;

    const user = auth.currentUser;
    const creatorName = user?.displayName || user?.email || 'member';

    if (!isOnline) {
      // offline mode: save to local useReducer draft queue
      addDraft({
        category: 'note',
        title: data.title.trim(),
        desc: data.desc.trim(),
        assigneeName: creatorName,
        imageUrl: selectedImage || '',
      });
      resetFormState();
      return;
    }

    setUploading(true);
    try {
      await addDoc(collection(db, 'items'), {
        groupId: activeGroup.id,
        category: 'note',
        title: data.title.trim(),
        desc: data.desc.trim(),
        creatorName,
        imageUrl: selectedImage || '',
        createdAtText: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        createdAt: new Date(),
      });
      resetFormState();
    } catch (e: any) {
      Alert.alert('Database Error', `failed to save note. error: ${e.message || String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const resetFormState = () => {
    setShowAddForm(false);
    setTimeout(() => {
      reset();
      setSelectedImage(null);
    }, 250);
  };

  // delete note from database
  const deleteNote = async (item: NoteItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (item.isDraft) {
      removeDraft(item.id);
      return;
    }
    try {
      await deleteDoc(doc(db, 'items', item.id));
    } catch (e) {
      Alert.alert('Error', 'failed to delete note.');
    }
  };

  // combine local pending drafts with loaded firestore notes
  const localDrafts: NoteItem[] = drafts
    .filter((d) => d.category === 'note' && !d.itemId)
    .map((d) => ({
      id: d.id,
      title: d.title,
      desc: d.desc || '',
      creatorName: d.assigneeName, // using assigneeName field to store author in draft object
      createdAtText: 'sync pending',
      isDraft: true,
      imageUrl: d.imageUrl || undefined, // display local draft photo in list
    }));

  // overlay any edits still queued offline so the user sees their own change immediately
  const itemsWithPendingEdits = items.map((item) => {
    const queued = drafts.filter((d) => d.itemId === item.id);
    if (queued.length === 0) return item;
    const latest = queued[queued.length - 1];
    return {
      ...item,
      title: latest.title,
      desc: latest.desc || '',
      imageUrl: latest.imageUrl || undefined,
    };
  });

  const combinedData = [...localDrafts, ...itemsWithPendingEdits];

  const currentUserIdentifier = auth.currentUser?.displayName || auth.currentUser?.email || 'member';

  const renderNoteItem = useCallback(
    ({ item }: { item: NoteItem }) => {
      const isOwner = item.creatorName === currentUserIdentifier && !item.isDraft;
      const panelWidth = isOwner ? 160 : 80;

      return (
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
              const trans = dragX.interpolate({
                inputRange: [-panelWidth - 100, -panelWidth, 0],
                outputRange: [-100, 0, panelWidth],
                extrapolateRight: 'clamp',
              });
              return (
                <RNAnimated.View style={{ flexDirection: 'row', width: panelWidth, height: '100%', transform: [{ translateX: trans }] }}>
                  {isOwner && (
                    <Pressable
                      style={[styles.swipeRightAction, { backgroundColor: theme.primary, width: 80, height: '100%' }]}
                      onPress={() => {
                        swipeableRefs.current.get(item.id)?.close();
                        startEditNote(item);
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
                      deleteNote(item);
                    }}
                  >
                    <Ionicons name="trash-outline" size={22} color="#ffffff" />
                    <Text style={[styles.swipeActionText, { ...typography.caption }]}>Delete</Text>
                  </Pressable>
                </RNAnimated.View>
              );
            }}
          >
            <Pressable
              onPress={() => {
                if (currentlyOpenId) {
                  dismissSwipeables();
                }
              }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  opacity: pressed && currentlyOpenId ? 0.9 : 1.0
                }
              ]}
              disabled={!currentlyOpenId}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.noteTitle,
                    {
                      color: theme.text,
                      fontStyle: item.isDraft ? 'italic' : 'normal',
                      ...typography.h2,
                    },
                  ]}
                >
                  {item.title}
                </Text>
                {item.isDraft && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: spacing.xs }}>
                    <Ionicons name="time-outline" size={14} color="#f59e0b" />
                    <Text style={{ color: theme.textMuted, fontStyle: 'italic', marginLeft: 2, ...typography.caption }}>
                      (pending sync)
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.noteBody,
                  {
                    color: theme.text,
                    fontStyle: item.isDraft ? 'italic' : 'normal',
                    ...typography.body,
                    marginBottom: item.imageUrl ? 12 : 0,
                  },
                ]}
              >
                {item.desc}
              </Text>

              {item.imageUrl ? (
                <Pressable
                  onPress={() => {
                    if (currentlyOpenId) {
                      dismissSwipeables();
                    } else {
                      setActivePhotoUrl(item.imageUrl!);
                    }
                  }}
                  style={styles.noteImageContainer}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={[styles.noteImage, { borderRadius: radii.md }]}
                    resizeMode="cover"
                  />
                </Pressable>
              ) : null}

              <View style={styles.cardFooter}>
                <Text style={[styles.metaText, { color: theme.textMuted, ...typography.small }]}>
                  posted by {item.creatorName}
                </Text>
                <Text style={[styles.metaText, { color: theme.textMuted, ...typography.small }]}>
                  {item.createdAtText}
                </Text>
              </View>
            </Pressable>
          </Swipeable>
        </Animated.View>
      );
    },
    [currentUserIdentifier, currentlyOpenId, theme, radii, spacing, typography, startEditNote, deleteNote, dismissSwipeables]
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
        {!isOnline && (
          <View style={[styles.offlineBanner, { backgroundColor: theme.warning, borderRadius: radii.sm }]}>
            <Text style={[styles.offlineText, { ...typography.caption }]}>
              Offline Mode: additions will sync once connected
            </Text>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {showAddForm ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutDown.duration(200)}
            style={[
              styles.formContainer,
              { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, gap: 8 },
            ]}
          >
            <Text style={[styles.formTitle, { color: theme.text, ...typography.h2 }]}>
              Pin a Note to the Board
            </Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="Announce something..."
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
              name="desc"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="Tell the circle the details..."
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.desc?.message}
                  autoCorrect={false}
                  multiline
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />
              )}
            />

            {selectedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage }} style={[styles.imagePreview, { borderRadius: radii.md }]} />
                <Pressable onPress={() => setSelectedImage(null)} style={styles.removeImageBtn}>
                  <Ionicons name="close-circle" size={28} color={theme.danger} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoControls}>
                <Button
                  title="Take Photo"
                  onPress={() => handlePickImage('camera', false)}
                  variant="outline"
                  style={styles.photoBtn}
                />
                <Button
                  title="Choose Photo"
                  onPress={() => handlePickImage('library', false)}
                  variant="outline"
                  style={styles.photoBtn}
                />
              </View>
            )}

            <View style={styles.formActions}>
              <Button
                title="Cancel"
                onPress={resetFormState}
                variant="outline"
                style={styles.formBtn}
              />
              <Button
                title="Save"
                onPress={handleSubmit(onSubmitNew)}
                loading={uploading}
                style={styles.formBtn}
              />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(150).duration(200)}>
            <Button
              title="Pin a Note"
              onPress={() => setShowAddForm(true)}
              variant="outline"
              style={styles.addTriggerBtn}
            />
          </Animated.View>
        )}
        </KeyboardAvoidingView>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
        ) : (
          <FlatList
            data={combinedData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={renderNoteItem}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={{ color: theme.textMuted, ...typography.body, textAlign: 'center' }}>
                  The whiteboard is clean! Tap above to leave a message.
                </Text>
              </View>
            )}
          />
        )}
      </Animated.View>

      {/* popup editor modal (industry standard overlay above soft keyboard) */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalCloseArea} onPress={closeEditModal} />
          <View style={[styles.editPopup, { backgroundColor: theme.surface, borderRadius: radii.lg, padding: spacing.lg }]}>
            <View style={styles.editPopupHeader}>
              <Text style={{ color: theme.text, ...typography.h2, fontWeight: '700' }}>Edit Whiteboard Note</Text>
              <Pressable onPress={closeEditModal}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, ...typography.small }]}>Title</Text>
                <TextInput
                  style={[styles.inlineInput, { color: theme.text, borderColor: theme.border, borderRadius: radii.sm, padding: spacing.sm, ...typography.body }]}
                  placeholder="Note Title"
                  placeholderTextColor={theme.textMuted}
                  value={editTitle}
                  onChangeText={setEditTitle}
                />
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, ...typography.small }]}>Description</Text>
                <TextInput
                  style={[styles.inlineInput, { color: theme.text, borderColor: theme.border, borderRadius: radii.sm, padding: spacing.sm, ...typography.body, minHeight: 80 }]}
                  placeholder="Note details..."
                  placeholderTextColor={theme.textMuted}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                />
              </View>

              {/* photo attachment inside editor popup */}
              {editImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: editImage }} style={[styles.imagePreview, { borderRadius: radii.md }]} />
                  <Pressable onPress={() => setEditImage(null)} style={styles.removeImageBtn}>
                    <Ionicons name="close-circle" size={28} color={theme.danger} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoControls}>
                  <Button title="Take Photo" onPress={() => handlePickImage('camera', true)} variant="outline" style={styles.photoBtn} />
                  <Button title="Choose Photo" onPress={() => handlePickImage('library', true)} variant="outline" style={styles.photoBtn} />
                </View>
              )}

              <View style={[styles.formActions, { marginTop: 12 }]}>
                <Button title="Cancel" onPress={closeEditModal} variant="outline" style={styles.formBtn} />
                <Button title="Save Changes" onPress={saveNoteEdit} loading={uploading} style={styles.formBtn} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* visual overlay viewer for fullscreen photo preview */}
      <Modal visible={!!activePhotoUrl} transparent animationType="fade">
        <View style={[styles.modalOverlay, styles.lightboxBackdrop]}>
          <Pressable style={styles.modalCloseArea} onPress={() => setActivePhotoUrl(null)} />
          <View style={styles.modalContent}>
            {activePhotoUrl && (
              <Image source={{ uri: activePhotoUrl }} style={styles.modalImage} resizeMode="contain" />
            )}
            <Pressable onPress={() => setActivePhotoUrl(null)} style={[styles.modalCloseBtn, { backgroundColor: theme.surface }]}>
              <Text style={{ ...typography.body, color: theme.primary, fontWeight: '700' }}>Close</Text>
            </Pressable>
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
  photoControls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  photoBtn: {
    flex: 1,
  },
  imagePreviewContainer: {
    height: 120,
    width: '100%',
    position: 'relative',
    marginBottom: 4,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  noteTitle: {
    fontWeight: '700',
    flex: 1,
  },
  noteBody: {
    lineHeight: 20,
  },
  noteImageContainer: {
    width: '100%',
    height: 150,
  },
  noteImage: {
    width: '100%',
    height: '100%',
  },
  cardFooter: {
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
  lightboxBackdrop: {
    // §9.3: image lightbox uses a higher-contrast backdrop than the form modal overlay above
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalCloseArea: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    width: '90%',
    height: '70%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '85%',
  },
  modalCloseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 16,
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
