// state provider using usereducer to manage offline pending drafts and auto-sync when back online
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { collection, addDoc } from 'firebase/firestore';
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
      return {
        ...state,
        drafts: [...state.drafts, action.payload],
      };
    case 'REMOVE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.filter((item) => item.id !== action.payload),
      };
    case 'CLEAR_DRAFTS':
      return {
        ...state,
        drafts: [],
      };
    default:
      return state;
  }
}

interface StateContextProps {
  drafts: DraftItem[];
  addDraft: (item: Omit<DraftItem, 'id'>) => void;
  removeDraft: (id: string) => void;
}

const StateContext = createContext<StateContextProps | undefined>(undefined);

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(stateReducer, initialState);
  const isOnline = useIsOnline();
  const { activeGroup } = useActiveGroup();

  // add draft with a unique id
  const addDraft = (item: Omit<DraftItem, 'id'>) => {
    const uniqueId = Math.random().toString(36).substring(2, 9);
    dispatch({
      type: 'ADD_DRAFT',
      payload: { ...item, id: uniqueId },
    });
  };

  // remove a draft manually
  const removeDraft = (id: string) => {
    dispatch({ type: 'REMOVE_DRAFT', payload: id });
  };

  // sync pending drafts when internet connection is restored
  useEffect(() => {
    async function syncPendingDrafts() {
      if (!isOnline || state.drafts.length === 0 || !activeGroup) return;

      const user = auth.currentUser;
      const creatorName = user?.displayName || user?.email || 'roommate';

      // loop through drafts and sync to cloud firestore mapping properties by category
      for (const draft of state.drafts) {
        try {
          const docData: any = {
            groupId: activeGroup.id,
            category: draft.category,
            title: draft.title,
            createdAt: new Date(),
          };

          if (draft.category === 'grocery') {
            docData.status = 'active';
            docData.imageUrl = draft.desc || '';
          } else if (draft.category === 'note') {
            docData.desc = draft.desc || '';
            docData.creatorName = draft.assigneeName || creatorName;
            docData.imageUrl = draft.dueDate || '';
            docData.createdAtText = new Date().toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
          } else if (draft.category === 'reminder') {
            docData.status = 'active';
            docData.assigneeName = draft.assigneeName || 'anyone';
            docData.dueDate = draft.dueDate || 'select date';
          }

          await addDoc(collection(db, 'items'), docData);
        } catch (e) {
          // fail silently and retry on next online transition
        }
      }

      // clear queue after synchronization
      dispatch({ type: 'CLEAR_DRAFTS' });
    }

    syncPendingDrafts();
  }, [isOnline, activeGroup, state.drafts]);

  return (
    <StateContext.Provider value={{ drafts: state.drafts, addDraft, removeDraft }}>
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
