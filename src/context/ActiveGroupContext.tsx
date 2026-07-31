// context to manage and persist the selected active group across the app
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // load active group from local asyncstorage
  useEffect(() => {
    async function loadGroup() {
      try {
        const storedGroup = await AsyncStorage.getItem(GROUP_STORAGE_KEY);
        if (storedGroup) {
          setActiveGroupState(JSON.parse(storedGroup));
        }
      } catch (e) {
        // fail silently for storage errors
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
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
