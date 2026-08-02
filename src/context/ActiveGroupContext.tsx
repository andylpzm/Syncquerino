// context to manage and persist the selected active group across the app
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface ActiveGroup {
  id: string;
  name: string;
  code: string;
}

interface ActiveGroupContextType {
  activeGroup: ActiveGroup | null;
  setActiveGroup: (group: ActiveGroup | null) => Promise<void>;
  loading: boolean;
}

const ActiveGroupContext = createContext<ActiveGroupContextType | undefined>(undefined);

const GROUP_STORAGE_KEY = '@syncquerino_active_group';

export function ActiveGroupProvider({ children }: { children: React.ReactNode }) {
  const [activeGroup, setActiveGroupState] = useState<ActiveGroup | null>(null);
  const [loading, setLoading] = useState(true);

  // restore the cached circle, but only after confirming it still belongs to the
  // signed-in user. re-runs whenever the account changes so a new user never
  // inherits the previous user's circle from this device.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        // signed out: drop the cached circle so the next account starts clean
        if (!user) {
          setActiveGroupState(null);
          await AsyncStorage.removeItem(GROUP_STORAGE_KEY);
          return;
        }

        const storedGroup = await AsyncStorage.getItem(GROUP_STORAGE_KEY);
        if (!storedGroup) {
          setActiveGroupState(null);
          return;
        }

        const cached: ActiveGroup = JSON.parse(storedGroup);

        try {
          const snapshot = await getDoc(doc(db, 'groups', cached.id));
          const members: string[] = snapshot.exists() ? snapshot.data().members || [] : [];

          if (snapshot.exists() && members.includes(user.uid)) {
            // refresh name and code from the server in case they changed
            setActiveGroupState({
              id: snapshot.id,
              name: snapshot.data().name,
              code: snapshot.data().code,
            });
          } else {
            // circle was deleted, or this user is not a member of it
            setActiveGroupState(null);
            await AsyncStorage.removeItem(GROUP_STORAGE_KEY);
          }
        } catch (verifyError: any) {
          if (verifyError?.code === 'permission-denied') {
            // rules rejected the read, so this user has no access to that circle
            setActiveGroupState(null);
            await AsyncStorage.removeItem(GROUP_STORAGE_KEY);
          } else {
            // offline or unreachable: keep the cached circle rather than
            // locking the user out of their own workspace
            setActiveGroupState(cached);
          }
        }
      } catch (e) {
        // fail silently for storage errors
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // update and save active group state
  const setActiveGroup = useCallback(async (group: ActiveGroup | null) => {
    try {
      setActiveGroupState(group);
      if (group) {
        await AsyncStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(group));
      } else {
        await AsyncStorage.removeItem(GROUP_STORAGE_KEY);
      }
    } catch (e) {
      // fail silently for storage errors
    }
  }, []);

  const value = useMemo(
    () => ({ activeGroup, setActiveGroup, loading }),
    [activeGroup, setActiveGroup, loading]
  );

  return (
    <ActiveGroupContext.Provider value={value}>
      {children}
    </ActiveGroupContext.Provider>
  );
}

export function useActiveGroup() {
  const context = useContext(ActiveGroupContext);
  if (!context) {
    throw new Error('useActiveGroup must be used within an ActiveGroupProvider');
  }
  return context;
}
