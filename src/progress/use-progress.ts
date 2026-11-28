import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { createProgressStore, onProgressChange, type Progress } from './index';

export type ProgressState =
  | { status: 'loading' }
  | { status: 'ready'; progress: Progress }
  | { status: 'error' };

/**
 * The profile's saved progress, read again each time the screen comes into view and after each
 * saved change. Loading while `profileId` is undefined (the learner is not known yet).
 */
export function useProgress(profileId: string | undefined): ProgressState {
  // Kept with the profile it belongs to, so another learner's progress is never shown, even briefly.
  const [state, setState] = useState<{ profileId: string; value: ProgressState }>();

  useFocusEffect(
    useCallback(() => {
      if (profileId === undefined) return;
      let current = true;
      const store = createProgressStore();
      const show = (value: ProgressState) => current && setState({ profileId, value });
      const read = () =>
        store.load(profileId).then(
          (progress) => show({ status: 'ready', progress }),
          () => show({ status: 'error' })
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

  return state && state.profileId === profileId ? state.value : { status: 'loading' };
}
