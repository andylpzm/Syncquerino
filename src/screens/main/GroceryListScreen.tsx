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
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { Swipeable, FlatList } from 'react-native-gesture-handler';
import { useActiveGroup } from '../../context/ActiveGroupContext';
import { useAppState } from '../../context/StateContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { db } from '../../services/firebase';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AnimatedCheckbox } from '../../components/AnimatedCheckbox';
import * as Haptics from 'expo-haptics';

// validation schema for adding grocery items
const grocerySchema = z.object({
  title: z.string().min(1, 'item name is required'),
});

type GroceryFormData = z.infer<typeof grocerySchema>;

interface GroceryItem {
  id: string;
  title: string;
  status: 'active' | 'completed';
  imageUrl?: string;
  isDraft?: boolean;
}

export function GroceryListScreen() {
  const { theme, spacing, radii, typography } = useTheme();
  const { activeGroup } = useActiveGroup();
  const { drafts, addDraft, removeDraft } = useAppState();
  const isOnline = useIsOnline();
  const [items, setItems] = useState<GroceryItem[]>([]);
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
  } = useForm<GroceryFormData>({
    resolver: zodResolver(grocerySchema),
    defaultValues: { title: '' },
  });

  // reset transient open forms whenever screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setShowAddForm(false);
        setSelectedImage(null);
        setActivePhotoUrl(null);
        reset();
      };
    }, [reset])
  );

  // subscribe to grocery list items in firestore
  useEffect(() => {
    if (!activeGroup) return;

    const q = query(
      collection(db, 'items'),
      where('groupId', '==', activeGroup.id),
      where('category', '==', 'grocery')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedItems: GroceryItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedItems.push({
            id: doc.id,
            title: data.title,
            status: data.status || 'active',
            imageUrl: data.imageUrl,
          });
        });
        setItems(loadedItems);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [activeGroup]);

  // unified image selection handler
  const handlePickImage = async (mode: 'camera' | 'library') => {
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
      setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // add item to database or local write queue depending on network status
  const onSubmit = async (data: GroceryFormData) => {
    if (!activeGroup) return;

    if (!isOnline) {
      // offline mode: save to local useReducer draft queue (supports base64 image offline caching!)
      addDraft({
        category: 'grocery',
        title: data.title.trim(),
        imageUrl: selectedImage || '',
      });
      resetFormState();
      return;
    }

    setUploading(true);
    try {
      await addDoc(collection(db, 'items'), {
        groupId: activeGroup.id,
        category: 'grocery',
        title: data.title.trim(),
        imageUrl: selectedImage || '',
        status: 'active',
        createdAt: new Date(),
      });

      resetFormState();
    } catch (e: any) {
      Alert.alert('Upload Error', `failed to save item. error: ${e.message || String(e)}`);
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

  // toggle completed status of grocery item
  const toggleItemStatus = async (item: GroceryItem) => {
    if (item.isDraft) {
      Alert.alert('Offline Pending', 'this item is still syncing. you cannot check it off yet.');
      return;
    }
    try {
      const nextStatus = item.status === 'active' ? 'completed' : 'active';
      Haptics.selectionAsync();
      await updateDoc(doc(db, 'items', item.id), {
        status: nextStatus,
      });
    } catch (e) {
      Alert.alert('Error', 'failed to update item status.');
    }
  };

  // delete grocery item from database
  const deleteItem = async (item: GroceryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (item.isDraft) {
      removeDraft(item.id);
      return;
    }
    try {
      await deleteDoc(doc(db, 'items', item.id));
    } catch (e) {
      Alert.alert('Error', 'failed to delete item.');
    }
  };

  // combine local pending drafts with loaded firestore items
  const localDrafts: GroceryItem[] = drafts
    .filter((d) => d.category === 'grocery')
    .map((d) => ({
      id: d.id,
      title: d.title,
      status: 'active' as const,
      isDraft: true,
      imageUrl: d.desc || undefined, // display local draft photo in list
    }));

  const combinedData = [...localDrafts, ...items];

  const renderGroceryItem = useCallback(
    ({ item }: { item: GroceryItem }) => (
      <Animated.View
        entering={FadeInDown.duration(300)}
        exiting={FadeOutDown.duration(300)}
        layout={LinearTransition}
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
            const panelWidth = 80;
            const trans = dragX.interpolate({
              inputRange: [-panelWidth - 100, -panelWidth, 0],
              outputRange: [-100, 0, panelWidth],
              extrapolateRight: 'clamp',
            });
            return (
              <RNAnimated.View style={{ width: panelWidth, height: '100%', transform: [{ translateX: trans }] }}>
                <Pressable
                  style={[styles.swipeRightAction, { backgroundColor: theme.danger, width: '100%', borderTopRightRadius: radii.md, borderBottomRightRadius: radii.md }]}
                  onPress={() => {
                    swipeableRefs.current.get(item.id)?.close();
                    deleteItem(item);
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#ffffff" />
                  <Text style={[styles.swipeActionText, { ...typography.caption }]}>Delete</Text>
                </Pressable>
              </RNAnimated.View>
            );
          }}
        >
          <View style={[styles.itemRow, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md }]}>
            <Pressable
              onPress={() => {
                if (currentlyOpenId) {
                  dismissSwipeables();
                } else {
                  toggleItemStatus(item);
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
                  styles.itemText,
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
                    (pending sync)
                  </Text>
                </View>
              )}
            </Pressable>

            {item.imageUrl ? (
              <Pressable
                onPress={() => {
                  if (currentlyOpenId) {
                    dismissSwipeables();
                  } else {
                    setActivePhotoUrl(item.imageUrl!);
                  }
                }}
                style={styles.thumbnailBtn}
              >
                <Image source={{ uri: item.imageUrl }} style={[styles.thumbnail, { borderRadius: radii.sm }]} />
              </Pressable>
            ) : null}
          </View>
        </Swipeable>
      </Animated.View>
    ),
    [currentlyOpenId, theme, radii, spacing, typography, deleteItem, toggleItemStatus, dismissSwipeables]
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

        {/* toggleable add item form section */}
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
              Add to Shopping List
            </Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="What do we need from the store?"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.title?.message}
                  autoCorrect={false}
                />
              )}
            />

            {/* photo attachment controls */}
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
                  onPress={() => handlePickImage('camera')}
                  variant="outline"
                  style={styles.photoBtn}
                />
                <Button
                  title="Choose Photo"
                  onPress={() => handlePickImage('library')}
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
                title="Add"
                onPress={handleSubmit(onSubmit)}
                loading={uploading}
                style={styles.formBtn}
              />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(150).duration(200)}>
            <Button
              title="Add to Shopping List"
              onPress={() => setShowAddForm(true)}
              variant="outline"
              style={styles.addTriggerBtn}
            />
          </Animated.View>
        )}

        {/* virtualized list of grocery items */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.spinner} />
        ) : (
          <FlatList
            data={combinedData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={renderGroceryItem}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={{ color: theme.textMuted, ...typography.body, textAlign: 'center' }}>
                  Your shopping list is clear! Got everything?
                </Text>
              </View>
            )}
          />
        )}
      </Animated.View>

      {/* visual overlay viewer for fullscreen photo preview */}
      <Modal visible={!!activePhotoUrl} transparent animationType="fade">
        <View style={styles.modalOverlay}>
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
    height: 100,
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
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  itemText: {
    fontWeight: '500',
    flex: 1,
  },
  thumbnailBtn: {
    marginHorizontal: 8,
  },
  thumbnail: {
    width: 32,
    height: 32,
  },
  emptyState: {
    marginTop: 48,
    paddingHorizontal: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
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
});
