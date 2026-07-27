// hook to track network connectivity status using netinfo
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // subscribe to network changes and update state
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });

    return unsubscribe;
  }, []);

  return isOnline;
}
