import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { createProgressStore, LOCAL_PROFILE_ID, onProgressChange, type Progress } from './index';

export type ProgressState =
  | { status: 'loading' }
  | { status: 'ready'; progress: Progress }
  | { status: 'error' };

/** The profile's saved progress, read again each time the screen comes into view and after each saved change. */
export function useProgress(profileId: string = LOCAL_PROFILE_ID): ProgressState {
  const [state, setState] = useState<ProgressState>({ status: 'loading' });

  useFocusEffect(
    useCallback(() => {
      let current = true;
      const store = createProgressStore();
      const read = () =>
        store.load(profileId).then(
          (progress) => current && setState({ status: 'ready', progress }),
          () => current && setState({ status: 'error' })
        );
      read();
      const stop = onProgressChange((change) => {
        if (change.profileId === profileId) read();
      });
      return () => {
        current = false;
        stop();
      };
    }, [profileId])
  );

  return state;
}
