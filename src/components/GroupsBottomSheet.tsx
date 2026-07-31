// bottom sheet modal component for selecting household groups and copying invite codes
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

export interface GroupItem {
  id: string;
  name: string;
  code: string;
}

interface GroupsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  myGroups: GroupItem[];
  activeGroupId: string | undefined;
  loadingGroups: boolean;
  onSelectGroup: (group: GroupItem) => void;
  onCopyCode: (group: GroupItem) => void;
  copiedCodeId: string | null;
  onCreateOrJoin: () => void;
}

export function GroupsBottomSheet({
  visible,
  onClose,
  myGroups,
  activeGroupId,
  loadingGroups,
  onSelectGroup,
  onCopyCode,
  copiedCodeId,
  onCreateOrJoin,
}: GroupsBottomSheetProps) {
  const { theme, spacing, radii, typography } = useTheme();

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
            <View>
              <Text style={[styles.sheetTitle, { color: theme.text, ...typography.h2 }]}>
                My Circles
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textMuted, ...typography.caption }]}>
                tap a circle to switch, or tap the code icon to copy invitation code.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetList} contentContainerStyle={{ gap: spacing.sm }}>
            {loadingGroups ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
            ) : myGroups.length > 0 ? (
              myGroups.map((group) => {
                const isActive = group.id === activeGroupId;
                const isCopied = copiedCodeId === group.id;

                return (
                  <View
                    key={group.id}
                    style={[
                      styles.groupRow,
                      {
                        backgroundColor: isActive ? theme.background : theme.surface,
                        borderColor: isActive ? theme.primary : theme.border,
                        borderWidth: isActive ? 2 : 1,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Pressable
                      style={styles.groupInfoArea}
                      onPress={() => onSelectGroup(group)}
                    >
                      <Text style={[styles.groupRowName, { color: theme.text, ...typography.body }]}>
                        {group.name} {isActive && '(active)'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onCopyCode(group)}
                      style={({ pressed }) => [
                        styles.copyCodeBtn,
                        {
                          backgroundColor: isCopied ? theme.secondary : theme.surface,
                          borderColor: theme.border,
                          borderRadius: radii.sm,
                          opacity: pressed ? 0.7 : 1.0,
                        },
                      ]}
                    >
                      {isCopied ? (
                        <Ionicons name="checkmark" size={16} color={theme.surface} />
                      ) : (
                        <Ionicons name="copy-outline" size={16} color={theme.primary} />
                      )}
                      <Text
                        style={[
                          styles.copyCodeText,
                          { color: isCopied ? theme.surface : theme.primary, ...typography.caption },
                        ]}
                      >
                        {isCopied ? 'Copied' : group.code}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: theme.textMuted, textAlign: 'center', marginVertical: 20 }}>
                no circles found. create or join a circle below.
              </Text>
            )}
          </ScrollView>

          <Button
            title="+ Create or Join New Circle"
            onPress={onCreateOrJoin}
            variant="outline"
            style={styles.actionModalBtn}
          />
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
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sheetTitle: {
    fontWeight: '700',
  },
  sheetSubtitle: {
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  sheetList: {
    maxHeight: 350,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  groupInfoArea: {
    flex: 1,
  },
  groupRowName: {
    fontWeight: '600',
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  copyCodeText: {
    fontWeight: '600',
  },
  actionModalBtn: {
    marginTop: 16,
  },
});
