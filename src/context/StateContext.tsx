// state provider using usereducer to manage offline pending drafts and auto-sync when back online
import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useIsOnline } from '../hooks/useIsOnline';
import { useActiveGroup } from './ActiveGroupContext';
import { auth, db } from '../services/firebase';

export interface DraftItem {
  id: string;
  category: 'grocery' | 'reminder' | 'note';
  title: string;
  desc?: string;
  assigneeName?: string;
  dueDate?: string;
  imageUrl?: string;
  // when set, this draft is an edit to an item that already exists in firestore
  // rather than a brand new card waiting to be created
  itemId?: string;
}

interface State {
  drafts: DraftItem[];
}

type Action =
  | { type: 'ADD_DRAFT'; payload: DraftItem }
  | { type: 'REMOVE_DRAFT'; payload: string }
  | { type: 'CLEAR_DRAFTS' };

const initialState: State = {
  drafts: [],
};

// state reducer logic to add or clear offline drafts
function stateReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_DRAFT':
      return { drafts: [...state.drafts, action.payload] };
    case 'REMOVE_DRAFT':
      return { drafts: state.drafts.filter((d) => d.id !== action.payload) };
    case 'CLEAR_DRAFTS':
      return { drafts: [] };
    default:
      return state;
  }
}

interface StateContextType {
  drafts: DraftItem[];
  addDraft: (item: Omit<DraftItem, 'id'>) => void;
  removeDraft: (id: string) => void;
}

const StateContext = createContext<StateContextType | undefined>(undefined);

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(stateReducer, initialState);
  const isOnline = useIsOnline();
  const { activeGroup } = useActiveGroup();
  const isSyncingRef = useRef(false);

  const addDraft = useCallback((item: Omit<DraftItem, 'id'>) => {
    const uniqueId = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    dispatch({
      type: 'ADD_DRAFT',
      payload: { ...item, id: uniqueId },
    });
  }, []);

  const removeDraft = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_DRAFT', payload: id });
  }, []);

  // sync pending drafts when internet connection is restored
  useEffect(() => {
    async function syncPendingDrafts() {
      if (!isOnline || state.drafts.length === 0 || !activeGroup || isSyncingRef.current) return;

      isSyncingRef.current = true;
      try {
        const user = auth.currentUser;
        const creatorName = user?.displayName || user?.email || 'member';

        const draftsToSync = [...state.drafts];
        for (const draft of draftsToSync) {
          try {
            if (draft.itemId) {
              // queued edit: apply it to the existing document instead of creating one
              const updates: any = { title: draft.title };

              if (draft.category === 'note') {
                updates.desc = draft.desc || '';
                updates.imageUrl = draft.imageUrl || '';
              } else if (draft.category === 'reminder') {
                updates.assigneeName = draft.assigneeName || 'Anyone';
                updates.dueDate = draft.dueDate || '';
              }

              await updateDoc(doc(db, 'items', draft.itemId), updates);
              dispatch({ type: 'REMOVE_DRAFT', payload: draft.id });
              continue;
            }

            const docData: any = {
              groupId: activeGroup.id,
              category: draft.category,
              title: draft.title,
              createdAt: serverTimestamp(),
            };

            if (draft.category === 'grocery') {
              docData.status = 'active';
              docData.imageUrl = draft.imageUrl || '';
            } else if (draft.category === 'note') {
              docData.desc = draft.desc || '';
              docData.creatorName = draft.assigneeName || creatorName;
              docData.imageUrl = draft.imageUrl || '';
              docData.createdAtText = new Date().toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
            } else if (draft.category === 'reminder') {
              docData.status = 'active';
              docData.assigneeName = draft.assigneeName || 'Anyone';
              docData.dueDate = draft.dueDate || '';
            }

            await addDoc(collection(db, 'items'), docData);
            dispatch({ type: 'REMOVE_DRAFT', payload: draft.id });
          } catch (e) {
            // retry on next online transition
          }
        }
      } finally {
        isSyncingRef.current = false;
      }
    }

    syncPendingDrafts();
  }, [isOnline, activeGroup, state.drafts]);

  const value = useMemo(
    () => ({ drafts: state.drafts, addDraft, removeDraft }),
    [state.drafts, addDraft, removeDraft]
  );

  return (
    <StateContext.Provider value={value}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
}
