import { usePathname } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { startSync, subscribeSync, syncProgress, syncState } from './index';

/**
 * Runs progress sync for the whole app: on start, on every screen the learner opens, when the
 * app comes back to the foreground, after each saved answer and after sign-in or sign-out.
 */
export function useProgressSync() {
  const pathname = usePathname();

  useEffect(() => {
    const stop = startSync();
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncProgress();
    });
    return () => {
      stop();
      foreground.remove();
    };
  }, []);

  useEffect(() => {
    void syncProgress();
  }, [pathname]);
}

export function useSyncState() {
  return useSyncExternalStore(subscribeSync, syncState);
}
